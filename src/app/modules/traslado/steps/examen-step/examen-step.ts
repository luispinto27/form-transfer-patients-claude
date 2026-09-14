import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-examen-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './examen-step.html',
  styleUrls: ['./examen-step.css']
})
export class ExamenStep {
  @Input() group!: FormGroup;
}
