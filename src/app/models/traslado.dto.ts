/**
 * Shape of the payload built by the Registro page (`finalizar()`), and the
 * single source of truth for what the generated PDF renders.
 *
 * Values arrive straight from the reactive form, so every string may be empty
 * and numeric inputs may still be strings — the PDF builder normalises them.
 */

export interface TrasladoSectionDto {
  fecha: string;
  codigo: string;
  entidad: string;
  autorizadoPor: string;
  autorizacionNumero: string;
  movil: string;
  tipo: string;
  origen: string;
  horaInicio: string;
  destino: string;
  horaFin: string;
  retorno: boolean;
  trasladoFallido: boolean;
}

export interface PacienteSectionDto {
  nombreCompleto: string;
  tipoDocumento: string;
  numeroDocumento: string;
  sexo: string;
  edad: number | string;
  direccion: string;
  barrio: string;
  ciudad: string;
  telefono: string;
  motivoTraslado: string;
  tratamiento: string;
}

export interface AntecedentesSectionDto {
  acv: boolean;
  alergia: boolean;
  artritis: boolean;
  asma: boolean;
  cancer: boolean;
  cardiacos: boolean;
  dislipidemia: boolean;
  epoc: boolean;
  fallaRenal: boolean;
  diabetes: boolean;
  ginecoObstetricos: boolean;
  hipertension: boolean;
  quirurgicos: boolean;
  psiquiatricos: boolean;
  otros: boolean;
  dxPrincipal: string;
}

export interface SignoVitalDto {
  hora: string;
  ta: string;
  fc: number | string;
  fr: number | string;
  temperatura: number | string;
  glicemia: number | string;
  spo2: number | string;
  glasgow: number | string;
  dxSecundario: string;
}

export interface ExamenSectionDto {
  cabeza: boolean;
  ojos: boolean;
  orl: boolean;
  cuello: boolean;
  cardiovascular: boolean;
  pulmonar: boolean;
  abdomen: boolean;
  gastrointestinal: boolean;
  genitourinario: boolean;
  extremidades: boolean;
  neurologico: boolean;
  psiquiatrico: boolean;
  descripcion: string;
}

export interface GastoDto {
  descripcion: string;
  cantidad: number | string;
}

export interface ConductaSectionDto {
  conducta: string;
  horaInicioEspera: string;
  horaFinEspera: string;
  estadoEntrega: boolean;
}

/** Each value is an image data URL produced by `FirmaPad.obtenerFirmaBase64()`. */
export interface FirmasSectionDto {
  medico: string;
  enfermeria: string;
  conductor: string;
  familiar: string;
  entidadReceptora: string;
}

export interface TrasladoDto {
  traslado: TrasladoSectionDto;
  paciente: PacienteSectionDto;
  antecedentes: AntecedentesSectionDto;
  signos: SignoVitalDto[];
  examen: ExamenSectionDto;
  gastos: GastoDto[];
  conducta: ConductaSectionDto;
  firmas: FirmasSectionDto;
}
