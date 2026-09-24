import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Registro } from './registro';
import { ServicioService } from '../../../../services/servicio.service';
import { PdfService } from '../../../../services/generar-pdf';
import {
  TrasladoRegistradoService,
  RegistroTrasladoExistente,
  BitacoraError
} from '../../../../services/traslado-registrado';
import { TrasladoBloqueadoDialog } from '../../components/traslado-bloqueado-dialog/traslado-bloqueado-dialog';

describe('Registro', () => {
  let component: Registro;
  let fixture: ComponentFixture<Registro>;

  // Rendering the Firmas step instantiates FirmaPad, which observes its canvas.
  // jsdom ships no ResizeObserver, so stand one in that never fires.
  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registro],
      providers: [
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Registro);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  function setTrasladoFallido(value: boolean): void {
    component.form.get('traslado.trasladoFallido')!.setValue(value);
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires the whole record while the transfer is not marked failed', () => {
    expect(component.form.valid).toBe(false);
    expect(component.form.get('paciente.nombreCompleto')?.hasError('required')).toBe(true);
    expect(component.form.get('traslado.codigo')?.hasError('required')).toBe(true);
  });

  it('keeps Traslado and Paciente required on a failed transfer', () => {
    setTrasladoFallido(true);

    expect(component.trasladoGroup.valid).toBe(false);
    expect(component.pacienteGroup.valid).toBe(false);
    expect(component.form.get('traslado.codigo')?.hasError('required')).toBe(true);
    // origen/destino were exempt in the old subset rule; they are not any more.
    expect(component.form.get('traslado.origen')?.hasError('required')).toBe(true);
    expect(component.form.get('traslado.destino')?.hasError('required')).toBe(true);
    expect(component.form.get('paciente.nombreCompleto')?.hasError('required')).toBe(true);
  });

  it('exempts every clinical section on a failed transfer', () => {
    setTrasladoFallido(true);

    expect(component.antecedentesGroup.valid).toBe(true);
    expect(component.signosArray.valid).toBe(true);
    expect(component.examenGroup.valid).toBe(true);
    expect(component.gastoArray.valid).toBe(true);
    expect(component.conductaGroup.valid).toBe(true);
    expect(component.firmasGroup.valid).toBe(true);
  });

  it('accepts a failed transfer once Traslado and Paciente are filled in', () => {
    setTrasladoFallido(true);
    component.trasladoGroup.patchValue({
      codigo: 'SRV-1', entidad: 'EPS', autorizadoPor: 'Ana', autorizacionNumero: '99',
      movil: 'TAB-1', tipo: 'Básico', origen: 'Clínica', destino: 'Hospital'
    });
    component.pacienteGroup.patchValue({
      nombreCompleto: 'Juan Pérez', tipoDocumento: 'CC', numeroDocumento: '10234',
      sexo: 'M', edad: 62, direccion: 'Calle 1', barrio: 'Centro',
      ciudad: 'Bogotá', telefono: '3001234', motivoTraslado: 'Control', tratamiento: 'N/A'
    });

    expect(component.form.valid).toBe(true);
  });

  it('restores every validator when the transfer is unmarked again', () => {
    setTrasladoFallido(true);
    setTrasladoFallido(false);

    expect(component.form.valid).toBe(false);
    expect(component.form.get('paciente.nombreCompleto')?.hasError('required')).toBe(true);
    expect(component.form.get('traslado.codigo')?.hasError('required')).toBe(true);
    expect(component.form.get('firmas.medico')?.hasError('required')).toBe(true);
  });

  /**
   * Renders one step of the wizard and returns how many asterisks it shows.
   *
   * `detectChanges(false)` skips the check-no-changes pass: the app is zoneless
   * and the test drives `currentIndex` imperatively, which that pass reports as
   * NG0100 even though nothing is wrong.
   */
  function asteriscosEnPaso(index: number): number {
    component.currentIndex = index;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    return fixture.nativeElement.querySelectorAll('.required').length;
  }

  it('hides the asterisks of exempt sections on a failed transfer', () => {
    const antesAntecedentes = asteriscosEnPaso(2);
    const antesGastos = asteriscosEnPaso(5);
    expect(antesAntecedentes).toBeGreaterThan(0);
    expect(antesGastos).toBeGreaterThan(0);

    setTrasladoFallido(true);

    expect(asteriscosEnPaso(2)).toBe(0);
    expect(asteriscosEnPaso(5)).toBe(0);
  });

  it('keeps the asterisks of Traslado and Paciente on a failed transfer', () => {
    const traslado = asteriscosEnPaso(0);
    const paciente = asteriscosEnPaso(1);

    setTrasladoFallido(true);

    expect(asteriscosEnPaso(0)).toBe(traslado);
    expect(asteriscosEnPaso(1)).toBe(paciente);
  });

  it('brings the asterisks back when the transfer is unmarked again', () => {
    const original = asteriscosEnPaso(2);
    setTrasladoFallido(true);
    setTrasladoFallido(false);

    expect(asteriscosEnPaso(2)).toBe(original);
  });

  it('keeps rows added after the failed mark unvalidated', () => {
    setTrasladoFallido(true);
    component.agregarSignoVital();
    component.agregarGasto();

    expect(component.signosArray.valid).toBe(true);
    expect(component.gastoArray.valid).toBe(true);
  });

  /** Fills the two sections that stay required on a failed transfer. */
  function llenarTrasladoYPaciente(): void {
    component.trasladoGroup.patchValue({
      codigo: 'SRV-1', entidad: 'EPS', autorizadoPor: 'Ana', autorizacionNumero: '99',
      movil: 'TAB-1', tipo: 'Básico', origen: 'Clínica', destino: 'Hospital'
    });
    component.pacienteGroup.patchValue({
      nombreCompleto: 'Juan Pérez', tipoDocumento: 'CC', numeroDocumento: '10234',
      sexo: 'M', edad: 62, direccion: 'Calle 1', barrio: 'Centro',
      ciudad: 'Bogotá', telefono: '3001234', motivoTraslado: 'Control', tratamiento: 'N/A'
    });
  }

  it('sends Traslado and Paciente in the payload of a failed transfer', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();

    const dto = component.construirDto();

    expect(dto.traslado.trasladoFallido).toBe(true);
    expect(dto.traslado.codigo).toBe('SRV-1');
    expect(dto.traslado.autorizacionNumero).toBe('99');
    expect(dto.paciente.nombreCompleto).toBe('Juan Pérez');
    expect(dto.paciente.numeroDocumento).toBe('10234');
  });

  /**
   * `Traslado.guardar` answers 400 "El campo [signos] debe ser un arreglo con
   * al menos un elemento" on an empty array, so the starter row travels even
   * when the failed transfer left it untouched.
   */
  it('never sends signos or gastos as an empty array', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();

    const dto = component.construirDto();

    expect(dto.signos.length).toBeGreaterThan(0);
    expect(dto.gastos.length).toBeGreaterThan(0);
  });

  it('keeps the numeric signos/gasto fields even though they are disabled', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();

    const dto = component.construirDto();

    // form.value would drop these; construirDto() reads getRawValue().
    expect(dto.signos[0].fc).toBe(0);
    expect(dto.signos[0].spo2).toBe(0);
    expect(dto.gastos[0].cantidad).toBe(0);
  });

  /**
   * `Traslado.guardar` validates every free-text field as obligatory whatever
   * `trasladoFallido` says ("El campo [signos[0].ta] es obligatorio").
   */
  it('fills the skipped free-text fields in the payload of a failed transfer', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();

    const payload = component.construirPayload(component.construirDto());

    // `ta` has its own shape: the endpoint requires "sistolica/diastolica".
    expect(payload.signos[0].ta).toMatch(/^\d{2,3}\/\d{2,3}$/);
    expect(payload.signos[0].dxSecundario).toBeTruthy();
    expect(payload.gastos[0].descripcion).toBeTruthy();
    expect(payload.antecedentes.dxPrincipal).toBeTruthy();
    expect(payload.examen.descripcion).toBeTruthy();
    expect(payload.conducta.conducta).toBeTruthy();
  });

  it('leaves the PDF record untouched by that filler', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();

    const dto = component.construirDto();
    component.construirPayload(dto);

    // construirDto() feeds the PDF; it must keep showing "sin registro".
    expect(dto.signos[0].ta).toBe('');
    expect(dto.examen.descripcion).toBe('');
    expect(dto.conducta.conducta).toBe('');
  });

  /**
   * The third-party endpoint range-checks every vital with no exemption for a
   * failed transfer, so the skipped row travels with ordinary adult values.
   * The limits mirror the ones the form enforces in `crearSignoVital()`.
   */
  it('sends in-range vitals for a row the failed transfer skipped', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();

    const signo = component.construirPayload(component.construirDto()).signos[0];

    expect(Number(signo.fc)).toBeGreaterThanOrEqual(40);
    expect(Number(signo.fc)).toBeLessThanOrEqual(200);
    expect(Number(signo.fr)).toBeGreaterThanOrEqual(10);
    expect(Number(signo.fr)).toBeLessThanOrEqual(50);
    expect(Number(signo.temperatura)).toBeGreaterThanOrEqual(35);
    expect(Number(signo.temperatura)).toBeLessThanOrEqual(42);
    expect(Number(signo.glicemia)).toBeGreaterThanOrEqual(40);
    expect(Number(signo.glicemia)).toBeLessThanOrEqual(500);
    expect(Number(signo.spo2)).toBeGreaterThanOrEqual(80);
    expect(Number(signo.spo2)).toBeLessThanOrEqual(100);
    expect(Number(signo.glasgow)).toBeGreaterThanOrEqual(3);
    expect(Number(signo.glasgow)).toBeLessThanOrEqual(15);
    expect(Number(component.construirPayload(component.construirDto()).gastos[0].cantidad))
      .toBeGreaterThanOrEqual(0.01);
  });

  /** The row has to be identifiable as a placeholder wherever it is read. */
  it('labels the placeholder row as a failed transfer', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();

    const payload = component.construirPayload(component.construirDto());

    expect(payload.signos[0].dxSecundario).toContain('traslado fallido');
    expect(payload.traslado.trasladoFallido).toBe(true);
  });

  it('never fabricates a signature', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();

    const payload = component.construirPayload(component.construirDto());

    expect(payload.firmas.medico).toBe('');
    expect(payload.firmas.conductor).toBe('');
  });

  it('keeps the vitals the user did record', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();
    component.signosArray.at(0).patchValue({ ta: '140/90' });
    component.signosArray.at(0).get('fc')!.enable();
    component.signosArray.at(0).patchValue({ fc: 105 });

    const signo = component.construirPayload(component.construirDto()).signos[0];

    expect(signo.ta).toBe('140/90');
    expect(signo.fc).toBe(105);
  });

  it('does not overwrite a ta the user did fill in', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();
    component.signosArray.at(0).patchValue({ ta: '140/80' });

    const payload = component.construirPayload(component.construirDto());

    expect(payload.signos[0].ta).toBe('140/80');
  });

  it('sends a completed transfer through untouched', () => {
    llenarTrasladoYPaciente();
    component.signosArray.at(0).patchValue({ ta: '120/80', dxSecundario: 'Estable' });

    const dto = component.construirDto();

    expect(component.construirPayload(dto)).toBe(dto);
  });

  it('keeps signos and gastos that were actually filled in', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();
    component.signosArray.at(0).patchValue({ ta: '120/80', dxSecundario: 'Estable' });
    component.gastoArray.at(0).patchValue({ descripcion: 'Oxígeno', cantidad: 2 });

    const dto = component.construirDto();

    expect(dto.signos.length).toBe(1);
    expect(dto.signos[0].ta).toBe('120/80');
    expect(dto.gastos.length).toBe(1);
    expect(dto.gastos[0].descripcion).toBe('Oxígeno');
  });

  it('rejects a traslado whose end time falls before its start', () => {
    component.trasladoGroup.patchValue({ horaInicio: '10:00', horaFin: '09:00' });

    expect(component.trasladoGroup.hasError('rangoHorarioInvalido')).toBe(true);
    expect(component.sectionDone(0)).toBe(false);
  });

  it('accepts a traslado that ends at or after its start', () => {
    component.trasladoGroup.patchValue({ horaInicio: '09:00', horaFin: '09:00' });
    expect(component.trasladoGroup.hasError('rangoHorarioInvalido')).toBe(false);

    component.trasladoGroup.patchValue({ horaFin: '18:30' });
    expect(component.trasladoGroup.hasError('rangoHorarioInvalido')).toBe(false);
  });

  it('compares times as minutes, not as text', () => {
    // '9:00' sorts after '10:00' as a string; as minutes it does not.
    component.trasladoGroup.patchValue({ horaInicio: '9:00', horaFin: '10:00' });

    expect(component.trasladoGroup.hasError('rangoHorarioInvalido')).toBe(false);
  });

  it('rejects a wait whose end time falls before its start', () => {
    component.conductaGroup.patchValue({ horaInicioEspera: '14:45', horaFinEspera: '14:30' });

    expect(component.conductaGroup.hasError('rangoHorarioInvalido')).toBe(true);
  });

  it('reports both inverted ranges in the validation dialog', () => {
    component.trasladoGroup.patchValue({ horaInicio: '10:00', horaFin: '09:00' });
    component.conductaGroup.patchValue({ horaInicioEspera: '14:45', horaFinEspera: '14:30' });

    const errores = component['getFormErrors']();

    expect(errores).toContain('La hora de finalización del traslado no puede ser anterior a la hora de inicio');
    expect(errores).toContain('La hora de fin de espera no puede ser anterior a la hora de inicio de espera');
  });

  it('still enforces the traslado range on a failed transfer', () => {
    setTrasladoFallido(true);
    llenarTrasladoYPaciente();
    component.trasladoGroup.patchValue({ horaInicio: '10:00', horaFin: '09:00' });

    expect(component.trasladoGroup.hasError('rangoHorarioInvalido')).toBe(true);
    expect(component.form.valid).toBe(false);
  });

  it('exempts the conducta range on a failed transfer, like the rest of that section', () => {
    component.conductaGroup.patchValue({ horaInicioEspera: '14:45', horaFinEspera: '14:30' });
    setTrasladoFallido(true);

    expect(component.conductaGroup.valid).toBe(true);

    setTrasladoFallido(false);

    expect(component.conductaGroup.hasError('rangoHorarioInvalido')).toBe(true);
  });

  /** Labels of the buttons currently rendered in the bottom action bar. */
  function botonesDeAccion(): string[] {
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);
    return Array.from(
      fixture.nativeElement.querySelectorAll('.action-bar .btn') as NodeListOf<HTMLElement>
    ).map(btn => btn.textContent!.trim());
  }

  it('offers Finalizar from any step once the transfer is marked failed', () => {
    component.currentIndex = 0;
    expect(botonesDeAccion()).not.toContain('Finalizar');

    setTrasladoFallido(true);

    expect(botonesDeAccion()).toContain('Finalizar');
  });

  it('only offers Finalizar on the last step of a normal transfer', () => {
    component.currentIndex = 3;
    expect(botonesDeAccion()).not.toContain('Finalizar');

    component.currentIndex = 7;
    expect(botonesDeAccion()).toContain('Finalizar');
  });

  it('warns the user which sections are enough on a failed transfer', () => {
    component.currentIndex = 0;
    expect(botonesDeAccion()).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.traslado-fallido-aviso')).toBeNull();

    setTrasladoFallido(true);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges(false);

    const aviso = fixture.nativeElement.querySelector('.traslado-fallido-aviso') as HTMLElement;
    expect(aviso).toBeTruthy();
    expect(aviso.textContent).toContain('Traslado');
    expect(aviso.textContent).toContain('Paciente');
    expect(aviso.textContent).toContain('Finalizar');
  });
});

