import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Icon } from '../../../../shared/ds/icon/icon';
import { RegistroTrasladoExistente } from '../../../../services/traslado-registrado';

/**
 * Se abre cuando el enlace apunta a una autorización que ya fue enviada al
 * servicio externo.
 *
 * No tiene botón de cerrar a propósito: el formulario queda deshabilitado
 * detrás y no hay nada que el operador pueda hacer en esta página. La salida es
 * abrir el enlace de otro traslado.
 */
@Component({
  selector: 'app-traslado-bloqueado-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, Icon],
  template: `
    <div class="content">
      <div class="header">
        <span class="warn-icon"><app-icon name="alert" [size]="22"></app-icon></span>
        <div class="title-block">
          <h2 class="title">Este traslado ya fue diligenciado</h2>
          <p class="subtitle">No es posible volver a generarlo.</p>
        </div>
      </div>

      <div class="detalle">
        <p class="detalle__linea">
          <span class="detalle__etiqueta">Número de autorización</span>
          <span class="detalle__valor">{{ data.autorizacion }}</span>
        </p>
        <p class="detalle__linea" *ngIf="data.registradoEn">
          <span class="detalle__etiqueta">Registrado el</span>
          <span class="detalle__valor">{{ data.registradoEn | date: 'dd/MM/yyyy HH:mm' }}</span>
        </p>
      </div>

      <p class="nota">
        El formulario y el PDF de este traslado se generaron con anterioridad y la
        información ya fue enviada. Si cree que se trata de un error, repórtelo al
        área administrativa.
      </p>
    </div>
  `,
  styles: [`
    .content {
      width: min(520px, 92vw);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5);
      box-sizing: border-box;
      font-family: var(--font-sans);
    }

    .header {
      display: flex;
      gap: var(--space-3);
      align-items: center;
    }

    .warn-icon {
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--danger-500);
      background: var(--danger-100);
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

    .detalle {
      background: var(--surface-page);
      border-radius: var(--radius-md);
      padding: var(--space-3) var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .detalle__linea {
      margin: 0;
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      font: var(--type-body);
    }

    .detalle__etiqueta { color: var(--text-muted); }

    .detalle__valor {
      color: var(--navy-800);
      font-weight: 600;
      text-align: right;
      word-break: break-word;
    }

    .nota {
      margin: 0;
      color: var(--text-muted);
      font: var(--type-body);
      line-height: 1.5;
    }
  `]
})
export class TrasladoBloqueadoDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: RegistroTrasladoExistente) {}
}
