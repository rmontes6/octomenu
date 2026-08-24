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

/**
 * Fecha en formato español día/mes/año (con "/"), solo para mostrar en la
 * UI. `formatDateOnly` (año-mes-día con guiones) es el formato interno: se
 * usa como clave en las llamadas a la API (`?weekStart=`) y `parseDateOnly`
 * solo entiende ese formato, así que no debe tocarse.
 */
export function formatDateDisplay(date: Date): string {
  const [year, month, day] = formatDateOnly(date).split("-");
  return `${day}/${month}/${year}`;
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
  return formatDateDisplay(addDaysUTC(weekStart, dayOfWeek));
}

/**
 * Mitad "cálida" (mayo-septiembre) vs. "fría" (octubre-abril) del año, para
 * filtrar platos de temporada al generar el menú. Ajustado al clima de
 * España en vez de un corte 6/6 arbitrario: abril todavía es fresco/lluvioso
 * en la mayor parte del país, así que cuenta como INVIERNO. Los platos solo
 * se etiquetan como VERANO/INVIERNO/AMBAS (sin primavera/otoño), así que
 * ambas mitades se reparten esos meses de transición.
 */
export function seasonOf(date: Date): "VERANO" | "INVIERNO" {
  const month = date.getUTCMonth() + 1; // 1-12
  return month >= 5 && month <= 9 ? "VERANO" : "INVIERNO";
}
