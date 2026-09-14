import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Icon } from '../../../../shared/ds/icon/icon';

export interface SuccessDialogData {
  loading: boolean;
  message?: string;
  error?: boolean;
}

@Component({
  selector: 'app-success-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, Icon],
  template: `
    <div class="content">
      <!-- Loading state -->
      <ng-container *ngIf="data.loading">
        <div class="loading-content">
          <span class="spinner spinner--dark spinner--lg"></span>
          <p class="loading-text">Generando formulario, por favor espere...</p>
        </div>
      </ng-container>

      <!-- Error state -->
      <ng-container *ngIf="!data.loading && data.error">
        <div class="result-content error-content">
          <app-icon class="result-icon error-icon" name="alert" [size]="48"></app-icon>
          <h2 class="result-title">Ocurrió un error</h2>
          <p class="result-subtitle">No se pudo generar el formulario. Intenta nuevamente.</p>
          <div class="dialog-actions">
            <button type="button" class="btn btn--danger primary-button" (click)="close()">Cerrar</button>
          </div>
        </div>
      </ng-container>

      <!-- Success state -->
      <ng-container *ngIf="!data.loading && !data.error">
        <div class="result-content success-content">
          <app-icon class="result-icon success-icon" name="checkCircle" [size]="48"></app-icon>
          <h2 class="result-title">¡Todo listo!</h2>
          <p class="result-subtitle">
            {{ data.message || 'La información del traslado ha sido almacenada correctamente.' }}
          </p>
          <div class="success-details">
            <p>Tu servicio se guardó con éxito y ya puedes continuar con el siguiente paso.</p>
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn--primary primary-button" (click)="close()">Cerrar</button>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6);
      padding: var(--space-6) var(--space-2);
    }

    .content {
      width: min(520px, 92vw);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      margin: 0 auto;
      padding: var(--space-5);
      box-sizing: border-box;
      font-family: var(--font-sans);
    }

    .loading-text {
      font: var(--type-body);
      color: var(--text-muted);
      margin: 0;
      text-align: center;
    }

    .result-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: var(--space-3);
    }

    .success-icon { color: var(--success-500); }
    .error-icon   { color: var(--danger-500); }

    .result-title {
      margin: var(--space-2) 0 0;
      font: var(--type-h2);
      color: var(--navy-800);
    }

    .result-subtitle {
      margin: 0;
      color: var(--text-muted);
      font: var(--type-body);
    }

    .success-details {
      background: var(--success-100);
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-4);
      width: 100%;
      color: var(--gray-800);
      font: var(--type-body);
      text-align: left;
      box-sizing: border-box;
    }
    .success-details p { margin: 0; }

    .dialog-actions {
      display: flex;
      justify-content: center;
      padding-top: var(--space-2);
    }

    .primary-button { min-width: 140px; }
  `]
})
export class SuccessDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: SuccessDialogData,
    private readonly dialogRef: MatDialogRef<SuccessDialog>,
    private readonly cdr: ChangeDetectorRef
  ) {}

  updateData(patch: Partial<SuccessDialogData>): void {
    Object.assign(this.data, patch);
    this.cdr.markForCheck();
  }

  close(): void {
    const result = this.data?.error ? 'error' : 'success';
    this.dialogRef.close(result);
  }
}
