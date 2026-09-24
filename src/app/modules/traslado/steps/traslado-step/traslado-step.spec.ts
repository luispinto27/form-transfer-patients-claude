import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup } from '@angular/forms';

import { TrasladoStep } from './traslado-step';

describe('TrasladoStep', () => {
  let component: TrasladoStep;
  let fixture: ComponentFixture<TrasladoStep>;
  let group: FormGroup;

  /**
   * Monta el paso con un grupo ya diligenciado, como cuando el operador vuelve
   * atrás desde otro paso: `Registro` usa `*ngSwitch`, así que el componente se
   * destruye y se vuelve a crear con el formulario ya lleno.
   */
  async function montarCon(valores: Record<string, unknown>): Promise<void> {
    const fb = new FormBuilder();
    group = fb.group({
      fecha: [''], codigo: [''], entidad: [''], autorizadoPor: [''],
      autorizacionNumero: [''], movil: [''], tipo: [''],
      origen: [''], destino: [''],
      horaInicio: ['01:00'], horaFin: ['01:00'],
      retorno: [false], trasladoFallido: [false],
      ...valores
    });

    await TestBed.configureTestingModule({ imports: [TrasladoStep] }).compileComponents();

    fixture = TestBed.createComponent(TrasladoStep);
    component = fixture.componentInstance;
    component.group = group;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  /** Los selects de hora/minutos, en orden de aparición. */
  function selects(): HTMLSelectElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('.hora-selector select') as NodeListOf<HTMLSelectElement>
    );
  }

  it('should create', async () => {
    await montarCon({});

    expect(component).toBeTruthy();
  });

  it('muestra la hora que ya tenía el formulario al volver al paso', async () => {
    await montarCon({ horaInicio: ['14:30'] });

    const [hora, minutos] = selects();
    expect(hora.value).toBe('14');
    expect(minutos.value).toBe('30');
  });

  it('muestra la hora de finalización que ya tenía el formulario', async () => {
    await montarCon({ horaFin: ['18:45'] });

    // Los dos primeros selects son de horaInicio; los dos siguientes, de horaFin.
    const [, , hora, minutos] = selects();
    expect(hora.value).toBe('18');
    expect(minutos.value).toBe('45');
  });

  it('no altera el valor del formulario al volver al paso', async () => {
    await montarCon({ horaInicio: ['14:30'] });

    expect(group.get('horaInicio')?.value).toBe('14:30');
  });
});
