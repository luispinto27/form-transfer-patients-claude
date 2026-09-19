import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EsObligatorio } from '../../../../shared/pipes/es-obligatorio';

@Component({
  selector: 'app-antecedentes-step',
  standalone: true,
  imports: [
    EsObligatorio,
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './antecedentes-step.html',
  styleUrls: ['./antecedentes-step.css']
})
export class AntecedentesStep {
  @Input() group!: FormGroup;
}
