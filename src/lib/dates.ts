// Todas las fechas de este módulo se tratan como "solo fecha" (sin hora),
// ancladas a medianoche UTC. Se evita deliberadamente usar métodos en hora
// local (getDay/getDate/date-fns por defecto) porque, según la zona horaria
// del servidor, podrían desplazar el día calculado.

export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Lunes (00:00 UTC) de la semana a la que pertenece `date`. */
export function mondayOf(date: Date): Date {
  const day = date.getUTCDay(); // 0=domingo ... 6=sábado
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDaysUTC(date, diffToMonday);
}

export function dayLabel(weekStart: Date, dayOfWeek: number): string {
  return formatDateOnly(addDaysUTC(weekStart, dayOfWeek));
}
