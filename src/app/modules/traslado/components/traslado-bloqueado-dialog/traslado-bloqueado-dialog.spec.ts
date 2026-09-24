import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { TrasladoBloqueadoDialog } from './traslado-bloqueado-dialog';
import { RegistroTrasladoExistente } from '../../../../services/traslado-registrado';

describe('TrasladoBloqueadoDialog', () => {
  let fixture: ComponentFixture<TrasladoBloqueadoDialog>;

  async function montar(data: RegistroTrasladoExistente): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TrasladoBloqueadoDialog],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: data }]
    }).compileComponents();

    fixture = TestBed.createComponent(TrasladoBloqueadoDialog);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra el número de autorización', async () => {
    const el = await montar({ autorizacion: '99887766', registradoEn: new Date() });

    expect(el.querySelector('.bloqueo__numero')?.textContent?.trim()).toBe('99887766');
  });

  it('muestra cuándo se registró', async () => {
    const el = await montar({
      autorizacion: '99887766',
      registradoEn: new Date(2026, 2, 14, 15, 4)
    });

    expect(el.querySelector('.bloqueo__fecha')?.textContent).toContain('14/03/2026');
    expect(el.querySelector('.bloqueo__fecha')?.textContent).toContain('15:04');
  });

  /**
   * El servicio puede devolver `registradoEn: null` sobre un documento que sí
   * existe. Bloquear sigue siendo correcto, pero la fecha no se puede afirmar,
   * y dejar el hueco en blanco parecería un error de la aplicación.
   */
  it('dice que la fecha no está disponible en lugar de dejar el hueco vacío', async () => {
    const el = await montar({ autorizacion: '99887766', registradoEn: null });

    const fecha = el.querySelector('.bloqueo__fecha');
    expect(fecha).toBeTruthy();
    expect(fecha?.textContent).toContain('no disponible');
  });

  /** No es un error del operador: no debe llevar el rojo del diálogo de validación. */
  it('no se presenta como un error', async () => {
    const el = await montar({ autorizacion: '99887766', registradoEn: new Date() });

    expect(el.textContent).not.toContain('Error');
    expect(el.querySelector('.bloqueo__sello')?.textContent?.trim()).toBe('Diligenciado');
  });

  it('le dice al operador qué hacer', async () => {
    const el = await montar({ autorizacion: '99887766', registradoEn: new Date() });

    const guia = el.querySelector('.bloqueo__guia')?.textContent ?? '';
    expect(guia).toContain('cerrar esta ventana');
    expect(guia).toContain('área administrativa');
  });
});
