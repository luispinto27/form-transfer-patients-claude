import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Icon } from '../../../../shared/ds/icon/icon';

@Component({
  selector: 'app-gasto-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    Icon
  ],
  templateUrl: './gasto-step.html',
  styleUrls: ['./gasto-step.css']
})
export class GastoStep {
  @Input() gastos!: FormArray<FormGroup>;
  @Input() agregar!: () => void;
  @Input() eliminar!: (index: number) => void;

  get filas() {
    return this.gastos?.controls ?? [];
  }
}
