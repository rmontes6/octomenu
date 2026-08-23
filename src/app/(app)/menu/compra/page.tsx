import ShoppingListClient from "@/components/ShoppingListClient";

export default function ShoppingListPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Lista de la compra</h1>
      <p className="mt-1 text-sm text-ink-secondary dark:text-ink-dsecondary">
        Ingredientes de la semana seleccionada, sumados y agrupados automáticamente.
      </p>
      <ShoppingListClient />
    </div>
  );
}
