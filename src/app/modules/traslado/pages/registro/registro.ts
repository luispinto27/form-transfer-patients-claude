import { Component, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { AbstractControl, AbstractControlOptions, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { switchMap, timeout } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ServicioService, ServicioResponse } from '../../../../services/servicio.service';
import { PdfService, GeneratePdfResponse } from '../../../../services/generar-pdf';
import { TrasladoDto } from '../../../../models/traslado.dto';
import { FIELD_LABELS, GROUP_ERROR_LABELS, FORM_FIELD_VALIDATORS, SIGNOS_FIELD_VALIDATORS, GASTO_FIELD_VALIDATORS } from '../../../../constants/form-fields.constants';
import { rangoHorario } from '../../../../shared/validators/rango-horario';

import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Icon } from '../../../../shared/ds/icon/icon';

// Step components
import { TrasladoStep } from '../../steps/traslado-step/traslado-step';
import { PacienteStep } from "../../steps/paciente-step/paciente-step";
import { AntecedentesStep } from "../../steps/antecedentes-step/antecedentes-step";
import { SignosStep } from "../../steps/signos-step/signos-step";
import { ExamenStep } from "../../steps/examen-step/examen-step";
import { GastoStep } from "../../steps/gasto-step/gasto-step";
import { ConductaStep } from "../../steps/conducta-step/conducta-step";
import { FirmasStep } from '../../steps/firmas-step/firmas-step';
import { ValidationErrorDialog } from '../../components/validation-error-dialog/validation-error-dialog';
import { SuccessDialog } from '../../components/success-dialog/success-dialog';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    Icon,
    // Steps
    TrasladoStep,
    PacienteStep,
    AntecedentesStep,
    SignosStep,
    ExamenStep,
    GastoStep,
    ConductaStep,
    FirmasStep
],
  templateUrl: './registro.html',
  styleUrls: ['./registro.css']
})

  export class Registro {

    @ViewChild('main', { read: ElementRef })
    mainRef?: ElementRef;

    @ViewChild('railNav', { read: ElementRef })
    railNavRef?: ElementRef;

    @ViewChild(FirmasStep)
    firmasStep?: FirmasStep;

    readonly sectionLabels = [
      'Traslado', 'Paciente', 'Antecedentes', 'Signos vitales',
      'Examen físico', 'Gastos', 'Conducta', 'Firmas'
    ];
    currentIndex = 0;

    form: FormGroup;
    isSearching = false;
    searchLocked = false;
    searchError: string | null = null;

    constructor(
      private readonly fb: FormBuilder,
      private readonly servicioService: ServicioService,
      private readonly pdfService: PdfService,
      private readonly dialog: MatDialog,
      private readonly route: ActivatedRoute,
      private readonly cdr: ChangeDetectorRef
    ) {

      const today = new Date().toISOString().split('T')[0];

      this.form = this.fb.group({
        traslado: this.fb.group({
          fecha: [today, Validators.required],
          codigo: ['', Validators.required],
          entidad: ['', Validators.required],
          autorizadoPor: ['', Validators.required],
          autorizacionNumero: ['', Validators.required],
          movil: ['', Validators.required],
          tipo: ['', Validators.required],
          origen: ['', Validators.required],
          horaInicio: ['01:00', Validators.required],
          destino: ['', Validators.required],
          horaFin: ['01:00', Validators.required],
          retorno: [false],
          trasladoFallido: [false]
        }, { validators: rangoHorario('horaInicio', 'horaFin') } as AbstractControlOptions),

        paciente: this.fb.group({
          nombreCompleto: ['', [Validators.required, Validators.minLength(3)]],
          tipoDocumento: ['', Validators.required],
          numeroDocumento: ['', [Validators.required, Validators.minLength(5)]],
          sexo: ['', Validators.required],
          edad: ['', [Validators.required, Validators.min(0), Validators.max(150)]],
          direccion: ['', Validators.required],
          barrio: ['', Validators.required],
          ciudad: ['', Validators.required],
          telefono: ['', [Validators.required, Validators.pattern(/^\d{7,10}$/)]],
          motivoTraslado: ['', Validators.required],
          tratamiento: ['', Validators.required]
        }),

        conducta: this.fb.group({
          conducta: ['', [Validators.required, Validators.minLength(3)]],
          horaInicioEspera: ['01:00', Validators.required],
          horaFinEspera: ['01:00', Validators.required],
          estadoEntrega: [false],
        }, { validators: rangoHorario('horaInicioEspera', 'horaFinEspera') } as AbstractControlOptions),

        antecedentes: this.fb.group({
          acv: [false],
          alergia: [false],
          artritis: [false],
          asma: [false],
          cancer: [false],
          cardiacos: [false],
          dislipidemia: [false],
          epoc: [false],
          fallaRenal: [false],
          diabetes: [false],
          ginecoObstetricos: [false],
          hipertension: [false],
          quirurgicos: [false],
          psiquiatricos: [false],
          otros: [false],

          dxPrincipal: ['', Validators.required]
        }),

        signos: this.fb.array([]),
        examen: this.fb.group({
          cabeza: [false],
          ojos: [false],
          orl: [false],
          cuello: [false],
          cardiovascular: [false],
          pulmonar: [false],
          abdomen: [false],
          gastrointestinal: [false],
          genitourinario: [false],
          extremidades: [false],
          neurologico: [false],
          psiquiatrico: [false],

          descripcion: ['', Validators.required],
        }),
        registroGasto: this.fb.array([]),
        firmas: this.fb.group({
          medico: ['', Validators.required],
          enfermeria: ['', Validators.required],
          conductor: ['', Validators.required],
          familiar: ['', Validators.required],
          entidadReceptora: ['', Validators.required]
        })
    });

      this.form.get('traslado.autorizacionNumero')?.valueChanges.subscribe(() => {
        this.searchLocked = false;
      });

      this.agregarSignoVital();
      this.agregarGasto();

      // Si el formulario se abre con ?autorizacion=NUMERO en la URL (enlace
      // directo desde el sistema de despacho), precarga el campo y dispara
      // la consulta automáticamente, sin esperar a que alguien pulse "Buscar".
      this.autoBuscarDesdeUrl();



      // Watch trasladoFallido to enable/disable validators
      this.form.get('traslado.trasladoFallido')?.valueChanges.subscribe(trasladoFallido => {
        this.updateValidatorsBasedOnTrasladoFallido(trasladoFallido);
      });
    }

    /**
     * Sections that identify the service and the patient are required whatever
     * happened on the road, so they keep their validators even on a failed
     * transfer. Everything else is clinical record of a trip that did not
     * happen, and is exempt.
     */
    private readonly ALWAYS_REQUIRED_SECTIONS = ['traslado', 'paciente'];

    /**
     * Ticking "Traslado Fallido" drops the validators of every section except
     * those above; unticking it restores them all from the constants.
     */
    private updateValidatorsBasedOnTrasladoFallido(trasladoFallido: boolean): void {
      this.toggleGroupValidators(this.form, '', trasladoFallido);

      // toggleGroupValidators() only walks leaves, so the cross-field rule on
      // Conducta has to be exempted by hand like the rest of that section.
      // Traslado keeps its own: it stays required whatever happened.
      this.conductaGroup.setValidators(
        trasladoFallido ? [] : [rangoHorario('horaInicioEspera', 'horaFinEspera')]
      );
      this.conductaGroup.updateValueAndValidity({ emitEvent: false });

      this.signosArray.controls.forEach(control => {
        if (control instanceof FormGroup) {
          if (trasladoFallido) {
            this.lockSignosNumberFields(control);
          } else {
            this.unlockSignosNumberFields(control);
          }
        }
      });

      this.gastoArray.controls.forEach(control => {
        if (control instanceof FormGroup) {
          if (trasladoFallido) {
            this.lockGastoNumberFields(control);
          } else {
            this.unlockGastoNumberFields(control);
          }
        }
      });
    }

    /** Walks the whole tree so new sections are covered without a field list. */
    private toggleGroupValidators(group: FormGroup, basePath: string, clear: boolean): void {
      Object.keys(group.controls).forEach(key => {
        const control = group.get(key);
        if (!control) {
          return;
        }

        const path = basePath ? `${basePath}.${key}` : key;

        if (control instanceof FormGroup) {
          this.toggleGroupValidators(control, path, clear);
          return;
        }

        if (control instanceof FormArray) {
          control.controls.forEach(row => {
            if (row instanceof FormGroup) {
              this.toggleRowValidators(row, key, clear);
            }
          });
          return;
        }

        if (clear && !this.isAlwaysRequired(path)) {
          control.clearValidators();
        } else {
          this.applyOriginalValidators(path, control);
        }
        control.updateValueAndValidity({ emitEvent: false });
      });
    }

    private isAlwaysRequired(path: string): boolean {
      return this.ALWAYS_REQUIRED_SECTIONS.some(section => path.startsWith(`${section}.`));
    }

    /** Rows of `signos` / `registroGasto`, keyed by field name rather than path. */
    private toggleRowValidators(row: FormGroup, arrayKey: string, clear: boolean): void {
      const validators = arrayKey === 'signos' ? SIGNOS_FIELD_VALIDATORS : GASTO_FIELD_VALIDATORS;

      Object.keys(row.controls).forEach(key => {
        const field = row.get(key);
        if (!field) {
          return;
        }

        if (clear) {
          field.clearValidators();
        } else if (validators[key]) {
          field.setValidators(validators[key]);
        }
        field.updateValueAndValidity({ emitEvent: false });
      });
    }

    private readonly SIGNOS_NUMBER_FIELDS = ['fc', 'fr', 'temperatura', 'glicemia', 'spo2', 'glasgow'];

    private lockSignosNumberFields(group: FormGroup): void {
      this.SIGNOS_NUMBER_FIELDS.forEach(key => {
        const field = group.get(key);
        if (field) {
          field.setValue(0, { emitEvent: false });
          field.disable({ emitEvent: false });
        }
      });
    }

    private unlockSignosNumberFields(group: FormGroup): void {
      this.SIGNOS_NUMBER_FIELDS.forEach(key => {
        const field = group.get(key);
        if (field) {
          field.enable({ emitEvent: false });
        }
      });
    }

    private lockGastoNumberFields(group: FormGroup): void {
      const field = group.get('cantidad');
      if (field) {
        field.setValue(0, { emitEvent: false });
        field.disable({ emitEvent: false });
      }
    }

    private unlockGastoNumberFields(group: FormGroup): void {
      const field = group.get('cantidad');
      if (field) {
        field.enable({ emitEvent: false });
      }
    }

    private applyOriginalValidators(fieldPath: string, control: any): void {
      const validators = FORM_FIELD_VALIDATORS[fieldPath];
      if (validators) {
        control.setValidators(validators);
      }
    }

    get trasladoGroup(): FormGroup {
      return this.form.get('traslado') as FormGroup;
    }

    get pacienteGroup(): FormGroup {
      return this.form.get('paciente') as FormGroup;
    }

    get antecedentesGroup(): FormGroup {
      return this.form.get('antecedentes') as FormGroup;
    }

    get signosArray(): FormArray {
      return this.form.get('signos') as FormArray;
    }

    get examenGroup(): FormGroup {
      return this.form.get('examen') as FormGroup;
    }

    get gastoArray(): FormArray {
      return this.form.get('registroGasto') as FormArray;
    }

    get conductaGroup(): FormGroup {
      return this.form.get('conducta') as FormGroup;
    }

    get firmasGroup(): FormGroup {
      return this.form.get('firmas') as FormGroup;
    }

    /**
     * Drives the notice in the Traslado step and the early "Finalizar" button:
     * with the transfer marked failed only Traslado and Paciente are required,
     * so the user must be able to close the record without walking every step.
     */
    get trasladoFallido(): boolean {
      return !!this.form.get('traslado.trasladoFallido')?.value;
    }

    crearSignoVital(): FormGroup {
      return this.fb.group({
        hora: ['01:00', Validators.required],
        ta: ['', [Validators.required, Validators.pattern(/^\d{2,3}\/\d{2,3}$/)]],
        fc: ['', [Validators.required, Validators.min(40), Validators.max(200)]],
        fr: ['', [Validators.required, Validators.min(10), Validators.max(50)]],
        temperatura: ['', [Validators.required, Validators.min(35), Validators.max(42)]],
        glicemia: ['', [Validators.required, Validators.min(40), Validators.max(500)]],
        spo2: ['', [Validators.required, Validators.min(80), Validators.max(100)]],
        glasgow: ['', [Validators.required, Validators.min(3), Validators.max(15)]],
        dxSecundario: ['', Validators.required]
      });
    }

    agregarSignoVital(): void {
      const group = this.crearSignoVital();
      this.signosArray.push(group);
      // A row added while the transfer is marked failed must arrive unvalidated,
      // otherwise `hora`, `ta` and `dxSecundario` stay required and block submit.
      if (this.form.get('traslado.trasladoFallido')?.value) {
        this.toggleRowValidators(group, 'signos', true);
        this.lockSignosNumberFields(group);
      }
    }

    eliminarSignoVital(index: number): void {
      if (this.signosArray.length > 1) {
        this.signosArray.removeAt(index);
      }
    }

    crearGasto(): FormGroup {
      return this.fb.group({
        descripcion: ['', [Validators.required, Validators.minLength(3)]],
        cantidad: ['', [Validators.required, Validators.min(0.01)]]
      });
    }

    agregarGasto(): void {
      const group = this.crearGasto();
      this.gastoArray.push(group);
      if (this.form.get('traslado.trasladoFallido')?.value) {
        this.toggleRowValidators(group, 'registroGasto', true);
        this.lockGastoNumberFields(group);
      }
    }

    eliminarGasto(index: number): void {
      if (this.gastoArray.length > 1) {
        this.gastoArray.removeAt(index);
      }
    }

    finalizar(): void {
      this.form.markAllAsTouched();

      const trasladoFallido = this.form.get('traslado.trasladoFallido')?.value || false;

      const errors = this.getFormErrors(trasladoFallido);
      if (this.form.invalid || errors.length > 0) {
        this.showValidationErrorDialog(errors);
        return;
      }

      const dto = this.construirDto();

      console.log('DTO a enviar al backend:', dto);

      const dialogRef = this.dialog.open(SuccessDialog, {
        data: { loading: true },
        disableClose: true,
        width: '520px',
        maxWidth: '92vw',
        panelClass: 'shared-dialog-panel'
      });

      // Always listen for dialog close so we can reset the form when user confirms
      dialogRef.afterClosed().subscribe(result => {
        if (result === 'success') {
          this.resetForm();
        }
      });

      let pdfGenerado: GeneratePdfResponse;

      this.pdfService.generatePdf(dto).pipe(
        switchMap(pdf => {
          pdfGenerado = pdf;
          const payload = { ...this.construirPayload(dto), pdfHistoria: pdf.fileBase64 };
          return this.servicioService.guardarTraslado(payload);
        })
      ).subscribe({
        next: (guardar) => {
          if (!guardar?.ok) {
            dialogRef.componentInstance.updateData({
              loading: false,
              error: true,
              message: guardar?.mensaje || 'No se pudo guardar el traslado.'
            });
            return;
          }

          this.descargarPdf(pdfGenerado);

          dialogRef.componentInstance.updateData({
            loading: false,
            error: false,
            message: guardar.mensaje || 'Información almacenada correctamente.'
          });
        },
        error: (err) => {
          console.error('Error generando el PDF o guardando el traslado', err);
          dialogRef.componentInstance.updateData({
            loading: false,
            error: true,
            message: 'Ocurrió un error al generar el PDF o guardar el traslado. Intente de nuevo.'
          });
        }
      });
    }

    /**
     * What the user actually recorded. This is what the PDF is rendered from,
     * so a section nobody filled in stays empty here and the document prints it
     * as "sin registro".
     *
     * `getRawValue()`, not `value`: on a failed transfer the numeric
     * signos/gasto fields are set to 0 and then disabled, and `form.value`
     * omits disabled controls — which would drop those keys entirely.
     *
     * `signos` and `gastos` always travel with the starter row the form is
     * built with, even untouched: `Traslado.guardar` rejects an empty array
     * ("El campo [signos] debe ser un arreglo con al menos un elemento").
     */
    construirDto(): TrasladoDto {
      const raw = this.form.getRawValue();

      return {
        traslado: raw.traslado,
        paciente: raw.paciente,
        antecedentes: raw.antecedentes,
        signos: raw.signos,
        examen: raw.examen,
        gastos: raw.registroGasto,
        conducta: raw.conducta,
        firmas: raw.firmas
      };
    }

    /** Stands in for a free-text field the failed transfer left with nothing to say. */
    private readonly SIN_REGISTRO = 'No aplica - traslado fallido';

    /**
     * Vitals for a row the failed transfer left untouched.
     *
     * `Traslado.guardar` belongs to a third party and validates shape and range
     * on every field ("El campo [signos[0].ta] debe tener formato
     * sistolica/diastolica"), with no exemption for `trasladoFallido`, so a
     * blank or zeroed row cannot get through. These are ordinary adult values,
     * mid-range for the limits the form itself enforces (fc 40-200, fr 10-50,
     * temperatura 35-42, glicemia 40-500, spo2 80-100, glasgow 3-15).
     *
     * They are a placeholder for a patient nobody assessed, not a measurement.
     * Nothing else in the app reads them: they exist only in the object handed
     * to that endpoint, `dxSecundario` labels the row as such right beside
     * them, and `traslado.trasladoFallido` travels in the same payload.
     */
    private readonly SIGNOS_SIN_VALORACION = {
      ta: '120/80',
      fc: 80,
      fr: 16,
      temperatura: 36.5,
      glicemia: 90,
      spo2: 98,
      glasgow: 15
    };

    /** `cantidad` is validated as min 0.01, so a zeroed placeholder row is refused too. */
    private readonly GASTO_SIN_REGISTRO_CANTIDAD = 1;

    /**
     * The same record, reshaped to satisfy `Traslado.guardar`.
     *
     * The endpoint requires every field of every section whatever
     * `trasladoFallido` says, so the sections the user is allowed to skip
     * cannot reach it blank. They are filled here, in the payload only —
     * `construirDto()` and therefore the PDF keep showing those sections as
     * "sin registro", so the printed record never presents any of this as
     * something that was measured or spent.
     *
     * Signatures are the exception and stay empty: a signature is an
     * attestation by a named person, and it can still be collected for real on
     * a failed transfer from the Firmas step.
     */
    construirPayload(dto: TrasladoDto): TrasladoDto {
      if (!dto.traslado?.trasladoFallido) {
        return dto;
      }

      const sinValoracion = this.SIGNOS_SIN_VALORACION;

      return {
        ...dto,
        antecedentes: { ...dto.antecedentes, dxPrincipal: this.oSinRegistro(dto.antecedentes?.dxPrincipal) },
        signos: (dto.signos ?? []).map(signo => ({
          ...signo,
          ta: this.oValor(signo?.ta, sinValoracion.ta),
          fc: this.oValor(signo?.fc, sinValoracion.fc),
          fr: this.oValor(signo?.fr, sinValoracion.fr),
          temperatura: this.oValor(signo?.temperatura, sinValoracion.temperatura),
          glicemia: this.oValor(signo?.glicemia, sinValoracion.glicemia),
          spo2: this.oValor(signo?.spo2, sinValoracion.spo2),
          glasgow: this.oValor(signo?.glasgow, sinValoracion.glasgow),
          dxSecundario: this.oSinRegistro(signo?.dxSecundario)
        })),
        examen: { ...dto.examen, descripcion: this.oSinRegistro(dto.examen?.descripcion) },
        gastos: (dto.gastos ?? []).map(gasto => ({
          ...gasto,
          descripcion: this.oSinRegistro(gasto?.descripcion),
          cantidad: this.oValor(gasto?.cantidad, this.GASTO_SIN_REGISTRO_CANTIDAD)
        })),
        conducta: { ...dto.conducta, conducta: this.oSinRegistro(dto.conducta?.conducta) }
      };
    }

    private oSinRegistro(value: string | undefined): string {
      return value?.trim() ? value : this.SIN_REGISTRO;
    }

    /** Keeps what the user typed; falls back only on a blank or zeroed field. */
    private oValor<T extends string | number>(value: T | null | undefined, fallback: T): T {
      if (value === null || value === undefined) {
        return fallback;
      }
      if (typeof value === 'number') {
        return value === 0 ? fallback : value;
      }
      return value.trim() ? value : fallback;
    }

    private descargarPdf(pdf: GeneratePdfResponse): void {
      const byteChars = atob(pdf.fileBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.codePointAt(i)!;
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/pdf' });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = pdf.fileName || 'traslado.pdf';
      link.click();
      URL.revokeObjectURL(url);
    }

    private getFormErrors(trasladoFallido = false): string[] {
      const errors: string[] = [];

      const checkControl = (control: any, path: string) => {
        if (control?.errors) {
          // Remove array indices from path for cleaner display
          const cleanPath = path.replace(/\[\d+\]\./g, '.');
          const label = FIELD_LABELS[cleanPath] || cleanPath;
          if (control.errors['required']) {
            errors.push(`${label} es requerido`);
          } else if (control.errors['minlength']) {
            errors.push(`${label} debe tener mínimo ${control.errors['minlength'].requiredLength} caracteres`);
          } else if (control.errors['min']) {
            errors.push(`${label} debe ser mayor a ${control.errors['min'].min}`);
          } else if (control.errors['max']) {
            errors.push(`${label} debe ser menor a ${control.errors['max'].max}`);
          } else if (control.errors['pattern']) {
            errors.push(`${label} tiene un formato inválido`);
          }
        }
      };

      // Rules that compare two fields sit on the group, so they never show up
      // in the leaf walk below and would leave the dialog empty on an invalid
      // form. GROUP_ERROR_LABELS carries their wording.
      const checkGroupErrors = (group: FormGroup, basePath: string) => {
        Object.keys(group.errors ?? {}).forEach(key => {
          const label = GROUP_ERROR_LABELS[basePath ? `${basePath}.${key}` : key];
          if (label) {
            errors.push(label);
          }
        });
      };

      // Check all form controls recursively
      const checkGroup = (group: FormGroup, basePath: string = '') => {
        checkGroupErrors(group, basePath);

        Object.keys(group.controls).forEach(key => {
          const control = group.get(key);
          const path = basePath ? `${basePath}.${key}` : key;

          if (control instanceof FormGroup) {
            checkGroup(control, path);
          } else if (control instanceof FormArray) {
            control.controls.forEach((item, index) => {
              if (item instanceof FormGroup) {
                checkGroup(item, `${path}[${index}]`);
              } else {
                checkControl(item, path);
              }
            });
          } else {
            checkControl(control, path);
          }
        });
      };

      checkGroup(this.form);

      if (!trasladoFallido && this.signosArray.length < 1) {
        errors.push('❌ Debe registrar al menos 1 signo vital');
      }

      return errors;
    }

    private resetForm(): void {
      const today = new Date().toISOString().split('T')[0];

      // Section "done" state is derived live from each control's validity
      // (see sectionDone()), so jumping back to the first section and
      // resetting the form is enough to show every section as pending again.
      this.currentIndex = 0;

      this.form.reset({
        traslado: {
          fecha: today,
          horaInicio: '01:00',
          horaFin: '01:00',
          retorno: false,
          trasladoFallido: false
        },
        conducta: {
          horaInicioEspera: '01:00',
          horaFinEspera: '01:00',
          estadoEntrega: false
        }
      });

      this.signosArray.clear();
      this.gastoArray.clear();
      this.agregarSignoVital();
      this.agregarGasto();

      // Clear any drawn signatures in FirmaPad components
      this.firmasStep?.firmas?.forEach(pad => pad.limpiar());

      // Ensure the fresh form shows no validation styling (no red fields/labels).
      this.form.markAsUntouched();
      this.form.markAsPristine();
      this.searchLocked = false;
      this.searchError = null;
    }

    /** Control that backs each step/section, in rail order. */
    getStepControl(index: number): AbstractControl | null {
      switch (index) {
        case 0: return this.trasladoGroup;
        case 1: return this.pacienteGroup;
        case 2: return this.antecedentesGroup;
        case 3: return this.signosArray;
        case 4: return this.examenGroup;
        case 5: return this.gastoArray;
        case 6: return this.conductaGroup;
        case 7: return this.firmasGroup;
        default: return null;
      }
    }

    /** Whether the section at `index` currently passes its own validators. */
    sectionDone(index: number): boolean {
      return this.getStepControl(index)?.valid ?? false;
    }

    get completedCount(): number {
      return this.sectionLabels.reduce((n, _, i) => n + (this.sectionDone(i) ? 1 : 0), 0);
    }

    /** Lee ?autorizacion=NUMERO de la URL y, si viene, dispara la consulta de una vez. */
    private autoBuscarDesdeUrl(): void {
      const autorizacion = this.route.snapshot.queryParamMap.get('autorizacion')?.trim();
      if (!autorizacion) {
        return;
      }
      this.trasladoGroup.patchValue({ autorizacionNumero: autorizacion });
      this.onBuscarAutorizacion(autorizacion);
    }

    /** Sidebar navigation: free jump, same as the design's SectionNav. */
    goTo(index: number): void {
      this.currentIndex = index;
      this.scrollToTop();
    }

    nextStep(): void {
      const control = this.getStepControl(this.currentIndex);

      if (control) {
        control.markAllAsTouched();
        if (control.invalid) {
          // Show inline errors and take the user to the first one
          this.scrollToFirstError();
          return;
        }
      }

      if (this.currentIndex < this.sectionLabels.length - 1) {
        this.currentIndex++;
        this.scrollToTop();
      }
    }

    previousStep(): void {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.scrollToTop();
      }
    }

    private scrollToTop(): void {
      // Instant, not 'smooth': smooth scrolling depends on animation frames
      // that some automated/headless browser contexts never paint, silently
      // leaving the page scrolled mid-section. An instant jump always lands.
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.scrollTo(0, 0);
        }
        this.mainRef?.nativeElement?.scrollTo?.(0, 0);
        this.scrollActiveStepIntoView();
      });
    }

    /**
     * Keep the active section visible in the horizontally-scrollable rail
     * (mobile only). Scrolls the nav strip's own scrollLeft directly instead
     * of calling `Element.scrollIntoView()` on the button — that API also
     * repositions the nearest scrollable ancestor along the vertical axis,
     * which on desktop meant it fought scrollToTop() and re-scrolled the
     * whole page back down right after it had been reset to 0.
     */
    private scrollActiveStepIntoView(): void {
      const nav = this.railNavRef?.nativeElement as HTMLElement | undefined;
      const active = nav?.querySelector('.rail__nav-btn.is-active') as HTMLElement | null;
      if (!nav || !active || nav.scrollWidth <= nav.clientWidth) {
        return;
      }
      const target = active.offsetLeft - (nav.clientWidth - active.clientWidth) / 2;
      nav.scrollTo(Math.max(0, target), 0);
    }

    private scrollToFirstError(): void {
      setTimeout(() => {
        const firstInvalid = this.mainRef?.nativeElement?.querySelector(
          '.ng-invalid.ng-touched:not(form):not([formgroupname]), .field-error'
        ) as HTMLElement | null;
        firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (firstInvalid && typeof firstInvalid.focus === 'function') {
          firstInvalid.focus({ preventScroll: true });
        }
      }, 100);
    }

    private showValidationErrorDialog(errors: string[]): void {
      this.dialog.open(ValidationErrorDialog, {
        width: '520px',
        maxWidth: '92vw',
        panelClass: 'shared-dialog-panel',
        data: { errors },
        disableClose: false
      });
    }

    onBuscarAutorizacion(autorizacion: string): void {
      this.isSearching = true;
      this.searchError = null;
      // Zoneless app: manually flag for change detection so the button reflects
      // the loading state (there is no zone.js to schedule a CD tick for us).
      this.cdr.markForCheck();

      this.servicioService.buscarServicio(autorizacion).pipe(
        // Safety net: never let the button spin forever if the request stalls.
        timeout(20000)
      ).subscribe({
        next: (servicio: ServicioResponse) => {
          this.isSearching = false;
          this.searchError = null;
          this.llenarFormularioConServicio(servicio);
          this.searchLocked = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSearching = false;
          this.searchLocked = false;
          this.searchError = this.mapSearchError(err);
          this.cdr.markForCheck();
        }
      });
    }

    /** Turn an HTTP/timeout error into a user-facing message. */
    private mapSearchError(err: any): string {
      // rxjs `timeout` operator throws a TimeoutError (no HTTP status).
      if (err?.name === 'TimeoutError') {
        return 'La búsqueda tardó demasiado. Verifique su conexión e intente de nuevo.';
      }

      const status = err?.status;
      // The legacy PHP API returns the business result in the JSON body
      // ({ ok, codigo, mensaje }); prefer its message when present.
      const mensaje: string | undefined = err?.error?.mensaje;

      switch (status) {
        case 400:
          return mensaje || 'El número de autorización no es válido.';
        case 401:
        case 403:
          return 'No autorizado. Por favor intente nuevamente o contacte al administrador.';
        case 404:
          return mensaje || 'No se encontró ningún servicio con ese número de autorización.';
        case 0:
          return 'No se pudo conectar con el servidor. Verifique su conexión.';
        default:
          if (typeof status === 'number' && status >= 500) {
            return 'El servidor no está disponible en este momento. Intente más tarde.';
          }
          return mensaje || 'Ocurrió un error al buscar el servicio. Intente de nuevo.';
      }
    }

    private llenarFormularioConServicio(servicio: ServicioResponse): void {
      // Traslado fields
      const horaInicio = servicio.hora ? servicio.hora.substring(0, 5) : '01:00';
      this.trasladoGroup.patchValue({
        autorizacionNumero: servicio.autorizacion,
        fecha: servicio.fecha,
        codigo: servicio.codigo || servicio.servicio_codigo || '',
        entidad: servicio.entidad,
        autorizadoPor: servicio.solicitante,
        movil: servicio.datomovil || servicio.movil,
        tipo: servicio.tiposervicio || '',
        origen: servicio.origen,
        destino: servicio.destino,
        horaInicio,
        retorno: servicio.ida_vuelta?.toUpperCase() === 'SI'
      });

      // Paciente fields
      const nombreParts = [
        servicio.paciente,
        servicio.segundo_nombre,
        servicio.primer_apellido,
        servicio.segundo_apellido
      ].filter(p => p?.trim());
      const nombreCompleto = nombreParts.join(' ');

      this.pacienteGroup.patchValue({
        nombreCompleto: nombreCompleto,
        numeroDocumento: servicio.documento,
        edad: servicio.edad,
        direccion: servicio.direccionpaciente || '',
        telefono: servicio.telefonopaciente || '',
        ciudad: servicio.ciudad_origen,
        motivoTraslado: servicio.diagnosticos,
        tipoDocumento: servicio.tipopaciente,
      });

      // Antecedentes - diagnostico principal
      this.antecedentesGroup.patchValue({
        dxPrincipal: servicio.diagnosticos
      });
    }
}
