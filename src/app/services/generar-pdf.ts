import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, from } from 'rxjs';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  AntecedentesSectionDto,
  ConductaSectionDto,
  ExamenSectionDto,
  FirmasSectionDto,
  GastoDto,
  PacienteSectionDto,
  SignoVitalDto,
  TrasladoDto,
  TrasladoSectionDto
} from '../models/traslado.dto';

export interface GeneratePdfResponse {
  fileName: string;
  fileBase64: string;
}

type PdfMake = typeof import('pdfmake/build/pdfmake');

/** Label for every checkbox in the "Antecedentes" section, in display order. */
const ANTECEDENTES_LABELS: ReadonlyArray<[keyof AntecedentesSectionDto, string]> = [
  ['acv', 'ACV'],
  ['alergia', 'Alergia'],
  ['artritis', 'Artritis'],
  ['asma', 'Asma'],
  ['cancer', 'Cáncer'],
  ['cardiacos', 'Cardíacos'],
  ['dislipidemia', 'Dislipidemia'],
  ['epoc', 'EPOC'],
  ['fallaRenal', 'Falla renal'],
  ['diabetes', 'Diabetes'],
  ['ginecoObstetricos', 'Gineco-obstétricos'],
  ['hipertension', 'Hipertensión'],
  ['quirurgicos', 'Quirúrgicos'],
  ['psiquiatricos', 'Psiquiátricos'],
  ['otros', 'Otros']
];

/** Label for every checkbox in the "Examen físico" section, in display order. */
const EXAMEN_LABELS: ReadonlyArray<[keyof ExamenSectionDto, string]> = [
  ['cabeza', 'Cabeza'],
  ['ojos', 'Ojos'],
  ['orl', 'ORL'],
  ['cuello', 'Cuello'],
  ['cardiovascular', 'Cardiovascular'],
  ['pulmonar', 'Pulmonar'],
  ['abdomen', 'Abdomen'],
  ['gastrointestinal', 'Gastrointestinal'],
  ['genitourinario', 'Genitourinario'],
  ['extremidades', 'Extremidades'],
  ['neurologico', 'Neurológico'],
  ['psiquiatrico', 'Psiquiátrico']
];

const FIRMAS_LABELS: ReadonlyArray<[keyof FirmasSectionDto, string]> = [
  ['medico', 'Médico'],
  ['enfermeria', 'Enfermería'],
  ['conductor', 'Conductor'],
  ['familiar', 'Familiar / Paciente'],
  ['entidadReceptora', 'Entidad receptora']
];

const COLORS = {
  brand: '#0f4c81',
  sectionBg: '#0f4c81',
  sectionText: '#ffffff',
  label: '#4b5563',
  value: '#111827',
  border: '#d1d5db',
  rowAlt: '#f3f4f6',
  danger: '#b91c1c',
  dangerBg: '#fee2e2',
  checked: '#0f4c81',
  muted: '#9ca3af'
};

const LOGO_URL = '/logo-contacto724.png';

/**
 * Fields that make a row of `signos` worth printing. `hora` is left out on
 * purpose: the form pre-fills it with '01:00', so it would keep every
 * untouched row alive.
 */
const SIGNOS_CAMPOS_CON_DATO: ReadonlyArray<keyof SignoVitalDto> =
  ['ta', 'fc', 'fr', 'temperatura', 'glicemia', 'spo2', 'glasgow', 'dxSecundario'];

const GASTO_CAMPOS_CON_DATO: ReadonlyArray<keyof GastoDto> = ['descripcion', 'cantidad'];

/**
 * Both arrays reach the PDF with at least one row because the endpoint refuses
 * an empty one, so on a failed transfer the starter row arrives full of empty
 * strings and the zeros the form writes into the disabled numeric fields.
 * Printing it would put "FC 0 · SpO₂ 0" in a clinical record, which reads as a
 * measurement that was taken. These rows are dropped so the section prints its
 * "no se registró" notice instead.
 *
 * On a completed transfer every row is validated before it gets here, so they
 * all carry data and all of them are kept.
 */
function filasConDatos<T>(rows: T[] | undefined, campos: ReadonlyArray<keyof T>): T[] {
  return (Array.isArray(rows) ? rows : []).filter(row =>
    campos.some(campo => tieneDato(row?.[campo]))
  );
}

