"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import clsx from "@/lib/clsx";
import { CATEGORY_LABELS, CATEGORY_OPTIONS, MEAL_TYPE_LABELS, MEAL_TYPE_OPTIONS } from "@/lib/labels";

type Ingredient = { id?: string; name: string; quantity: number | null; unit: string | null };

type Dish = {
  id: string;
  name: string;
  category: string;
  mealType: string;
  yieldsTwoMeals: boolean;
  active: boolean;
  ingredients: Ingredient[];
};

type FormState = {
  name: string;
  category: string;
  mealType: string;
  yieldsTwoMeals: boolean;
  active: boolean;
  ingredients: Ingredient[];
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "PLATO_UNICO",
  mealType: "AMBAS",
  yieldsTwoMeals: false,
  active: true,
  ingredients: [{ name: "", quantity: null, unit: null }],
};

export default function DishesClient() {
  const router = useRouter();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [showInactive, setShowInactive] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/dishes")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("No se pudieron cargar los platos");
        return res.json();
      })
      .then((data: Dish[] | null) => {
        if (data) setDishes(data);
      })
      .catch(() => setError("No se pudieron cargar los platos"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(dish: Dish) {
    setEditingId(dish.id);
    setForm({
      name: dish.name,
      category: dish.category,
      mealType: dish.mealType,
      yieldsTwoMeals: dish.yieldsTwoMeals,
      active: dish.active,
      ingredients: dish.ingredients.length > 0 ? dish.ingredients : [{ name: "", quantity: null, unit: null }],
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing)),
    }));
  }

  function addIngredientRow() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { name: "", quantity: null, unit: null }] }));
  }

  function removeIngredientRow(index: number) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("Ponle un nombre al plato.");
      return;
    }
    const ingredients = form.ingredients
      .filter((ing) => ing.name.trim().length > 0)
      .map((ing) => ({ name: ing.name.trim(), quantity: ing.quantity, unit: ing.unit?.trim() || null }));

    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim(), ingredients };
      const url = editingId ? `/api/dishes/${editingId}` : "/api/dishes";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo guardar el plato");
      }
      const saved: Dish = await res.json();
      setDishes((prev) => {
        const exists = prev.some((d) => d.id === saved.id);
        return exists ? prev.map((d) => (d.id === saved.id ? saved : d)) : [...prev, saved];
      });
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este plato? Solo es posible si no aparece en ningún menú ya generado.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/dishes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo eliminar el plato");
      }
      setDishes((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleToggleActive(dish: Dish) {
    setTogglingId(dish.id);
    setError(null);
    try {
      const res = await fetch(`/api/dishes/${dish.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !dish.active }),
      });
      if (!res.ok) throw new Error("No se pudo actualizar la disponibilidad");
      const updated: Dish = await res.json();
      setDishes((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setTogglingId(null);
    }
  }

  const visible = dishes
    .filter((d) => categoryFilter === "ALL" || d.category === categoryFilter)
    .filter((d) => showInactive || d.active)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl border border-status-critical/30 bg-status-critical/10 px-3.5 py-2.5 text-sm text-status-critical">
          {error}
        </div>
      )}

      {!formOpen && (
        <button type="button" onClick={openCreate} className="btn-primary">
          + Nuevo plato
        </button>
      )}

      {formOpen && (
        <form onSubmit={handleSubmit} className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink-secondary dark:text-ink-dsecondary">
            {editingId ? "Editar plato" : "Nuevo plato"}
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-ink-secondary dark:text-ink-dsecondary">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="input"
                placeholder="Ej. Lentejas con chorizo"
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary dark:text-ink-dsecondary">Categoría</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="input"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary dark:text-ink-dsecondary">Comida / cena</label>
              <select
                value={form.mealType}
                onChange={(e) => setForm((f) => ({ ...f, mealType: e.target.value }))}
                className="input"
              >
                {MEAL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.yieldsTwoMeals}
                onChange={(e) => setForm((f) => ({ ...f, yieldsTwoMeals: e.target.checked }))}
                className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30 dark:border-white/20"
              />
              Rinde para 2 tomas (se repite al día siguiente en la misma franja)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30 dark:border-white/20"
              />
              Disponible ahora
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-ink-secondary dark:text-ink-dsecondary">Ingredientes</label>
            <div className="space-y-2">
              {form.ingredients.map((ing, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input
                    value={ing.name}
                    onChange={(e) => updateIngredient(i, { name: e.target.value })}
                    placeholder="Ingrediente"
                    className="input flex-1 basis-40"
                  />
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={ing.quantity ?? ""}
                    onChange={(e) => updateIngredient(i, { quantity: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Cantidad"
                    className="input w-28"
                  />
                  <input
                    value={ing.unit ?? ""}
                    onChange={(e) => updateIngredient(i, { unit: e.target.value })}
                    placeholder="Unidad (g, ud...)"
                    className="input w-32"
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredientRow(i)}
                    className="rounded-lg px-2 py-1 text-xs font-medium text-status-critical transition hover:bg-status-critical/10"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addIngredientRow}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand/10 dark:text-dbrand"
            >
              + Añadir ingrediente
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-ink-secondary transition hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-xl border border-black/10 p-1 dark:border-white/10">
          <button
            type="button"
            onClick={() => setCategoryFilter("ALL")}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition",
              categoryFilter === "ALL"
                ? "bg-brand/10 text-brand dark:text-dbrand"
                : "text-ink-secondary hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
            )}
          >
            Todas
          </button>
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCategoryFilter(opt.value)}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                categoryFilter === opt.value
                  ? "bg-brand/10 text-brand dark:text-dbrand"
                  : "text-ink-secondary hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-secondary dark:text-ink-dsecondary">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30 dark:border-white/20"
          />
          Mostrar no disponibles
        </label>
      </div>

      <div className="card divide-y divide-black/5 dark:divide-white/5">
        {loading && <div className="px-5 py-6 text-sm text-ink-muted">Cargando platos…</div>}
        {!loading && visible.length === 0 && (
          <div className="px-5 py-6 text-sm text-ink-muted">No hay platos que coincidan con el filtro.</div>
        )}
        {visible.map((dish) => (
          <div key={dish.id} className={clsx("flex flex-wrap items-center gap-3 px-5 py-3.5", !dish.active && "opacity-50")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{dish.name}</span>
                {dish.yieldsTwoMeals && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand dark:text-dbrand">
                    Rinde 2 tomas
                  </span>
                )}
                {!dish.active && (
                  <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-ink-muted dark:bg-white/10">
                    No disponible
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                {CATEGORY_LABELS[dish.category]} · {MEAL_TYPE_LABELS[dish.mealType]}
                {dish.ingredients.length > 0 && (
                  <> · {dish.ingredients.map((ing) => ing.name).join(", ")}</>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={togglingId === dish.id}
                onClick={() => handleToggleActive(dish)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-ink-secondary transition hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5 disabled:opacity-50"
              >
                {dish.active ? "Marcar no disponible" : "Marcar disponible"}
              </button>
              <button
                type="button"
                onClick={() => openEdit(dish)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-ink-secondary transition hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
              >
                Editar
              </button>
              <button
                type="button"
                disabled={deletingId === dish.id}
                onClick={() => handleDelete(dish.id)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-status-critical transition hover:bg-status-critical/10 disabled:opacity-50"
              >
                {deletingId === dish.id ? "…" : "Eliminar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
