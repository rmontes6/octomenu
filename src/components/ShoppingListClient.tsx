"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "@/lib/clsx";
import { addDaysUTC, formatDateDisplay, formatDateOnly, mondayOf } from "@/lib/dates";

type Item = { itemKey: string; name: string; unit: string | null; quantity: number | null; checked: boolean };

function formatQuantity(item: Item) {
  if (item.quantity === null) return null;
  const rounded = Math.round(item.quantity * 100) / 100;
  return `${rounded}${item.unit ? ` ${item.unit}` : ""}`;
}

function ShoppingItemRow({ item, onToggle }: { item: Item; onToggle: () => void }) {
  return (
    <label
      className={clsx(
        "flex cursor-pointer items-center gap-3 rounded-2xl border border-brand/15 bg-[#fdf3e7] px-3.5 py-3 shadow-sm transition hover:-translate-y-px hover:shadow-md dark:border-dbrand/15 dark:bg-[#2b1f16]",
        item.checked && "opacity-60"
      )}
    >
      <input type="checkbox" checked={item.checked} onChange={onToggle} className="peer sr-only" />
      <span
        className={clsx(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30 dark:peer-focus-visible:ring-dbrand/30",
          item.checked
            ? "border-brand bg-brand dark:border-dbrand dark:bg-dbrand"
            : "border-brand/30 dark:border-dbrand/35"
        )}
      >
        {item.checked && (
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className={clsx("font-recipe flex-1 text-lg leading-none", item.checked && "line-through")}>
        {item.name}
      </span>
      {formatQuantity(item) && (
        <span className="shrink-0 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand dark:bg-dbrand/15 dark:text-dbrand">
          {formatQuantity(item)}
        </span>
      )}
    </label>
  );
}

export default function ShoppingListClient() {
  const router = useRouter();
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
  const [menuId, setMenuId] = useState<string | null | undefined>(undefined); // undefined = cargando
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const weekStartStr = formatDateOnly(weekStart);
  // A diferencia del menú, aquí no se guarda ni la semana pasada: los checks
  // de la compra no le sirven a nadie una vez pasada la semana, así que no
  // se puede navegar más atrás que la semana actual.
  const isEarliestWeek = weekStartStr === formatDateOnly(mondayOf(new Date()));

  useEffect(() => {
    setLoading(true);
    setError(null);
    setMenuId(undefined);
    fetch(`/api/weekly-menus?weekStart=${weekStartStr}`)
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("No se pudo cargar el menú");
        return res.json();
      })
      .then((menu: { id: string } | null) => {
        setMenuId(menu?.id ?? null);
        if (!menu) {
          setItems([]);
          setLoading(false);
          return;
        }
        return fetch(`/api/weekly-menus/${menu.id}/shopping-list`)
          .then((res) => {
            if (!res.ok) throw new Error("No se pudo cargar la lista de la compra");
            return res.json();
          })
          .then((data: Item[]) => setItems(data))
          .finally(() => setLoading(false));
      })
      .catch(() => {
        setError("No se pudo cargar la lista de la compra");
        setLoading(false);
      });
  }, [weekStartStr]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleChecked(item: Item) {
    if (!menuId) return;
    const nextChecked = !item.checked;
    setItems((prev) => prev.map((i) => (i.itemKey === item.itemKey ? { ...i, checked: nextChecked } : i)));
    try {
      const res = await fetch(`/api/weekly-menus/${menuId}/shopping-list`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemKey: item.itemKey, checked: nextChecked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setItems((prev) => prev.map((i) => (i.itemKey === item.itemKey ? { ...i, checked: !nextChecked } : i)));
      setError("No se pudo guardar el check, inténtalo de nuevo.");
    }
  }

  const pending = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl border border-status-critical/30 bg-status-critical/10 px-3.5 py-2.5 text-sm text-status-critical">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setWeekStart((w) => addDaysUTC(w, -7))}
          disabled={isEarliestWeek}
          title={isEarliestWeek ? "La lista de la compra solo está disponible para la semana actual en adelante" : undefined}
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

      {loading && <div className="text-sm text-ink-muted">Cargando…</div>}

      {!loading && menuId === null && (
        <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-5 py-8 text-center text-sm text-ink-muted dark:border-white/15 dark:bg-white/[0.02]">
          Esta semana todavía no tiene menú generado. Genera el menú primero desde la pestaña &ldquo;Menú&rdquo;.
        </div>
      )}

      {!loading && menuId && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-5 py-8 text-center text-sm text-ink-muted dark:border-white/15 dark:bg-white/[0.02]">
          El menú de esta semana no tiene ingredientes registrados.
        </div>
      )}

      {!loading && menuId && items.length > 0 && (
        <div
          className="rounded-2xl border border-brand/15 bg-[#f3e8d2] p-3 shadow-card dark:border-dbrand/15 dark:bg-[#1c130d] dark:shadow-card-dark sm:p-5"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(194,65,12,0.18) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        >
          <div className="space-y-1.5">
            <div className="font-recipe text-xl leading-none text-ink-secondary dark:text-ink-dsecondary">
              🛒 Por comprar {pending.length > 0 && `· ${pending.length}`}
            </div>
            {pending.length === 0 ? (
              <div className="rounded-lg border border-dashed border-brand/25 bg-brand/[0.04] px-3 py-3 text-center text-xs text-brand/80 dark:border-dbrand/25 dark:bg-dbrand/[0.06] dark:text-dbrand/80">
                🎉 No queda nada por comprar
              </div>
            ) : (
              <div className="space-y-1.5">
                {pending.map((item) => (
                  <ShoppingItemRow key={item.itemKey} item={item} onToggle={() => toggleChecked(item)} />
                ))}
              </div>
            )}
          </div>

          {checked.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
              <div className="font-recipe text-xl leading-none text-ink-secondary dark:text-ink-dsecondary">
                Ya en el carro · {checked.length}
              </div>
              <div className="space-y-1.5">
                {checked.map((item) => (
                  <ShoppingItemRow key={item.itemKey} item={item} onToggle={() => toggleChecked(item)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
