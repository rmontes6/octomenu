import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import UsersClient from "@/components/UsersClient";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  const isAdmin = Boolean(session?.user?.isAdmin);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
      <p className="mt-1 text-sm text-ink-secondary dark:text-ink-dsecondary">
        {isAdmin
          ? "Crea usuarios, resetea contraseñas o elimina cuentas."
          : "Cambia tu contraseña."}
      </p>
      <UsersClient />
    </div>
  );
}
