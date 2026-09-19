import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Error key this validator writes on the group, for templates and constants. */
export const RANGO_HORARIO_INVALIDO = 'rangoHorarioInvalido';

const HORA = /^\d{1,2}:\d{2}$/;

/**
 * Cross-field rule for the two halves of a time range: the end cannot fall
 * before the start.
 *
 * Both halves belong to the same calendar day — Traslado carries a single
 * `fecha`, and the wait in Conducta happens inside that same trip — so only
 * the "HH:mm" the hour/minute selects write is compared.
 *
 * The error lands on the group rather than on either control, because neither
 * one is wrong on its own: it is the pair that does not make sense.
 */
export function rangoHorario(inicioKey: string, finKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const inicio = group.get(inicioKey)?.value;
    const fin = group.get(finKey)?.value;

    // Half a range is not an inverted range: `required` is what reports that.
    if (!esHora(inicio) || !esHora(fin)) {
      return null;
    }

    return enMinutos(fin) < enMinutos(inicio)
      ? { [RANGO_HORARIO_INVALIDO]: { inicio, fin } }
      : null;
  };
}

function esHora(value: unknown): value is string {
  return typeof value === 'string' && HORA.test(value);
}

/** Compared as minutes, so a stray "9:00" sorts against "10:00" correctly. */
function enMinutos(hora: string): number {
  const [horas, minutos] = hora.split(':');
  return Number(horas) * 60 + Number(minutos);
}
