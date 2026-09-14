import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-antecedentes-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './antecedentes-step.html',
  styleUrls: ['./antecedentes-step.css']
})
export class AntecedentesStep {
  @Input() group!: FormGroup;
}
