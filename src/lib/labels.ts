export const CATEGORY_LABELS: Record<string, string> = {
  PLATO_UNICO: "Plato único",
  PRIMERO: "Primer plato",
  SEGUNDO: "Segundo plato",
  ACOMPANAMIENTO: "Guarnición",
};

export const MEAL_TYPE_LABELS: Record<string, string> = {
  COMIDA: "Comida",
  CENA: "Cena",
  AMBAS: "Comida y cena",
};

export const SEASON_LABELS: Record<string, string> = {
  VERANO: "Verano",
  INVIERNO: "Invierno",
  AMBAS: "Todo el año",
};

export const FOOD_GROUP_LABELS: Record<string, string> = {
  CARNE: "Carne",
  PESCADO: "Pescado",
  VERDURA: "Verdura",
  PASTA_ARROZ: "Pasta o arroz",
  LEGUMBRE: "Legumbre",
  HUEVO: "Huevo",
  OTRO: "Otro",
};

export const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
export const MEAL_TYPE_OPTIONS = Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => ({ value, label }));
export const SEASON_OPTIONS = Object.entries(SEASON_LABELS).map(([value, label]) => ({ value, label }));
export const FOOD_GROUP_OPTIONS = Object.entries(FOOD_GROUP_LABELS).map(([value, label]) => ({ value, label }));
