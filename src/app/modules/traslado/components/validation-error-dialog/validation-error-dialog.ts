import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Icon } from '../../../../shared/ds/icon/icon';

@Component({
  selector: 'app-validation-error-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, Icon],
  template: `
    <div class="content">
      <div class="header">
        <span class="warn-icon"><app-icon name="warning" [size]="22"></app-icon></span>
        <div class="title-block">
          <h2 class="title">Validación del Formulario</h2>
          <p class="subtitle">Por favor, completa los siguientes campos:</p>
        </div>
      </div>

      <div class="error-list">
        <div *ngFor="let error of data.errors" class="error-item">
          <span class="error-bullet"><app-icon name="x" [size]="14"></app-icon></span>
          <span class="error-text">{{ error.startsWith('❌') ? error.slice(2) : error }}</span>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn btn--primary primary-button" (click)="closeDialog()">Entendido</button>
      </div>
    </div>
  `,
  styles: [`
    .header {
      display: flex;
      gap: var(--space-3);
      align-items: center;
    }

    .content {
      width: min(520px, 92vw);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-5);
      box-sizing: border-box;
      font-family: var(--font-sans);
    }

    .warn-icon {
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--orange-700);
      background: var(--orange-100);
      border-radius: var(--radius-md);
      box-sizing: border-box;
    }

    .title {
      margin: 0 0 4px;
      font: var(--type-h3);
      color: var(--navy-800);
    }

    .subtitle {
      margin: 0;
      color: var(--text-muted);
      font: var(--type-body);
    }

    .error-list {
      max-height: 320px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-2);
      width: 100%;
      background: var(--surface-page);
      border-radius: var(--radius-md);
      overflow-x: hidden;
      box-sizing: border-box;
    }

    .error-item {
      display: flex;
      gap: var(--space-3);
      align-items: flex-start;
      color: var(--navy-800);
      font: var(--type-body);
      width: 100%;
      padding: var(--space-1) var(--space-1);
      box-sizing: border-box;
    }

    .error-bullet {
      flex: 0 0 22px;
      height: 22px;
      width: 22px;
      border-radius: 50%;
      background: var(--danger-100);
      color: var(--danger-500);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
    }
    .error-text { line-height: 1.4; display: block; word-break: break-word; overflow-wrap: anywhere; }

    .actions { display: flex; justify-content: center; padding-top: var(--space-2); }
    .primary-button { min-width: 120px; }
  `]
})
export class ValidationErrorDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { errors: string[] },
    public dialogRef: MatDialogRef<ValidationErrorDialog>
  ) {}

  closeDialog(): void {
    this.dialogRef.close();
  }
}
