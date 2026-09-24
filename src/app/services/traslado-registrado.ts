import { Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from, of } from 'rxjs';
import { environment } from '../../environments/environment';

/** Un traslado que ya fue enviado al servicio externo. */
export interface RegistroTrasladoExistente {
  autorizacion: string;
  /** `null` si el documento existe pero su fecha no se pudo leer. */
  registradoEn: Date | null;
}

/** Lo que el índice de bloqueo devuelve cuando la autorización está registrada. */
export interface EntradaBitacora {
  registradoEn: Date | null;
}

/**
 * Lo mínimo de Firestore que necesita el servicio.
 *
 * Existe como punto de indirección para poder probar la lógica de bloqueo y la
 * clasificación de errores sin red ni emulador.
 */
export interface BitacoraTraslados {
  leerIndice(autorizacion: string): Promise<EntradaBitacora | null>;
  crear(autorizacion: string, datos: Record<string, unknown>): Promise<void>;
}

/** Por qué falló una escritura en la bitácora. Determina qué se le dice al usuario. */
export type MotivoBitacora = 'duplicado' | 'configuracion' | 'desconocido';

export class BitacoraError extends Error {
  constructor(readonly motivo: MotivoBitacora, mensaje: string) {
    super(mensaje);
    this.name = 'BitacoraError';
  }
}

const COLECCION_INDICE = 'traslados_index';
const COLECCION_REGISTROS = 'traslados';

/**
 * Bitácora real sobre Firestore.
 *
 * El SDK se carga con `import()` dinámico y solo cuando se usa, para que no
 * entre en el bundle inicial — el mismo patrón que `PdfService` usa con
 * pdfmake.
 */
class FirestoreBitacora implements BitacoraTraslados {

  private db?: Promise<import('firebase/firestore').Firestore>;

  private conectar(): Promise<import('firebase/firestore').Firestore> {
    this.db ??= (async () => {
      const [{ initializeApp, getApp, getApps }, { getFirestore }] = await Promise.all([
        import('firebase/app'),
        import('firebase/firestore')
      ]);
      const app = getApps().length ? getApp() : initializeApp(environment.firebase);
      return getFirestore(app);
    })();
    return this.db;
  }

  async leerIndice(autorizacion: string): Promise<EntradaBitacora | null> {
    const [{ doc, getDoc }, db] = await Promise.all([
      import('firebase/firestore'),
      this.conectar()
    ]);

    const snap = await getDoc(doc(db, COLECCION_INDICE, autorizacion));
    if (!snap.exists()) {
      return null;
    }

    // El documento existe, y eso ya significa "bloqueado". La fecha se informa
    // aparte porque un `serverTimestamp()` todavía pendiente se lee como null,
    // y eso no debe confundirse con "no está registrado".
    const valor: unknown = snap.get('registradoEn');
    const registradoEn =
      valor instanceof Date
        ? valor
        : typeof (valor as { toDate?: () => Date })?.toDate === 'function'
          ? (valor as { toDate: () => Date }).toDate()
          : null;

    return { registradoEn };
  }

  async crear(autorizacion: string, datos: Record<string, unknown>): Promise<void> {
    const [{ doc, serverTimestamp, writeBatch }, db] = await Promise.all([
      import('firebase/firestore'),
      this.conectar()
    ]);

    // Un solo batch: o quedan los dos documentos, o ninguno. Si el traslado ya
    // estaba registrado, las reglas rechazan el batch completo.
    const lote = writeBatch(db);
    const registradoEn = serverTimestamp();

    lote.set(doc(db, COLECCION_INDICE, autorizacion), { autorizacion, registradoEn });
    lote.set(doc(db, COLECCION_REGISTROS, autorizacion), {
      autorizacion,
      registradoEn,
      payload: { datos }
    });

    await lote.commit();
  }
}

export const BITACORA_TRASLADOS = new InjectionToken<BitacoraTraslados>('BitacoraTraslados', {
  providedIn: 'root',
  factory: () => new FirestoreBitacora()
});

@Injectable({ providedIn: 'root' })
export class TrasladoRegistradoService {

  private readonly bitacora = inject(BITACORA_TRASLADOS);
  private readonly esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Si esta autorización ya fue enviada al servicio externo.
   *
   * En el servidor (SSR) resuelve `null` sin tocar red: Firestore no arranca
   * ahí. La comprobación real ocurre al hidratar, y el candado de `create` de
   * las reglas sigue puesto en el envío.
   */
  buscarRegistro(autorizacion: string): Observable<RegistroTrasladoExistente | null> {
    if (!this.esNavegador) {
      return of(null);
    }

    return from(
      this.bitacora.leerIndice(autorizacion).then(entrada =>
        entrada ? { autorizacion, registradoEn: entrada.registradoEn } : null
      )
    );
  }

  /**
   * Deja constancia de un traslado ya enviado al servicio externo.
   *
   * `pdfHistoria` se descarta: el PDF pesa varios MB en base64, no cabe en el
   * límite de 1 MiB por documento de Firestore, y ya queda tanto en el servicio
   * externo como en la descarga del operador.
   */
  registrar(autorizacion: string, datos: Record<string, unknown>): Observable<void> {
    const { pdfHistoria: _pdf, ...sinPdf } = datos;

    return from(
      this.bitacora.crear(autorizacion, sinPdf).catch(error => this.clasificar(error, autorizacion))
    );
  }

  /**
   * Al denegar `update` en las reglas, un `set` sobre un documento existente
   * devuelve `permission-denied` — el mismo código que devolverían unas reglas
   * mal desplegadas. Son situaciones opuestas, así que se distinguen
   * consultando el índice: si está, fue un duplicado; si no, la configuración
   * está rota y decirle al operador "ya fue registrado" sería mentirle.
   */
  private async clasificar(error: unknown, autorizacion: string): Promise<never> {
    const codigo = (error as { code?: string } | null)?.code;

    if (codigo !== 'permission-denied') {
      throw new BitacoraError('desconocido', 'No se pudo registrar el traslado en la bitácora.');
    }

    const existente = await this.bitacora.leerIndice(autorizacion).catch(() => null);

    throw existente
      ? new BitacoraError('duplicado', 'Este traslado ya había sido registrado.')
      : new BitacoraError(
          'configuracion',
          'La bitácora rechazó la escritura. Revise las reglas de Firestore.'
        );
  }
}
