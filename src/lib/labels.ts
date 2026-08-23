export const CATEGORY_LABELS: Record<string, string> = {
  PLATO_UNICO: "Plato único",
  PRIMERO: "Primer plato",
  SEGUNDO: "Segundo plato",
  ACOMPANAMIENTO: "Acompañamiento",
};

export const MEAL_TYPE_LABELS: Record<string, string> = {
  COMIDA: "Comida",
  CENA: "Cena",
  AMBAS: "Comida y cena",
};

export const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
export const MEAL_TYPE_OPTIONS = Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => ({ value, label }));
