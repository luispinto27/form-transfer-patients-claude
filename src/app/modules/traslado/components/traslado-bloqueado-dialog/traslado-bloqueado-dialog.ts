import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { RegistroTrasladoExistente } from '../../../../services/traslado-registrado';

/**
 * Se abre cuando el enlace apunta a una autorización que ya fue enviada al
 * servicio externo.
 *
 * Deliberadamente NO usa el rojo de error ni el icono de alerta del diálogo de
 * validación: el operador no se equivocó en nada, este traslado simplemente ya
 * está documentado. El registro se presenta como lo que es —una historia
 * clínica cerrada y archivada— con el número de autorización como dato
 * protagonista y un sello de «diligenciado».
 *
 * Tampoco tiene botón: el formulario queda deshabilitado detrás y no hay nada
 * que hacer en esta página, así que el texto dice directamente que se puede
 * cerrar la ventana. La salida real es abrir el enlace de otro traslado.
 */
@Component({
  selector: 'app-traslado-bloqueado-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './traslado-bloqueado-dialog.html',
  styleUrls: ['./traslado-bloqueado-dialog.css']
})
export class TrasladoBloqueadoDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: RegistroTrasladoExistente) {}
}
