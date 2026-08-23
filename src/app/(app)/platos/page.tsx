import DishesClient from "@/components/DishesClient";

export default function PlatosPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Platos</h1>
      <p className="mt-1 text-sm text-ink-secondary dark:text-ink-dsecondary">
        El catálogo de platos que el generador usará para armar tus menús semanales.
      </p>
      <DishesClient />
    </div>
  );
}
