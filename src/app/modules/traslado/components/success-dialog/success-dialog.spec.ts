import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { vi } from 'vitest';

import { SuccessDialog, SuccessDialogData } from './success-dialog';

describe('SuccessDialog', () => {
  let fixture: ComponentFixture<SuccessDialog>;
  let componente: SuccessDialog;
  let cerrar: ReturnType<typeof vi.fn>;

  async function montar(data: SuccessDialogData): Promise<HTMLElement> {
    cerrar = vi.fn();

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SuccessDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: cerrar } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SuccessDialog);
    componente = fixture.componentInstance;
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const exito = (extra: Partial<SuccessDialogData> = {}): SuccessDialogData => ({
    loading: false,
    error: false,
    autorizacion: '99887766',
    message: 'Información almacenada correctamente.',
    ...extra
  });

  describe('mientras genera', () => {

    it('no sella nada todavía', async () => {
      const el = await montar({ loading: true, autorizacion: '99887766' });

      expect(el.querySelector('.envio__sello')).toBeNull();
    });

    it('no ofrece cerrar mientras trabaja', async () => {
      const el = await montar({ loading: true, autorizacion: '99887766' });

      expect(el.querySelector('button')).toBeNull();
    });
  });

  describe('cuando el envío sale bien', () => {

    it('muestra el número de autorización enviado', async () => {
      const el = await montar(exito());

      expect(el.querySelector('.envio__numero')?.textContent?.trim()).toBe('99887766');
    });

    it('sella el traslado como enviado', async () => {
      const el = await montar(exito());

      expect(el.querySelector('.envio__sello')?.textContent?.trim()).toBe('Enviado');
    });

    it('dice que el PDF se descargó', async () => {
      const el = await montar(exito());

      expect(el.textContent).toContain('PDF');
      expect(el.textContent).toContain('descarg');
    });

    it('no muestra advertencia cuando no hay ninguna', async () => {
      const el = await montar(exito());

      expect(el.querySelector('.envio__advertencia')).toBeNull();
    });

    /**
     * El PHP responde `mensaje: "ok"` en el caso bueno, y eso se estaba
     * pintando tal cual en el diálogo. El mensaje del servidor es un detalle
     * técnico: sirve para diagnosticar un fallo, no para explicarle el éxito
     * a un operador.
     */
    it('no repite el mensaje crudo del servidor', async () => {
      const el = await montar(exito({ message: 'ok' }));

      expect(el.textContent).not.toContain('ok');
    });

    it('explica el resultado con sus propias palabras', async () => {
      const el = await montar(exito({ message: 'ok' }));

      expect(el.querySelector('.envio__guia')?.textContent).toContain('registrada en el sistema');
    });

    it('avisa al cerrar que el formulario queda listo para otro traslado', async () => {
      const el = await montar(exito());

      expect(el.textContent).toContain('nuevo traslado');
    });

    it('devuelve success al cerrar, para que el formulario se reinicie', async () => {
      await montar(exito());

      componente.close();

      expect(cerrar).toHaveBeenCalledWith('success');
    });
  });

  describe('cuando la bitácora falló pero el envío no', () => {

    it('muestra la advertencia sin dejar de ser un éxito', async () => {
      const el = await montar(exito({ warning: 'No quedó registrado en la bitácora.' }));

      expect(el.querySelector('.envio__advertencia')?.textContent)
        .toContain('No quedó registrado en la bitácora.');
      expect(el.querySelector('.envio__sello')?.textContent?.trim()).toBe('Enviado');
    });
  });

  describe('cuando el envío falla', () => {

    it('no sella un traslado que no se envió', async () => {
      const el = await montar(exito({ error: true, message: 'No se pudo guardar.' }));

      expect(el.querySelector('.envio__sello')).toBeNull();
    });

    /**
     * Lo primero que necesita saber quien acaba de diligenciar ocho secciones
     * es que no las perdió. Sin eso, el mensaje de error solo produce pánico.
     */
    it('avisa de que lo diligenciado no se perdió', async () => {
      const el = await montar(exito({ error: true, message: 'Timeout' }));

      const guia = el.querySelector('.envio__guia')?.textContent ?? '';
      expect(guia).toContain('sigue en el formulario');
      expect(guia).toContain('intentarlo de nuevo');
    });

    it('conserva el motivo del servidor como detalle, no como mensaje principal', async () => {
      const el = await montar(exito({ error: true, message: 'Campo [signos] inválido' }));

      expect(el.querySelector('.envio__detalle')?.textContent).toContain('Campo [signos] inválido');
    });

    it('no inventa un detalle cuando el servidor no dio ninguno', async () => {
      const el = await montar(exito({ error: true, message: undefined }));

      expect(el.querySelector('.envio__detalle')).toBeNull();
    });

    it('dice a quién acudir si vuelve a fallar', async () => {
      const el = await montar(exito({ error: true, message: 'Timeout' }));

      expect(el.textContent).toContain('área administrativa');
    });

    it('devuelve error al cerrar, para no reiniciar el formulario', async () => {
      await montar(exito({ error: true, message: 'No se pudo guardar.' }));

      componente.close();

      expect(cerrar).toHaveBeenCalledWith('error');
    });
  });

  it('pasa de generando a enviado sin recrear el diálogo', async () => {
    const el = await montar({ loading: true, autorizacion: '99887766' });
    expect(el.querySelector('.envio__sello')).toBeNull();

    componente.updateData({ loading: false, error: false, message: 'Listo.' });
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    expect(el.querySelector('.envio__sello')?.textContent?.trim()).toBe('Enviado');
  });
});
