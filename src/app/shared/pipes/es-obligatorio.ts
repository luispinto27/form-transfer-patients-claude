import { Pipe, PipeTransform } from '@angular/core';
import { AbstractControl, Validators } from '@angular/forms';

/**
 * Whether a control currently carries a `required` validator, so the asterisk
 * next to its label can follow the real rule instead of being hardcoded.
 *
 * Impure on purpose: marking "Traslado Fallido" adds and removes validators
 * without ever replacing the control instance, so a pure pipe would keep
 * showing the asterisk of a field that is no longer required.
 */
@Pipe({
  name: 'esObligatorio',
  standalone: true,
  pure: false
})
export class EsObligatorio implements PipeTransform {

  transform(control: AbstractControl | null | undefined): boolean {
    return !!control?.hasValidator(Validators.required);
  }
}
