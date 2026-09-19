import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { PdfService } from './generar-pdf';
import { TrasladoDto } from '../models/traslado.dto';

/** 1×1 transparent PNG — stands in for a signature drawn on the pad. */
const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function buildDto(overrides: Partial<TrasladoDto> = {}): TrasladoDto {
  return {
    traslado: {
      fecha: '2026-03-14',
      codigo: 'SRV-1024',
      entidad: 'EPS Ejemplo',
      autorizadoPor: 'Ana Ruiz',
      autorizacionNumero: '99887766',
      movil: 'TAB-07',
      tipo: 'Asistencial básico',
      origen: 'Clínica Central',
      horaInicio: '08:15',
      destino: 'Hospital San José',
      horaFin: '09:40',
      retorno: true,
      trasladoFallido: false
    },
    paciente: {
      nombreCompleto: 'Juan Pérez Gómez',
      tipoDocumento: 'CC',
      numeroDocumento: '1023456789',
      sexo: 'Masculino',
      edad: 62,
      direccion: 'Calle 45 # 12-30',
      barrio: 'La Candelaria',
      ciudad: 'Bogotá',
      telefono: '3001234567',
      motivoTraslado: 'Control post-quirúrgico',
      tratamiento: 'Oxígeno por cánula nasal a 2 L/min'
    },
    antecedentes: {
      acv: false,
      alergia: true,
      artritis: false,
      asma: false,
      cancer: false,
      cardiacos: true,
      dislipidemia: false,
      epoc: false,
      fallaRenal: false,
      diabetes: true,
      ginecoObstetricos: false,
      hipertension: true,
      quirurgicos: false,
      psiquiatricos: false,
      otros: false,
      dxPrincipal: 'I10 - Hipertensión esencial'
    },
    signos: [
      {
        hora: '08:20',
        ta: '130/85',
        fc: 88,
        fr: 18,
        temperatura: 36.7,
        glicemia: 110,
        spo2: 96,
        glasgow: 15,
        dxSecundario: 'E11 - Diabetes mellitus tipo 2'
      },
      {
        hora: '09:10',
        ta: '125/80',
        fc: 84,
        fr: 17,
        temperatura: 36.5,
        glicemia: 104,
        spo2: 97,
        glasgow: 15,
        dxSecundario: 'Estable durante el trayecto'
      }
    ],
    examen: {
      cabeza: true,
      ojos: false,
      orl: false,
      cuello: false,
      cardiovascular: true,
      pulmonar: true,
      abdomen: false,
      gastrointestinal: false,
      genitourinario: false,
      extremidades: false,
      neurologico: false,
      psiquiatrico: false,
      descripcion: 'Paciente consciente, orientado, sin signos de dificultad respiratoria.'
    },
    gastos: [
      { descripcion: 'Oxígeno medicinal', cantidad: 2 },
      { descripcion: 'Electrodos', cantidad: 3 }
    ],
    conducta: {
      conducta: 'Se entrega en urgencias con reporte verbal al médico receptor.',
      horaInicioEspera: '09:40',
      horaFinEspera: '10:05',
      estadoEntrega: true
    },
    firmas: {
      medico: PNG_1PX,
      enfermeria: PNG_1PX,
      conductor: '',
      familiar: PNG_1PX,
      entidadReceptora: ''
    },
    ...overrides
  };
}

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('generates a PDF from the DTO', async () => {
    const result = await firstValueFrom(service.generatePdf(buildDto()));

    expect(result.fileName).toBe('historia-traslado-99887766-2026-03-14.pdf');
    // A base64 payload whose first bytes are the "%PDF" magic number.
    expect(atob(result.fileBase64).startsWith('%PDF')).toBe(true);
  }, 30000);

  /** Every `text` that the document definition puts on the page, flattened. */
  function textosDelDocumento(dto: TrasladoDto): string[] {
    const definition = (service as any).buildDocDefinition(dto, null, dto.firmas);
    const textos: string[] = [];

    const recorrer = (node: any): void => {
      if (Array.isArray(node)) {
        node.forEach(recorrer);
        return;
      }
      if (!node || typeof node !== 'object') {
        return;
      }
      if (typeof node.text === 'string') {
        textos.push(node.text);
      }
      [node.stack, node.columns, node.table?.body].forEach(recorrer);
    };

    recorrer(definition.content);
    return textos;
  }

  /**
   * The endpoint refuses an empty `signos`/`gastos`, so a failed transfer sends
   * its untouched starter row. Printing it would show "FC 0 · SpO₂ 0" as if the
   * measurement had been taken.
   */
  it('reports a blank starter row as "no se registró" instead of printing zeros', () => {
    const dto = buildDto({
      traslado: { ...buildDto().traslado, trasladoFallido: true },
      signos: [
        { hora: '01:00', ta: '', fc: 0, fr: 0, temperatura: 0, glicemia: 0, glasgow: 0, spo2: 0, dxSecundario: '' }
      ],
      gastos: [{ descripcion: '', cantidad: 0 }]
    });

    const textos = textosDelDocumento(dto);

    expect(textos).toContain('No se registraron signos vitales.');
    expect(textos).toContain('No se registraron gastos.');
    expect(textos).not.toContain('Glasgow');
  });

  it('does not declare a patient dead when the transfer failed', () => {
    const dto = buildDto({
      traslado: { ...buildDto().traslado, trasladoFallido: true },
      conducta: { ...buildDto().conducta, estadoEntrega: false }
    });

    const textos = textosDelDocumento(dto);

    expect(textos).not.toContain('Fallecido');
    expect(textos.some(texto => texto.startsWith('No aplica'))).toBe(true);
  });

  it('still reports the patient state the crew did record on a failed transfer', () => {
    const dto = buildDto({
      traslado: { ...buildDto().traslado, trasladoFallido: true },
      conducta: { ...buildDto().conducta, estadoEntrega: true }
    });

    expect(textosDelDocumento(dto)).toContain('Con vida');
  });

  it('keeps reporting "Fallecido" on a completed transfer', () => {
    const dto = buildDto({ conducta: { ...buildDto().conducta, estadoEntrega: false } });

    expect(textosDelDocumento(dto)).toContain('Fallecido');
  });

  it('prints the rows that do carry data', () => {
    const textos = textosDelDocumento(buildDto());

    expect(textos).not.toContain('No se registraron signos vitales.');
    expect(textos).toContain('130/85');
    expect(textos).toContain('Oxígeno medicinal');
  });

  it('still generates a PDF when optional sections are empty', async () => {
    const dto = buildDto({
      signos: [],
      gastos: [],
      firmas: { medico: '', enfermeria: '', conductor: '', familiar: '', entidadReceptora: '' }
    });

    const result = await firstValueFrom(service.generatePdf(dto));

    expect(atob(result.fileBase64).startsWith('%PDF')).toBe(true);
  }, 30000);
});