function tieneDato(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
}

/** Formats pdfmake can embed directly; anything else is re-encoded to PNG. */
const EMBEDDABLE_IMAGE = /^data:image\/(png|jpeg|jpg);base64,/i;

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  private readonly platformId = inject(PLATFORM_ID);

  /** pdfmake weighs ~1 MB with its fonts, so it is loaded once, on demand. */
  private pdfMakePromise?: Promise<PdfMake>;
  private logoPromise?: Promise<string | null>;

  /**
   * Builds the "Historia de traslado" PDF entirely in the browser.
   *
   * Returns the same `{ fileName, fileBase64 }` shape the backend endpoint used
   * to return, so callers can keep downloading it and posting `fileBase64` as
   * `pdfHistoria` without any change.
   */
  generatePdf(dto: TrasladoDto): Observable<GeneratePdfResponse> {
    return from(this.buildPdf(dto));
  }

  private async buildPdf(dto: TrasladoDto): Promise<GeneratePdfResponse> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('La generación del PDF sólo está disponible en el navegador.');
    }

    const [pdfMake, logo, firmas] = await Promise.all([
      this.loadPdfMake(),
      this.loadLogo(),
      this.normalizeFirmas(dto.firmas)
    ]);

    const definition = this.buildDocDefinition(dto, logo, firmas);
    const fileBase64 = await pdfMake.createPdf(definition).getBase64();

    return { fileName: this.buildFileName(dto.traslado), fileBase64 };
  }

  // ---------------------------------------------------------------------------
  // Lazy dependencies
  // ---------------------------------------------------------------------------

  private loadPdfMake(): Promise<PdfMake> {
    this.pdfMakePromise ??= (async () => {
      // The prebuilt browser bundles are UMD; take `default` when the bundler
      // wraps them, and the namespace itself when it does not.
      const [pdfMakeModule, vfsModule] = await Promise.all([
        import('pdfmake/build/pdfmake'),
        import('pdfmake/build/vfs_fonts')
      ]);

      const pdfMake = ((pdfMakeModule as any).default ?? pdfMakeModule) as PdfMake;
      const vfs = (vfsModule as any).default ?? vfsModule;
      pdfMake.addVirtualFileSystem(vfs);

      return pdfMake;
    })();

    return this.pdfMakePromise;
  }

  /** The logo is decorative: a failed fetch must not block the document. */
  private loadLogo(): Promise<string | null> {
    this.logoPromise ??= (async () => {
      try {
        const response = await fetch(LOGO_URL);
        if (!response.ok) {
          return null;
        }
        return await this.blobToDataUrl(await response.blob());
      } catch {
        return null;
      }
    })();

    return this.logoPromise;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(blob);
    });
  }

  // ---------------------------------------------------------------------------
  // Signatures
  // ---------------------------------------------------------------------------

  /**
   * Signatures drawn on the pad are already PNG, but an uploaded file can be
   * any `image/*` (WebP, GIF…). pdfmake only embeds PNG and JPEG, and a single
   * unsupported image aborts the whole document — so re-encode anything else
   * through a canvas before it reaches the doc definition.
   */
  private async normalizeFirmas(firmas: FirmasSectionDto): Promise<FirmasSectionDto> {
    const entries = await Promise.all(
      FIRMAS_LABELS.map(async ([key]) => [key, await this.normalizeSignature(firmas?.[key])] as const)
    );

    return Object.fromEntries(entries) as unknown as FirmasSectionDto;
  }

  private async normalizeSignature(value: string | undefined): Promise<string> {
    if (!value?.startsWith('data:image/')) {
      return '';
    }
    if (EMBEDDABLE_IMAGE.test(value)) {
      return value;
    }

    try {
      const image = await this.loadImage(value);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || 600;
      canvas.height = image.naturalHeight || 200;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return '';
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Imagen de firma inválida.'));
      image.src = src;
    });
  }

  // ---------------------------------------------------------------------------
  // Document definition
  // ---------------------------------------------------------------------------

  private buildDocDefinition(
    dto: TrasladoDto,
    logo: string | null,
    firmas: FirmasSectionDto
  ): TDocumentDefinitions {
    const { traslado } = dto;

    return {
      pageSize: 'A4',
      pageMargins: [32, 82, 32, 44],
      info: {
        title: `Historia de traslado ${this.text(traslado?.autorizacionNumero)}`,
        author: 'Contacto 724',
        subject: 'Registro de traslado asistencial de pacientes'
      },
      defaultStyle: { font: 'Roboto', fontSize: 9, color: COLORS.value, lineHeight: 1.2 },
      styles: {
        docTitle: { fontSize: 15, bold: true, color: COLORS.brand },
        docSubtitle: { fontSize: 8, color: COLORS.label },
        sectionTitle: { fontSize: 10, bold: true, color: COLORS.sectionText },
        label: { fontSize: 7.5, color: COLORS.label, bold: true },
        value: { fontSize: 9, color: COLORS.value },
        tableHeader: { fontSize: 8, bold: true, color: COLORS.sectionText, fillColor: COLORS.brand },
        note: { fontSize: 8, color: COLORS.label, italics: true }
      },
      header: (currentPage: number) => this.buildPageHeader(traslado, logo, currentPage),
      footer: (currentPage: number, pageCount: number) => ({
        margin: [32, 12, 32, 0],
        columns: [
          { text: `Generado el ${this.now()}`, fontSize: 7, color: COLORS.muted },
          {
            text: `Página ${currentPage} de ${pageCount}`,
            fontSize: 7,
            color: COLORS.muted,
            alignment: 'right'
          }
        ]
      }),
      content: [
        ...this.failedTransferBanner(traslado),
        ...this.trasladoSection(traslado),
        ...this.pacienteSection(dto.paciente),
        ...this.antecedentesSection(dto.antecedentes),
        ...this.signosSection(dto.signos),
        ...this.examenSection(dto.examen),
        ...this.gastosSection(dto.gastos),
        ...this.conductaSection(dto.conducta, !!traslado?.trasladoFallido),
        ...this.firmasSection(firmas)
      ]
    };
  }

  private buildPageHeader(
    traslado: TrasladoSectionDto,
    logo: string | null,
    currentPage: number
  ): Content {
    const identity: Content = {
      stack: [
        { text: 'Historia de traslado asistencial', style: 'docTitle' },
        {
          text: `Autorización N.º ${this.text(traslado?.autorizacionNumero)}  ·  Código ${this.text(traslado?.codigo)}`,
          style: 'docSubtitle',
          margin: [0, 2, 0, 0]
        }
      ]
    };

    return {
      margin: [32, 22, 32, 0],
      stack: [
        {
          columns: logo
            ? [{ image: logo, fit: [110, 34] }, { ...identity, alignment: 'right' }]
            : [identity],
          columnGap: 12
        },
        {
          canvas: [
            { type: 'line', x1: 0, y1: 8, x2: 531, y2: 8, lineWidth: 1.2, lineColor: COLORS.brand }
          ]
        },
        ...(currentPage > 1
          ? [{ text: '(continuación)', style: 'note', margin: [0, 4, 0, 0] } as Content]
          : [])
      ]
    };
  }

  private failedTransferBanner(traslado: TrasladoSectionDto): Content[] {
    if (!traslado?.trasladoFallido) {
      return [];
    }

    return [
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: 'TRASLADO FALLIDO — el servicio no se completó; las secciones asistenciales pueden estar vacías.',
                bold: true,
                fontSize: 9,
                color: COLORS.danger,
                fillColor: COLORS.dangerBg,
                margin: [8, 6, 8, 6]
              }
            ]
          ]
        },
        layout: 'noBorders',
        margin: [0, 0, 0, 10]
      }
    ];
  }

  // --- 1. Traslado -----------------------------------------------------------

  private trasladoSection(traslado: TrasladoSectionDto): Content[] {
    return [
      this.sectionTitle('1. Datos del traslado'),
      this.fieldGrid([
        ['Fecha', this.date(traslado?.fecha)],
        ['Código', this.text(traslado?.codigo)],
        ['Entidad', this.text(traslado?.entidad)],
        ['Autorizado por', this.text(traslado?.autorizadoPor)],
        ['N.º de autorización', this.text(traslado?.autorizacionNumero)],
        ['Móvil', this.text(traslado?.movil)],
        ['Tipo de traslado', this.text(traslado?.tipo)],
        ['Retorno', this.bool(traslado?.retorno)],
        ['Origen', this.text(traslado?.origen)],
        ['Hora de inicio', this.text(traslado?.horaInicio)],
        ['Destino', this.text(traslado?.destino)],
        ['Hora de finalización', this.text(traslado?.horaFin)]
      ])
    ];
  }

  // --- 2. Paciente -----------------------------------------------------------

  private pacienteSection(paciente: PacienteSectionDto): Content[] {
    return [
      this.sectionTitle('2. Datos del paciente'),
      this.fieldGrid([
        ['Nombre completo', this.text(paciente?.nombreCompleto)],
        ['Sexo', this.text(paciente?.sexo)],
        ['Tipo de documento', this.text(paciente?.tipoDocumento)],
        ['N.º de documento', this.text(paciente?.numeroDocumento)],
        ['Edad', this.text(paciente?.edad)],
        ['Teléfono', this.text(paciente?.telefono)],
        ['Dirección', this.text(paciente?.direccion)],
        ['Barrio', this.text(paciente?.barrio)],
        ['Ciudad', this.text(paciente?.ciudad)]
      ]),
      this.longText('Motivo del traslado', paciente?.motivoTraslado),
      this.longText('Tratamiento', paciente?.tratamiento)
    ];
  }

  // --- 3. Antecedentes -------------------------------------------------------

  private antecedentesSection(antecedentes: AntecedentesSectionDto): Content[] {
    return [
      // Title and grid travel together: a header stranded at the foot of a page
      // with two checkboxes under it reads as a different section.
      {
        stack: [
          this.sectionTitle('3. Antecedentes'),
          this.checkboxGrid(ANTECEDENTES_LABELS.map(([key, label]) => [label, !!antecedentes?.[key]]))
        ],
        unbreakable: true
      },
      this.longText('Diagnóstico principal', antecedentes?.dxPrincipal)
    ];
  }

  // --- 4. Signos vitales -----------------------------------------------------

  private signosSection(signos: SignoVitalDto[]): Content[] {
    const rows = filasConDatos(signos, SIGNOS_CAMPOS_CON_DATO);

    if (rows.length === 0) {
      return [this.sectionTitle('4. Signos vitales'), this.emptyNotice('No se registraron signos vitales.')];
    }

    const headers = ['Hora', 'TA', 'FC', 'FR', 'T. °C', 'Glicemia', 'SpO₂', 'Glasgow', 'Dx secundario'];

    return [
      this.sectionTitle('4. Signos vitales'),
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: [34, 40, 26, 26, 34, 44, 32, 44, '*'],
          body: [
            headers.map<TableCell>(header => ({
              text: header,
              style: 'tableHeader',
              margin: [3, 4, 3, 4]
            })),
            ...rows.map<TableCell[]>((signo, index) =>
              [
                this.text(signo?.hora),
                this.text(signo?.ta),
                this.text(signo?.fc),
                this.text(signo?.fr),
                this.text(signo?.temperatura),
                this.text(signo?.glicemia),
                this.text(signo?.spo2),
                this.text(signo?.glasgow),
                this.text(signo?.dxSecundario)
              ].map<TableCell>(value => ({
                text: value,
                fontSize: 8,
                margin: [3, 3, 3, 3],
                fillColor: index % 2 === 1 ? COLORS.rowAlt : undefined
              }))
            )
          ]
        },
        layout: this.gridLayout(),
        margin: [0, 0, 0, 10]
      }
    ];
  }

  // --- 5. Examen físico ------------------------------------------------------

  private examenSection(examen: ExamenSectionDto): Content[] {
    return [
      {
        stack: [
          this.sectionTitle('5. Examen físico'),
          this.checkboxGrid(EXAMEN_LABELS.map(([key, label]) => [label, !!examen?.[key]]))
        ],
        unbreakable: true
      },
      this.longText('Descripción', examen?.descripcion)
    ];
  }

  // --- 6. Gastos -------------------------------------------------------------

  private gastosSection(gastos: GastoDto[]): Content[] {
    const rows = filasConDatos(gastos, GASTO_CAMPOS_CON_DATO);

    if (rows.length === 0) {
      return [this.sectionTitle('6. Registro de gastos'), this.emptyNotice('No se registraron gastos.')];
    }

    const total = rows.reduce((sum, gasto) => sum + (Number(gasto?.cantidad) || 0), 0);

    return [
      this.sectionTitle('6. Registro de gastos'),
      {
        table: {
          headerRows: 1,
          widths: ['*', 80],
          body: [
            [
              { text: 'Descripción', style: 'tableHeader', margin: [4, 4, 4, 4] },
              { text: 'Cantidad', style: 'tableHeader', margin: [4, 4, 4, 4], alignment: 'right' }
            ],
            ...rows.map<TableCell[]>((gasto, index) => [
              {
                text: this.text(gasto?.descripcion),
                fontSize: 8,
                margin: [4, 3, 4, 3],
                fillColor: index % 2 === 1 ? COLORS.rowAlt : undefined
              },
              {
                text: this.number(gasto?.cantidad),
                fontSize: 8,
                alignment: 'right',
                margin: [4, 3, 4, 3],
                fillColor: index % 2 === 1 ? COLORS.rowAlt : undefined
              }
            ]),
            [
              { text: 'Total', bold: true, fontSize: 8, margin: [4, 3, 4, 3], alignment: 'right' },
              { text: this.number(total), bold: true, fontSize: 8, alignment: 'right', margin: [4, 3, 4, 3] }
            ]
          ]
        },
        layout: this.gridLayout(),
        margin: [0, 0, 0, 10]
      }
    ];
  }

  // --- 7. Conducta -----------------------------------------------------------

  private conductaSection(conducta: ConductaSectionDto, trasladoFallido: boolean): Content[] {
    return [
      this.sectionTitle('7. Conducta'),
      this.fieldGrid([
        ['Hora de inicio de espera', this.text(conducta?.horaInicioEspera)],
        ['Hora de fin de espera', this.text(conducta?.horaFinEspera)],
        ['Estado del paciente', this.estadoPaciente(conducta, trasladoFallido)]
      ]),
      this.longText('Conducta', conducta?.conducta)
    ];
  }

  /**
   * The form asks for this as a single checkbox: ticked is "Con vida",
   * unticked is "Fallecido". On a failed transfer nobody reached the patient
   * and nobody ticks
   * it, so the default would print the gravest possible statement about a
   * patient no one assessed. A crew that did tick it is still believed.
   */
  private estadoPaciente(conducta: ConductaSectionDto, trasladoFallido: boolean): string {
    if (trasladoFallido && !conducta?.estadoEntrega) {
      return 'No aplica - traslado fallido';
    }
    return conducta?.estadoEntrega ? 'Con vida' : 'Fallecido';
  }

  // --- 8. Firmas -------------------------------------------------------------

  private firmasSection(firmas: FirmasSectionDto): Content[] {
    const cells = FIRMAS_LABELS.map(([key, label]) => this.signatureCell(label, firmas?.[key]));

    // Three per row keeps each signature wide enough to stay legible; the last
    // row is padded so pdfmake always receives a rectangular table body.
    const perRow = 3;
    const body: Content[][] = [];
    for (let i = 0; i < cells.length; i += perRow) {
      const row = cells.slice(i, i + perRow);
      while (row.length < perRow) {
        row.push({ text: '' });
      }
      body.push(row);
    }

    return [
      this.sectionTitle('8. Firmas'),
      {
        table: { widths: Array(perRow).fill('*'), body },
        layout: 'noBorders',
        margin: [0, 0, 0, 4]
      }
    ];
  }

  /**
   * A fixed-height row holds the signature so the rule and the caption line up
   * across the grid no matter how tall or wide each drawn signature is.
   */
  private signatureCell(label: string, dataUrl: string | undefined): Content {
    const signature: Content = dataUrl
      ? { image: dataUrl, fit: [150, 50], alignment: 'center', margin: [0, 3, 0, 0] }
      : { text: 'Sin firma', style: 'note', alignment: 'center', margin: [0, 21, 0, 0] };

    return {
      table: {
        widths: ['*'],
        heights: [56, 'auto'],
        body: [
          [signature],
          [{ text: label, style: 'label', alignment: 'center', margin: [0, 4, 0, 0] }]
        ]
      },
      layout: {
        // Only the rule between signature and caption is drawn: that is the
        // signature line itself.
        hLineWidth: (i: number) => (i === 1 ? 0.8 : 0),
        vLineWidth: () => 0,
        hLineColor: () => COLORS.border,
        paddingTop: () => 0,
        paddingBottom: () => 0,
        paddingLeft: () => 6,
        paddingRight: () => 6
      },
      margin: [0, 0, 0, 14]
    };
  }

  // ---------------------------------------------------------------------------
  // Layout primitives
  // ---------------------------------------------------------------------------

  private sectionTitle(title: string): Content {
    return {
      table: {
        widths: ['*'],
        body: [[{ text: title, style: 'sectionTitle', fillColor: COLORS.sectionBg, margin: [8, 4, 8, 4] }]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 6],
      unbreakable: true
    };
  }

  /** Two label/value pairs per row, borderless with a hairline under each row. */
  private fieldGrid(fields: ReadonlyArray<[string, string]>): Content {
    const body: Content[][] = [];

    for (let i = 0; i < fields.length; i += 2) {
      body.push([...this.fieldCells(fields[i]), ...this.fieldCells(fields[i + 1])]);
    }

    return {
      table: { widths: ['auto', '*', 'auto', '*'], body },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => COLORS.border,
        paddingTop: () => 3,
        paddingBottom: () => 3,
        paddingLeft: () => 0,
        paddingRight: () => 8
      },
      margin: [0, 0, 0, 10]
    };
  }

  private fieldCells(field: [string, string] | undefined): Content[] {
    if (!field) {
      return [{ text: '' }, { text: '' }];
    }
    return [
      { text: `${field[0]}:`, style: 'label' },
      { text: field[1], style: 'value' }
    ];
  }

  /** Checkbox marks are drawn as vector squares so they never depend on glyphs. */
  private checkboxGrid(items: ReadonlyArray<[string, boolean]>): Content {
    const perRow = 4;
    const body: Content[][] = [];

    for (let i = 0; i < items.length; i += perRow) {
      const row = items.slice(i, i + perRow).map(([label, checked]) => this.checkboxCell(label, checked));
      while (row.length < perRow) {
        row.push({ text: '' });
      }
      body.push(row);
    }

    return {
      table: { widths: Array(perRow).fill('*'), body },
      layout: 'noBorders',
      margin: [0, 0, 0, 8]
    };
  }

  private checkboxCell(label: string, checked: boolean): Content {
    return {
      columns: [
        {
          width: 14,
          canvas: [
            {
              type: 'rect',
              x: 0,
              y: 1.5,
              w: 7,
              h: 7,
              lineWidth: 0.8,
              lineColor: checked ? COLORS.checked : COLORS.border,
              color: checked ? COLORS.checked : '#ffffff'
            }
          ]
        },
        { text: label, fontSize: 8, color: checked ? COLORS.value : COLORS.label }
      ],
      margin: [0, 1.5, 0, 1.5]
    };
  }

  private longText(label: string, value: string | undefined): Content {
    return {
      stack: [
        { text: label.toUpperCase(), style: 'label' },
        {
          text: this.text(value),
          style: 'value',
          margin: [0, 2, 0, 0]
        }
      ],
      margin: [0, 0, 0, 10]
    };
  }

  private emptyNotice(message: string): Content {
    return { text: message, style: 'note', margin: [0, 0, 0, 10] };
  }

  private gridLayout() {
    return {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => COLORS.border,
      vLineColor: () => COLORS.border
    };
  }

  // ---------------------------------------------------------------------------
  // Value formatting
  // ---------------------------------------------------------------------------

  private text(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }
    const asText = String(value).trim();
    return asText.length > 0 ? asText : '—';
  }

  private bool(value: unknown): string {
    return value ? 'Sí' : 'No';
  }

  private number(value: unknown): string {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toLocaleString('es-CO') : this.text(value);
  }

  /** `fecha` arrives as the `yyyy-MM-dd` string an `<input type="date">` emits. */
  private date(value: string | undefined): string {
    if (!value) {
      return '—';
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    return match ? `${match[3]}/${match[2]}/${match[1]}` : this.text(value);
  }

  private now(): string {
    return new Date().toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private buildFileName(traslado: TrasladoSectionDto): string {
    const autorizacion = String(traslado?.autorizacionNumero ?? '').replace(/[^\w-]/g, '') || 'sin-autorizacion';
    const fecha = String(traslado?.fecha ?? '').replace(/[^\d-]/g, '') || new Date().toISOString().slice(0, 10);
    return `historia-traslado-${autorizacion}-${fecha}.pdf`;
  }
}
