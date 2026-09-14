import { Component, ViewChildren, QueryList, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirmaPad } from '../../components/firma-pad/firma-pad';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-firmas-step',
  standalone: true,
  imports: [CommonModule, FirmaPad, ReactiveFormsModule],
  templateUrl: './firmas-step.html',
  styleUrls: ['./firmas-step.css']
})
export class FirmasStep {

  @Input() group!: FormGroup;

  @ViewChildren(FirmaPad)
  firmas!: QueryList<FirmaPad>;

  guardarFirmas(): void {
    const pads = this.firmas.toArray();

    this.group.patchValue({
      medico: pads[0]?.obtenerFirmaBase64() || '',
      enfermeria: pads[1]?.obtenerFirmaBase64() || '',
      conductor: pads[2]?.obtenerFirmaBase64() || '',
      familiar: pads[3]?.obtenerFirmaBase64() || '',
      entidadReceptora: pads[4]?.obtenerFirmaBase64() || ''
    });
  }
}
