import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EsObligatorio } from '../../../../shared/pipes/es-obligatorio';

@Component({
  selector: 'app-examen-step',
  standalone: true,
  imports: [
    EsObligatorio,
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './examen-step.html',
  styleUrls: ['./examen-step.css']
})
export class ExamenStep {
  @Input() group!: FormGroup;
}
