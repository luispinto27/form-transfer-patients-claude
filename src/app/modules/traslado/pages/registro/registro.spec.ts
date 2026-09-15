import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import { Registro } from './registro';

describe('Registro', () => {
  let component: Registro;
  let fixture: ComponentFixture<Registro>;

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
});