/**
 * Bitácora de traslados ya enviados: bloqueo al entrar con una autorización
 * registrada, y registro tras un envío exitoso.
 */
describe('Registro — bitácora de traslados', () => {
  let component: Registro;
  let fixture: ComponentFixture<Registro>;

  /** Lo que el diálogo de éxito recibió en cada `updateData()`. */
  let parchesDialogo: Record<string, unknown>[];
  let dialogosAbiertos: unknown[];
  let buscarServicio: ReturnType<typeof vi.fn>;
  let registrar: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  });

  interface Opciones {
    autorizacion?: string | null;
    /** Registro previo que la bitácora devuelve; `null` = autorización libre. */
    registroPrevio?: RegistroTrasladoExistente | null;
    /** La consulta a la bitácora falla (sin red, cuota agotada). */
    fallaConsulta?: boolean;
    /** Error con el que falla la escritura en la bitácora. */
    errorAlRegistrar?: unknown;
    guardarOk?: boolean;
  }

  async function montar(opciones: Opciones = {}): Promise<void> {
    const {
      autorizacion = null,
      registroPrevio = null,
      fallaConsulta = false,
      errorAlRegistrar = null,
      guardarOk = true
    } = opciones;

    parchesDialogo = [];
    dialogosAbiertos = [];

    buscarServicio = vi.fn(() => of({ autorizacion, entidad: 'EPS' } as never));
    registrar = vi.fn(() =>
      errorAlRegistrar ? throwError(() => errorAlRegistrar) : (of(undefined) as Observable<void>)
    );

    const dialogFalso = {
      open: (componente: unknown) => {
        dialogosAbiertos.push(componente);
        return {
          componentInstance: {
            updateData: (parche: Record<string, unknown>) => parchesDialogo.push(parche)
          },
          afterClosed: () => of(null),
          close: () => {}
        };
      }
    };

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Registro],
      providers: [
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => autorizacion } } }
        },
        {
          provide: ServicioService,
          useValue: {
            buscarServicio,
            guardarTraslado: () => of({ ok: guardarOk, codigo: 200, mensaje: 'Guardado' })
          }
        },
        {
          provide: PdfService,
          useValue: { generatePdf: () => of({ fileName: 't.pdf', fileBase64: 'JVBERi0=' }) }
        },
        {
          provide: TrasladoRegistradoService,
          useValue: {
            buscarRegistro: () =>
              fallaConsulta ? throwError(() => new Error('sin red')) : of(registroPrevio),
            registrar
          }
        }
      ]
    });

    // `Registro` importa MatDialogModule, y los providers de ese módulo ganan
    // sobre un override del TestBed. El doble tiene que entrar en el inyector
    // del propio componente.
    TestBed.overrideComponent(Registro, {
      add: { providers: [{ provide: MatDialog, useValue: dialogFalso }] }
    });

    await TestBed.compileComponents();

    fixture = TestBed.createComponent(Registro);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  /**
   * Deja el formulario en estado válido para poder finalizar.
   *
   * Incluye `fecha` porque al montar con una autorización libre el componente
   * consulta el servicio externo, y la respuesta del doble la sobreescribe.
   */
  function llenarFormularioMinimo(): void {
    component.form.get('traslado.trasladoFallido')!.setValue(true);
    component.trasladoGroup.patchValue({
      fecha: '2026-03-14',
      codigo: 'SRV-1', entidad: 'EPS', autorizadoPor: 'Ana', autorizacionNumero: '99887766',
      movil: 'TAB-1', tipo: 'Básico', origen: 'Clínica', destino: 'Hospital'
    });
    component.pacienteGroup.patchValue({
      nombreCompleto: 'Juan Pérez', tipoDocumento: 'CC', numeroDocumento: '10234',
      sexo: 'M', edad: 62, direccion: 'Calle 1', barrio: 'Centro',
      ciudad: 'Bogotá', telefono: '3001234', motivoTraslado: 'Control', tratamiento: 'N/A'
    });
  }

  describe('al entrar con una autorización en la URL', () => {

    it('bloquea el formulario cuando el traslado ya fue registrado', async () => {
      await montar({
        autorizacion: '99887766',
        registroPrevio: { autorizacion: '99887766', registradoEn: new Date('2026-03-14T15:04:05Z') }
      });

      expect(component.bloqueado).toBe(true);
      expect(component.form.disabled).toBe(true);
      expect(dialogosAbiertos).toContain(TrasladoBloqueadoDialog);
    });

    it('no consulta el servicio externo cuando ya está registrado', async () => {
      await montar({
        autorizacion: '99887766',
        registroPrevio: { autorizacion: '99887766', registradoEn: new Date() }
      });

      expect(buscarServicio).not.toHaveBeenCalled();
      expect(component.trasladoGroup.get('entidad')?.value).toBeFalsy();
    });

    it('permite diligenciar con normalidad cuando la autorización está libre', async () => {
      await montar({ autorizacion: '99887766', registroPrevio: null });

      expect(component.bloqueado).toBe(false);
      expect(component.form.disabled).toBe(false);
      expect(buscarServicio).toHaveBeenCalledWith('99887766');
    });

    it('no bloquea si la bitácora no se puede consultar', async () => {
      await montar({ autorizacion: '99887766', fallaConsulta: true });

      expect(component.bloqueado).toBe(false);
      expect(buscarServicio).toHaveBeenCalledWith('99887766');
    });

    it('no consulta la bitácora cuando la URL no trae autorización', async () => {
      await montar({ autorizacion: null });

      expect(component.bloqueado).toBe(false);
      expect(buscarServicio).not.toHaveBeenCalled();
    });
  });

  /**
   * Envía el formulario y espera a que la cadena termine.
   *
   * No usa `fixture.whenStable()`: su pase de comprobación de cambios reporta
   * NG0100 porque el test modifica el formulario de forma imperativa, igual que
   * en los tests de asteriscos de más arriba. Los dobles son sincrónicos, así
   * que un turno de microtareas es suficiente.
   */
  async function finalizarYEsperar(): Promise<void> {
    component.finalizar();
    await Promise.resolve();
  }

  describe('al finalizar', () => {

    it('registra el traslado en la bitácora tras un envío exitoso', async () => {
      await montar({ autorizacion: '99887766' });
      llenarFormularioMinimo();

      await finalizarYEsperar();

      expect(registrar).toHaveBeenCalledTimes(1);
      expect(registrar.mock.calls[0][0]).toBe('99887766');
    });

    it('le pasa a la bitácora el mismo objeto que se envió al servicio externo', async () => {
      await montar({ autorizacion: '99887766' });
      llenarFormularioMinimo();

      await finalizarYEsperar();

      const enviado = registrar.mock.calls[0][1] as Record<string, unknown>;
      expect(enviado['pdfHistoria']).toBe('JVBERi0=');
      expect(enviado['traslado']).toBeTruthy();
      expect(enviado['paciente']).toBeTruthy();
    });

    it('avisa sin dar el envío por fallido cuando la bitácora no acepta la escritura', async () => {
      await montar({
        autorizacion: '99887766',
        errorAlRegistrar: new BitacoraError('desconocido', 'sin red')
      });
      llenarFormularioMinimo();

      await finalizarYEsperar();

      const final = parchesDialogo.at(-1)!;
      expect(final['error']).toBe(false);
      expect(final['warning']).toBeTruthy();
    });

    it('dice que ya estaba registrado cuando la bitácora reporta un duplicado', async () => {
      await montar({
        autorizacion: '99887766',
        errorAlRegistrar: new BitacoraError('duplicado', 'ya estaba')
      });
      llenarFormularioMinimo();

      await finalizarYEsperar();

      expect(String(parchesDialogo.at(-1)!['warning'])).toContain('ya');
    });

    it('no registra nada si el servicio externo no confirmó el guardado', async () => {
      await montar({ autorizacion: '99887766', guardarOk: false });
      llenarFormularioMinimo();

      await finalizarYEsperar();

      expect(registrar).not.toHaveBeenCalled();
      expect(parchesDialogo.at(-1)!['error']).toBe(true);
    });

    it('no envía nada mientras el formulario está bloqueado', async () => {
      await montar({
        autorizacion: '99887766',
        registroPrevio: { autorizacion: '99887766', registradoEn: new Date() }
      });

      await finalizarYEsperar();

      expect(registrar).not.toHaveBeenCalled();
      expect(parchesDialogo.length).toBe(0);
    });
  });
});
