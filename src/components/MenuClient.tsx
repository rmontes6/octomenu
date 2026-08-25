"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "@/lib/clsx";
import { addDaysUTC, dayLabel, formatDateDisplay, formatDateOnly, mondayOf, parseDateOnly } from "@/lib/dates";
import { CATEGORY_LABELS, CATEGORY_OPTIONS, DAY_LABELS } from "@/lib/labels";

type Dish = { id: string; name: string };

type MenuEntry = {
  id: string;
  dayOfWeek: number;
  mealType: "COMIDA" | "CENA";
  slot: string;
  dishId: string;
  leftoverOfId: string | null;
  dish: Dish;
};

type WeeklyMenu = {
  id: string;
  weekStart: string;
  entries: MenuEntry[];
};

type CatalogDish = {
  id: string;
  name: string;
  category: string;
  mealType: "COMIDA" | "CENA" | "AMBAS";
};

const SLOT_ORDER: Record<string, number> = { PLATO_UNICO: 0, PRIMERO: 1, SEGUNDO: 2, ACOMPANAMIENTO: 3 };
const MEAL_TYPES: Array<"COMIDA" | "CENA"> = ["COMIDA", "CENA"];
const MEAL_TYPE_SHORT: Record<"COMIDA" | "CENA", string> = { COMIDA: "Comida", CENA: "Cena" };

// Por defecto se asume fuera de casa viernes noche y todo el fin de semana
// (índices de DAY_LABELS: 4=viernes, 5=sábado, 6=domingo); el usuario puede
// desmarcarlo semana a semana antes de generar si un fin de semana concreto
// sí va a comer en casa.
const DEFAULT_EXCLUDED_SLOTS = new Set(["4-CENA", "5-COMIDA", "5-CENA", "6-COMIDA", "6-CENA"]);

/** "Hoy" como índice 0=lunes..6=domingo (mismo criterio UTC que `mondayOf`). */
function todayIndex(): number {
  const d = new Date().getUTCDay(); // 0=domingo..6=sábado
  return d === 0 ? 6 : d - 1;
}

/**
 * Exclusiones por defecto al entrar en una semana: el fin de semana (ver
 * `DEFAULT_EXCLUDED_SLOTS`) y, solo si `weekStartStr` es la semana en curso,
 * también cualquier día ya pasado (p. ej. generar en martes no debería
 * plantearse el lunes). El día de hoy nunca se pre-excluye: no hay forma
 * fiable de saber si ya has comido o no sin meternos en franjas horarias.
 * Sigue siendo un punto de partida, no una restricción: el usuario puede
 * desmarcarlo con el 🚫 si de verdad quiere rellenar un día ya pasado.
 */
function defaultExcludedSlots(weekStartStr: string): Set<string> {
  const slots = new Set(DEFAULT_EXCLUDED_SLOTS);
  if (weekStartStr === formatDateOnly(mondayOf(new Date()))) {
    for (let day = 0; day < todayIndex(); day++) {
      slots.add(`${day}-COMIDA`);
      slots.add(`${day}-CENA`);
    }
  }
  return slots;
}

