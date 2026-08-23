"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "@/lib/clsx";
import { addDaysUTC, dayLabel, formatDateOnly, mondayOf, parseDateOnly } from "@/lib/dates";
import { CATEGORY_LABELS, DAY_LABELS } from "@/lib/labels";

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

const SLOT_ORDER: Record<string, number> = { PLATO_UNICO: 0, PRIMERO: 1, SEGUNDO: 2, ACOMPANAMIENTO: 3 };
const MEAL_TYPES: Array<"COMIDA" | "CENA"> = ["COMIDA", "CENA"];

export default function MenuClient() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [rerollingId, setRerollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weekStartStr = formatDateOnly(weekStart);

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

  async function handleGenerate() {
    if (menu && !confirm("Ya hay un menú generado para esta semana. ¿Regenerarlo desde cero?")) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/weekly-menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStart: weekStartStr, force: !!menu }),
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

  function entriesFor(day: number, mealType: "COMIDA" | "CENA") {
    if (!menu) return [];
    return menu.entries
      .filter((e) => e.dayOfWeek === day && e.mealType === mealType)
      .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
  }

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
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            ← Semana anterior
          </button>
          <span className="px-2 text-sm font-medium">
            Semana del {formatDateOnly(weekStart)} al {formatDateOnly(addDaysUTC(weekStart, 6))}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDaysUTC(w, 7))}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium transition hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
          >
            Semana siguiente →
          </button>
        </div>
        <button type="button" onClick={handleGenerate} disabled={generating} className="btn-primary">
          {generating ? "Generando…" : menu ? "Regenerar menú semanal" : "Generar menú semanal"}
        </button>
      </div>

      {loading && <div className="text-sm text-ink-muted">Cargando…</div>}

      {!loading && !menu && (
        <div className="card px-5 py-8 text-center text-sm text-ink-muted">
          Todavía no hay menú generado para esta semana. Dale a &ldquo;Generar menú semanal&rdquo;.
        </div>
      )}

      {!loading && menu && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DAY_LABELS.map((label, day) => (
            <div key={day} className="card space-y-3 p-4">
              <div className="text-sm font-semibold">
                {label} <span className="font-normal text-ink-muted">· {dayLabel(weekStart, day)}</span>
              </div>
              {MEAL_TYPES.map((mealType) => {
                const items = entriesFor(day, mealType);
                return (
                  <div key={mealType} className="space-y-1.5">
                    <div className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                      {mealType === "COMIDA" ? "Comida" : "Cena"}
                    </div>
                    {items.length === 0 && <div className="text-xs text-ink-muted">—</div>}
                    {items.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between gap-2 rounded-lg bg-black/[0.03] px-2.5 py-1.5 dark:bg-white/[0.04]">
                        <div className="min-w-0">
                          <div className="truncate text-sm">{entry.dish.name}</div>
                          <div className="text-[11px] text-ink-muted">
                            {CATEGORY_LABELS[entry.slot]}
                            {entry.leftoverOfId && " · sobras"}
                          </div>
                        </div>
                        <button
                          type="button"
                          title="Cambiar por otro plato"
                          disabled={rerollingId === entry.id}
                          onClick={() => handleReroll(entry.id)}
                          className="shrink-0 rounded-lg px-1.5 py-0.5 text-sm text-ink-muted transition hover:bg-black/10 disabled:opacity-40 dark:hover:bg-white/10"
                        >
                          {rerollingId === entry.id ? "…" : "🔀"}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
