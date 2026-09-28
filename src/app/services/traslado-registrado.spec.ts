import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  TrasladoRegistradoService,
  BITACORA_TRASLADOS,
  BitacoraTraslados,
  EntradaBitacora,
  BitacoraError,
  admiteRegreso
} from './traslado-registrado';

/**
 * Doble de la bitácora. Registra lo que se le pidió guardar para poder
 * afirmar sobre el documento que habría llegado a Firestore.
 */
class BitacoraFalsa implements BitacoraTraslados {
  indice = new Map<string, EntradaBitacora>();
  creados: { autorizacion: string; datos: unknown; retorno: boolean }[] = [];
  regresos: { autorizacion: string; datos: unknown }[] = [];
  errorAlCrear: unknown = null;
  leerIndiceLlamadas = 0;

  async leerIndice(autorizacion: string): Promise<EntradaBitacora | null> {
    this.leerIndiceLlamadas++;
    return this.indice.get(autorizacion) ?? null;
  }

  async crear(autorizacion: string, datos: Record<string, unknown>, retorno: boolean): Promise<void> {
    if (this.errorAlCrear) {
      throw this.errorAlCrear;
    }
    this.creados.push({ autorizacion, datos, retorno });
  }

  async crearRegreso(autorizacion: string, datos: Record<string, unknown>): Promise<void> {
    if (this.errorAlCrear) {
      throw this.errorAlCrear;
    }
    this.regresos.push({ autorizacion, datos });
  }
}

/** Entrada del índice para una ida ya registrada. */
function entrada(extra: Partial<EntradaBitacora> = {}): EntradaBitacora {
  return { registradoEn: new Date(), retorno: false, envios: 1, ...extra };
}

function crear(bitacora: BitacoraFalsa, platformId: string | object = 'browser') {
  TestBed.configureTestingModule({
    providers: [
      TrasladoRegistradoService,
      { provide: BITACORA_TRASLADOS, useValue: bitacora },
      { provide: PLATFORM_ID, useValue: platformId }
    ]
  });
  return TestBed.inject(TrasladoRegistradoService);
}

/** Las 8 secciones que el formulario envía como `datos`. */
function datosEnviados(extra: Record<string, unknown> = {}) {
  return {
    traslado: { autorizacionNumero: '99887766' },
    paciente: { nombreCompleto: 'Juan Pérez' },
    antecedentes: {},
    signos: [],
    examen: {},
    gastos: [],
    conducta: {},
    firmas: {},
    ...extra
  };
}

describe('admiteRegreso', () => {

  it('admite el regreso de una ida marcada como Retorno', () => {
    expect(admiteRegreso({ retorno: true, envios: 1 })).toBe(true);
  });

  it('no admite un tercer envío aunque la ida fuera de Retorno', () => {
    expect(admiteRegreso({ retorno: true, envios: 2 })).toBe(false);
  });

  it('no admite un segundo envío si la ida no era de Retorno', () => {
    expect(admiteRegreso({ retorno: false, envios: 1 })).toBe(false);
  });
});