export default function MenuClient() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [dishes, setDishes] = useState<CatalogDish[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [rerollingId, setRerollingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveBusyId, setMoveBusyId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ day: number; mealType: "COMIDA" | "CENA" }>({ day: 0, mealType: "COMIDA" });
  const [addingSlot, setAddingSlot] = useState<{ day: number; mealType: "COMIDA" | "CENA" } | null>(null);
  const [addCategory, setAddCategory] = useState("");
  const [addDishId, setAddDishId] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [excludedSlots, setExcludedSlots] = useState<Set<string>>(() => defaultExcludedSlots(formatDateOnly(weekStart)));
  const [error, setError] = useState<string | null>(null);

  const weekStartStr = formatDateOnly(weekStart);
  const isCurrentWeek = weekStartStr === formatDateOnly(mondayOf(new Date()));
  // No se guarda histórico más allá de la semana pasada (se borra
  // automáticamente), así que no tiene sentido dejar navegar más atrás: ahí
  // nunca va a haber nada que ver.
  const isEarliestWeek = weekStartStr === formatDateOnly(addDaysUTC(mondayOf(new Date()), -7));

  function load() {
    setLoading(true);
    setError(null);
    fetch(`/api/weekly-menus?weekStart=${weekStartStr}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("No se pudo cargar el menú");
        return res.json();
      })
      .then((data: WeeklyMenu | null) => setMenu(data))
      .catch(() => setError("No se pudo cargar el menú"))
      .finally(() => setLoading(false));
  }

  useEffect(load, [weekStartStr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // La edición solo tiene sentido en la semana en curso: al cambiar de
    // semana se sale del modo edición y se cierran los paneles abiertos.
    // Las exclusiones también son por semana: no tiene sentido arrastrar
    // "como fuera el viernes" de una semana a otra.
    setEditMode(false);
    setMovingId(null);
    setAddingSlot(null);
    setExcludedSlots(defaultExcludedSlots(weekStartStr));
  }, [weekStartStr]);

  useEffect(() => {
    fetch("/api/dishes")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: CatalogDish[]) => setDishes(data))
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (menu && !confirm("Ya hay un menú generado para esta semana. ¿Regenerarlo desde cero?")) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/weekly-menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: weekStartStr,
          force: !!menu,
          excludedSlots: [...excludedSlots].map((key) => {
            const [day, mealType] = key.split("-");
            return { dayOfWeek: Number(day), mealType };
          }),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo generar el menú");
      }
      setMenu(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerating(false);
    }
  }

  async function handleReroll(entryId: string) {
    if (!menu) return;
    setRerollingId(entryId);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-menus/${menu.id}/entries/${entryId}/reroll`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo cambiar el plato");
      }
      setMenu(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setRerollingId(null);
    }
  }

  async function handleRemove(entryId: string) {
    if (!menu) return;
    setRemovingId(entryId);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-menus/${menu.id}/entries/${entryId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo quitar el plato");
      }
      setMenu(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setRemovingId(null);
    }
  }

  function startMove(entry: MenuEntry) {
    setError(null);
    setMovingId(entry.id);
    setMoveTarget({ day: entry.dayOfWeek, mealType: entry.mealType });
  }

  async function confirmMove(entryId: string) {
    if (!menu) return;
    setMoveBusyId(entryId);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-menus/${menu.id}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayOfWeek: moveTarget.day, mealType: moveTarget.mealType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo mover el plato");
      }
      setMenu(await res.json());
      setMovingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setMoveBusyId(null);
    }
  }

  function startAdd(day: number, mealType: "COMIDA" | "CENA") {
    setError(null);
    setAddingSlot({ day, mealType });
    setAddCategory("");
    setAddDishId("");
  }

  async function confirmAdd() {
    if (!menu || !addingSlot || !addCategory || !addDishId) return;
    setAddBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/weekly-menus/${menu.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: addingSlot.day,
          mealType: addingSlot.mealType,
          slot: addCategory,
          dishId: addDishId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo añadir el plato");
      }
      setMenu(await res.json());
      setAddingSlot(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setAddBusy(false);
    }
  }

  function toggleExcluded(day: number, mealType: "COMIDA" | "CENA") {
    const key = `${day}-${mealType}`;
    setExcludedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function entriesFor(day: number, mealType: "COMIDA" | "CENA") {
    if (!menu) return [];
    return menu.entries
      .filter((e) => e.dayOfWeek === day && e.mealType === mealType)
      .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  }

  function freeCategoriesFor(day: number, mealType: "COMIDA" | "CENA") {
    const used = new Set(entriesFor(day, mealType).map((e) => e.slot));
    return CATEGORY_OPTIONS.filter((c) => !used.has(c.value));
  }

  const dishOptionsForAdd = addCategory
    ? dishes.filter(
        (d) => d.category === addCategory && (d.mealType === "AMBAS" || d.mealType === addingSlot?.mealType)
      )
    : [];

  // "Hoy" se resalta comparando con el día de la semana en curso (mismo
  // criterio UTC que `mondayOf`/`isCurrentWeek`, para que ambos coincidan).
  const todayIdx = todayIndex();

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl border border-status-critical/30 bg-status-critical/10 px-3.5 py-2.5 text-sm text-status-critical">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDaysUTC(w, -7))}
            disabled={isEarliestWeek}
            title={isEarliestWeek ? "No se guarda histórico más allá de la semana pasada" : undefined}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:border-white/10 dark:hover:bg-white/5"
          >
            ← Semana anterior
          </button>
          <span className="px-2 text-sm font-medium">
            {formatDateDisplay(weekStart)} - {formatDateDisplay(addDaysUTC(weekStart, 6))}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDaysUTC(w, 7))}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            Semana siguiente →
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isCurrentWeek && menu && (
            <button
              type="button"
              onClick={() => {
                setEditMode((v) => !v);
                setMovingId(null);
                setAddingSlot(null);
              }}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition",
                editMode
                  ? "border-brand/30 bg-brand/10 text-brand dark:text-dbrand"
                  : "border-black/10 text-ink-secondary hover:bg-black/5 dark:border-white/10 dark:text-ink-dsecondary dark:hover:bg-white/5"
              )}
            >
              {editMode ? "Listo" : "✏️ Editar"}
            </button>
          )}
          <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating ? "Generando…" : menu ? "Regenerar menú semanal" : "Generar menú semanal"}
          </button>
        </div>
      </div>

      {loading && <div className="text-sm text-ink-muted">Cargando…</div>}

      {!loading && !menu && (
        <div className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] px-4 py-3 text-sm text-ink-muted dark:border-white/15 dark:bg-white/[0.02]">
          Todavía no has generado el menú de esta semana. Si sabes que vas a comer fuera algún día, marca esas
          franjas con 🚫 antes de darle a &ldquo;Generar menú semanal&rdquo;.
          {isCurrentWeek && todayIdx > 0 && (
            <> Los días ya pasados de esta semana vienen premarcados como 🚫; desmárcalos si quieres rellenarlos igualmente.</>
          )}
        </div>
      )}

      {!loading && (
        <div
          className="rounded-2xl border border-brand/15 bg-[#f3e8d2] p-3 shadow-card dark:border-dbrand/15 dark:bg-[#1c130d] dark:shadow-card-dark sm:p-5"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(194,65,12,0.18) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {DAY_LABELS.map((label, day) => {
              const isToday = isCurrentWeek && day === todayIdx;
              return (
                <div
                  key={day}
                  className={clsx(
                    "relative flex flex-col gap-3 rounded-xl border p-3.5 shadow-sm transition",
                    isToday
                      ? "border-brand/40 bg-[#f9e2b8] dark:border-dbrand/40 dark:bg-[#3a2614]"
                      : "border-brand/15 bg-[#fdf3e7] dark:border-dbrand/15 dark:bg-[#2b1f16]"
                  )}
                >
                  {isToday && (
                    <span className="absolute -top-2.5 left-3.5 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white shadow-sm dark:bg-dbrand dark:text-surface-darkpage">
                      HOY
                    </span>
                  )}
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs text-ink-muted">{dayLabel(weekStart, day)}</span>
                  </div>
                  {MEAL_TYPES.map((mealType, mealIdx) => {
                    const items = entriesFor(day, mealType);
                    const free = freeCategoriesFor(day, mealType);
                    const isAddingHere = addingSlot?.day === day && addingSlot?.mealType === mealType;
                    const isExcluded = excludedSlots.has(`${day}-${mealType}`);
                    return (
                      <div
                        key={mealType}
                        className={clsx(
                          "space-y-1.5",
                          mealIdx > 0 && "border-t border-brand/10 pt-3 dark:border-dbrand/10"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-muted">
                            <span aria-hidden="true">{mealType === "COMIDA" ? "☀️" : "🌙"}</span>
                            {MEAL_TYPE_SHORT[mealType]}
                          </div>
                          <button
                            type="button"
                            title={
                              isExcluded
                                ? "Volver a generar en esta franja"
                                : "No generar nada aquí (p. ej. vas a comer fuera)"
                            }
                            onClick={() => toggleExcluded(day, mealType)}
                            className={clsx(
                              "rounded-full px-1.5 py-0.5 text-[10px] leading-none transition",
                              isExcluded
                                ? "bg-brand/15 text-brand dark:bg-dbrand/20 dark:text-dbrand"
                                : "text-ink-muted/40 hover:bg-black/5 hover:text-ink-muted dark:hover:bg-white/5"
                            )}
                          >
                            🚫
                          </button>
                        </div>
                        {items.length === 0 &&
                          !isAddingHere &&
                          (isExcluded ? (
                            <div className="rounded-lg border border-dashed border-brand/25 bg-brand/[0.04] px-2.5 py-2 text-center text-xs text-brand/80 dark:border-dbrand/25 dark:bg-dbrand/[0.06] dark:text-dbrand/80">
                              🚫 Fuera de casa
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-brand/15 px-2.5 py-2 text-center text-xs text-ink-muted dark:border-dbrand/15">
                              Sin plato
                            </div>
                          ))}
                    {items.map((entry) => {
                      const isMovingThis = movingId === entry.id;
                      return (
                        <div key={entry.id} className="space-y-1">
                          <div className="border-b border-brand/10 py-2 dark:border-dbrand/10">
                            <div className="text-sm font-medium">{entry.dish.name}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[10px] font-medium text-ink-muted dark:bg-white/10">
                                {CATEGORY_LABELS[entry.slot]}
                              </span>
                              {entry.leftoverOfId && (
                                <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand dark:text-dbrand">
                                  🔁 2ª toma
                                </span>
                              )}
                            </div>
                            {editMode && (
                              <div className="mt-1 flex items-center justify-end gap-0.5">
                                <button
                                  type="button"
                                  title="Cambiar por otro plato"
                                  disabled={rerollingId === entry.id}
                                  onClick={() => handleReroll(entry.id)}
                                  className="rounded-lg px-1.5 py-0.5 text-sm text-ink-muted transition hover:bg-black/10 disabled:opacity-40 dark:hover:bg-white/10"
                                >
                                  {rerollingId === entry.id ? "…" : "🔀"}
                                </button>
                                <button
                                  type="button"
                                  title="Mover a otro día/franja"
                                  disabled={!!entry.leftoverOfId}
                                  onClick={() => (isMovingThis ? setMovingId(null) : startMove(entry))}
                                  className="rounded-lg px-1.5 py-0.5 text-sm text-ink-muted transition hover:bg-black/10 disabled:opacity-30 dark:hover:bg-white/10"
                                >
                                  ↔️
                                </button>
                                <button
                                  type="button"
                                  title="Quitar del menú"
                                  disabled={removingId === entry.id}
                                  onClick={() => handleRemove(entry.id)}
                                  className="rounded-lg px-1.5 py-0.5 text-sm text-ink-muted transition hover:bg-black/10 disabled:opacity-40 dark:hover:bg-white/10"
                                >
                                  {removingId === entry.id ? "…" : "🗑️"}
                                </button>
                              </div>
                            )}
                          </div>
                          {isMovingThis && (
                            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-black/10 px-2 py-1.5 text-xs dark:border-white/10">
                              <select
                                value={moveTarget.day}
                                onChange={(e) => setMoveTarget((t) => ({ ...t, day: Number(e.target.value) }))}
                                className="rounded-lg border border-black/10 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-brand dark:border-white/10"
                              >
                                {DAY_LABELS.map((d, i) => (
                                  <option key={i} value={i}>
                                    {d}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={moveTarget.mealType}
                                onChange={(e) =>
                                  setMoveTarget((t) => ({ ...t, mealType: e.target.value as "COMIDA" | "CENA" }))
                                }
                                className="rounded-lg border border-black/10 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-brand dark:border-white/10"
                              >
                                {MEAL_TYPES.map((m) => (
                                  <option key={m} value={m}>
                                    {MEAL_TYPE_SHORT[m]}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                disabled={moveBusyId === entry.id}
                                onClick={() => confirmMove(entry.id)}
                                className="rounded-lg bg-brand/10 px-2 py-1 font-medium text-brand transition hover:bg-brand/20 disabled:opacity-40 dark:text-dbrand"
                              >
                                {moveBusyId === entry.id ? "…" : "Mover"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setMovingId(null)}
                                className="rounded-lg px-2 py-1 text-ink-muted transition hover:bg-black/5 dark:hover:bg-white/5"
                              >
                                Cancelar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {editMode && !isExcluded && (isAddingHere ? (
                      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-black/10 px-2 py-1.5 text-xs dark:border-white/10">
                        <select
                          value={addCategory}
                          onChange={(e) => {
                            setAddCategory(e.target.value);
                            setAddDishId("");
                          }}
                          className="rounded-lg border border-black/10 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-brand dark:border-white/10"
                        >
                          <option value="">Categoría…</option>
                          {free.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={addDishId}
                          onChange={(e) => setAddDishId(e.target.value)}
                          disabled={!addCategory}
                          className="rounded-lg border border-black/10 bg-transparent px-1.5 py-1 text-xs outline-none focus:border-brand dark:border-white/10"
                        >
                          <option value="">Plato…</option>
                          {dishOptionsForAdd.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={addBusy || !addCategory || !addDishId}
                          onClick={confirmAdd}
                          className="rounded-lg bg-brand/10 px-2 py-1 font-medium text-brand transition hover:bg-brand/20 disabled:opacity-40 dark:text-dbrand"
                        >
                          {addBusy ? "…" : "Añadir"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingSlot(null)}
                          className="rounded-lg px-2 py-1 text-ink-muted transition hover:bg-black/5 dark:hover:bg-white/5"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      free.length > 0 && (
                        <button
                          type="button"
                          onClick={() => startAdd(day, mealType)}
                          className="w-full rounded-lg border border-dashed border-black/15 px-2 py-1 text-xs font-medium text-ink-muted transition hover:border-brand/40 hover:text-brand dark:border-white/15 dark:hover:text-dbrand"
                        >
                          + Añadir plato
                        </button>
                      )
                    ))}
                  </div>
                );
              })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
