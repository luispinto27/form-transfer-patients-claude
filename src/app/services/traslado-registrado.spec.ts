import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  TrasladoRegistradoService,
  BITACORA_TRASLADOS,
  BitacoraTraslados,
  EntradaBitacora,
  BitacoraError
} from './traslado-registrado';

/**
 * Doble de la bitácora. Registra lo que se le pidió guardar para poder
 * afirmar sobre el documento que habría llegado a Firestore.
 */
class BitacoraFalsa implements BitacoraTraslados {
  indice = new Map<string, EntradaBitacora>();
  creados: { autorizacion: string; datos: unknown }[] = [];
  errorAlCrear: unknown = null;
  leerIndiceLlamadas = 0;

  async leerIndice(autorizacion: string): Promise<EntradaBitacora | null> {
    this.leerIndiceLlamadas++;
    return this.indice.get(autorizacion) ?? null;
  }

  async crear(autorizacion: string, datos: Record<string, unknown>): Promise<void> {
    if (this.errorAlCrear) {
      throw this.errorAlCrear;
    }
    this.creados.push({ autorizacion, datos });
  }
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
      bitacora.indice.set('99887766', { registradoEn: cuando });
      const servicio = crear(bitacora);

      const registro = await firstValueFrom(servicio.buscarRegistro('99887766'));

      expect(registro).toEqual({ autorizacion: '99887766', registradoEn: cuando });
    });

    it('bloquea aunque la fecha del registro no se pueda leer', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', { registradoEn: null });
      const servicio = crear(bitacora);

      const registro = await firstValueFrom(servicio.buscarRegistro('99887766'));

      expect(registro).toEqual({ autorizacion: '99887766', registradoEn: null });
    });

    it('en el servidor devuelve null sin consultar la bitácora', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', { registradoEn: new Date() });
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

    it('trata permission-denied como duplicado cuando el índice ya tiene la autorización', async () => {
      const bitacora = new BitacoraFalsa();
      bitacora.indice.set('99887766', { registradoEn: new Date() });
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
