export type IngredientLine = { name: string; quantity: number | null; unit: string | null };

export type EntryWithIngredients = {
  leftoverOfId: string | null;
  dish: { ingredients: IngredientLine[] };
};

export type ShoppingListItem = {
  itemKey: string;
  name: string;
  unit: string | null;
  quantity: number | null;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function itemKeyFor(name: string, unit: string | null) {
  return `${normalize(name)}|${unit ? normalize(unit) : ""}`;
}

/**
 * Agrega los ingredientes de todos los platos "originales" del menú semanal
 * (las copias de sobras no se cuentan: ya se compró y cocinó una vez).
 */
export function buildShoppingList(entries: EntryWithIngredients[]): ShoppingListItem[] {
  const map = new Map<string, ShoppingListItem>();

  for (const entry of entries) {
    if (entry.leftoverOfId !== null) continue;

    for (const ing of entry.dish.ingredients) {
      const unit = ing.unit?.trim() || null;
      const key = itemKeyFor(ing.name, unit);
      const existing = map.get(key);

      if (!existing) {
        map.set(key, { itemKey: key, name: ing.name.trim(), unit, quantity: ing.quantity ?? null });
        continue;
      }

      if (existing.quantity !== null && ing.quantity !== null) {
        existing.quantity += ing.quantity;
      } else {
        // No se puede sumar de forma fiable si a alguno le falta cantidad
        // (p.ej. "sal" sin cantidad): se deja listado sin cantidad.
        existing.quantity = null;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "es"));
}