describe('TrasladoRegistradoService', () => {

  describe('buscarRegistro', () => {

    it('devuelve null cuando la autorización no está registrada', async () => {
      const bitacora = new BitacoraFalsa();
      const servicio = crear(bitacora);

      const registro = await firstValueFrom(servicio.buscarRegistro('99887766'));

      expect(registro).toBeNull();
    });

    it('devuelve la autorización y la fecha cuando ya está registrada', async () => {
      const bitacora = new BitacoraFalsa();
      const cuando = new Date('2026-03-14T15:04:05Z');
      bitacora.indice.set('99887766', entrada({ registradoEn: cuando, retorno: true }));
      const servicio = crear(bitacora);

      const registro = await firstValueFrom(servicio.buscarRegistro('99887766'));

      expect(registro).toEqual({
        autorizacion: '99887766', registradoEn: cuando, retorno: true, envios: 1
      });
    });

    it('bloquea aunque la fecha del registro no se pueda leer', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', entrada({ registradoEn: null }));
      const servicio = crear(bitacora);

      const registro = await firstValueFrom(servicio.buscarRegistro('99887766'));

      expect(registro).toEqual({
        autorizacion: '99887766', registradoEn: null, retorno: false, envios: 1
      });
    });

    it('en el servidor devuelve null sin consultar la bitácora', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', entrada());
      const servicio = crear(bitacora, 'server');

      const registro = await firstValueFrom(servicio.buscarRegistro('99887766'));

      expect(registro).toBeNull();
      expect(bitacora.leerIndiceLlamadas).toBe(0);
    });
  });

  describe('registrar', () => {

    it('guarda las secciones del formulario bajo el número de autorización', async () => {
      const bitacora = new BitacoraFalsa();
      const servicio = crear(bitacora);

      await firstValueFrom(servicio.registrar('99887766', datosEnviados()));

      expect(bitacora.creados.length).toBe(1);
      expect(bitacora.creados[0].autorizacion).toBe('99887766');
      expect(bitacora.creados[0].datos).toEqual(datosEnviados());
    });

    it('omite el PDF en base64 del registro guardado', async () => {
      const bitacora = new BitacoraFalsa();
      const servicio = crear(bitacora);

      await firstValueFrom(
        servicio.registrar('99887766', datosEnviados({ pdfHistoria: 'JVBERi0xLjQK' }))
      );

      expect(bitacora.creados[0].datos).not.toHaveProperty('pdfHistoria');
      expect(bitacora.creados[0].datos).toEqual(datosEnviados());
    });

    it('guarda en el índice que la ida se marcó como Retorno', async () => {
      const bitacora = new BitacoraFalsa();
      const servicio = crear(bitacora);

      await firstValueFrom(
        servicio.registrar('99887766', datosEnviados({ traslado: { retorno: true } }))
      );

      expect(bitacora.creados[0].retorno).toBe(true);
    });

    it('guarda la ida sin Retorno cuando el checkbox no se marcó', async () => {
      const bitacora = new BitacoraFalsa();
      const servicio = crear(bitacora);

      await firstValueFrom(
        servicio.registrar('99887766', datosEnviados({ traslado: { retorno: false } }))
      );

      expect(bitacora.creados[0].retorno).toBe(false);
    });

    it('registra el regreso aparte de la ida y sin el PDF', async () => {
      const bitacora = new BitacoraFalsa();
      const servicio = crear(bitacora);

      await firstValueFrom(
        servicio.registrar('99887766', datosEnviados({ pdfHistoria: 'JVBERi0xLjQK' }), 'regreso')
      );

      expect(bitacora.creados.length).toBe(0);
      expect(bitacora.regresos).toEqual([{ autorizacion: '99887766', datos: datosEnviados() }]);
    });

    it('trata como duplicado un regreso cuando ya se registraron ida y regreso', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', entrada({ retorno: true, envios: 2 }));
      bitacora.errorAlCrear = { code: 'permission-denied' };
      const servicio = crear(bitacora);

      const error = await firstValueFrom(servicio.registrar('99887766', datosEnviados(), 'regreso'))
        .then(() => null)
        .catch((e: unknown) => e);

      expect((error as BitacoraError).motivo).toBe('duplicado');
    });

    it('trata como duplicado un regreso de una ida que no era de Retorno', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', entrada({ retorno: false }));
      bitacora.errorAlCrear = { code: 'permission-denied' };
      const servicio = crear(bitacora);

      const error = await firstValueFrom(servicio.registrar('99887766', datosEnviados(), 'regreso'))
        .then(() => null)
        .catch((e: unknown) => e);

      expect((error as BitacoraError).motivo).toBe('duplicado');
    });

    it('trata como configuración un regreso rechazado que el índice sí admitía', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', entrada({ retorno: true, envios: 1 }));
      bitacora.errorAlCrear = { code: 'permission-denied' };
      const servicio = crear(bitacora);

      const error = await firstValueFrom(servicio.registrar('99887766', datosEnviados(), 'regreso'))
        .then(() => null)
        .catch((e: unknown) => e);

      expect((error as BitacoraError).motivo).toBe('configuracion');
    });

    it('trata permission-denied como duplicado cuando el índice ya tiene la autorización', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', entrada());
      bitacora.errorAlCrear = { code: 'permission-denied' };
      const servicio = crear(bitacora);

      const error = await firstValueFrom(servicio.registrar('99887766', datosEnviados()))
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BitacoraError);
      expect((error as BitacoraError).motivo).toBe('duplicado');
    });

    it('trata permission-denied como fallo de configuración cuando el índice está vacío', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.errorAlCrear = { code: 'permission-denied' };
      const servicio = crear(bitacora);

      const error = await firstValueFrom(servicio.registrar('99887766', datosEnviados()))
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BitacoraError);
      expect((error as BitacoraError).motivo).toBe('configuracion');
    });

    it('reporta cualquier otro fallo como desconocido', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.errorAlCrear = { code: 'unavailable' };
      const servicio = crear(bitacora);

      const error = await firstValueFrom(servicio.registrar('99887766', datosEnviados()))
        .then(() => null)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BitacoraError);
      expect((error as BitacoraError).motivo).toBe('desconocido');
    });
  });
});
