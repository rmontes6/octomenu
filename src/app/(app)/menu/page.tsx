import MenuClient from "@/components/MenuClient";

export default function MenuPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Menú semanal</h1>
      <p className="mt-1 text-sm text-ink-secondary dark:text-ink-dsecondary">
        Genera automáticamente el menú de la semana a partir de tu catálogo de platos.
      </p>
      <MenuClient />
    </div>
  );
}
