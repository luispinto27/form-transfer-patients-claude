import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from "@angular/forms";

@Component({
  selector: 'app-paciente-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
],
  templateUrl: './paciente-step.html',
  styleUrls: ['./paciente-step.css']
})
export class PacienteStep {
  @Input() group!: FormGroup;
}
