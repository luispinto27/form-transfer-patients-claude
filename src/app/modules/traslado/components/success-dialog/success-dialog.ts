import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface SuccessDialogData {
  loading: boolean;
  message?: string;
  error?: boolean;
  /**
   * El traslado se guardó, pero algo secundario falló — hoy, el registro en la
   * bitácora de control. Sigue siendo un éxito, con una advertencia a la vista.
   */
  warning?: string;
  /** Confirma al operador CUÁL traslado se envió, no solo que algo se envió. */
  autorizacion?: string;
}

/** En qué punto del envío está el diálogo. */
export type EstadoEnvio = 'generando' | 'enviado' | 'fallido';

/**
 * Cierra el ciclo de "Finalizar": genera el PDF, envía al servicio externo y
 * deja constancia en la bitácora.
 *
 * Comparte anatomía con `TrasladoBloqueadoDialog` —banda de estado, número de
 * autorización protagonista y sello— para que los dos se lean igual de rápido.
 * Lo que los distingue es el color de la banda y la palabra del sello: verde
 * «Enviado» aquí, navy «Diligenciado» allá. Un operador no debe confundir
 * "acabo de enviarlo" con "ya estaba enviado".
 */
@Component({
  selector: 'app-success-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './success-dialog.html',
  styleUrls: ['./success-dialog.css']
})
export class SuccessDialog {

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SuccessDialogData,
    private readonly dialogRef: MatDialogRef<SuccessDialog>,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get estado(): EstadoEnvio {
    if (this.data.loading) {
      return 'generando';
    }
    return this.data.error ? 'fallido' : 'enviado';
  }

  updateData(patch: Partial<SuccessDialogData>): void {
    Object.assign(this.data, patch);
    this.cdr.markForCheck();
  }

  /**
   * El resultado decide si el formulario se reinicia: `Registro` solo lo limpia
   * con 'success', para no borrar lo que el operador escribió si el envío falló.
   */
  close(): void {
    this.dialogRef.close(this.data?.error ? 'error' : 'success');
  }
}
