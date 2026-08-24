"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "@/lib/clsx";

type User = {
  id: string;
  username: string;
  createdAt: string;
  isAdmin: boolean;
};

export default function UsersClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const isAdmin = Boolean(session?.user?.isAdmin);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/users")
      .then((res) => {
        if (res.status === 401) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("No se pudieron cargar los usuarios");
        return res.json();
      })
      .then((data: User[] | null) => {
        if (data) setUsers(data);
      })
      .catch(() => setError("No se pudieron cargar los usuarios"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo crear el usuario");
      }
      const created: User = await res.json();
      setUsers((prev) => [...prev, created].sort((a, b) => a.username.localeCompare(b.username, "es")));
      setNewUsername("");
      setNewPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCreating(false);
    }
  }

  async function handleReset(id: string) {
    const password = resetPasswords[id] ?? "";
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setError(null);
    setResettingId(id);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo resetear la contraseña");
      }
      setResetPasswords((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setResettingId(null);
    }
  }

  async function handleDelete(user: User) {
    const isSelf = user.id === currentUserId;
    const confirmMsg = isSelf
      ? "Vas a eliminar tu propia cuenta. Se borrarán también todos tus platos y menús, y se cerrará tu sesión. ¿Continuar?"
      : `¿Eliminar al usuario "${user.username}"? Se borrarán también todos sus platos y menús.`;
    if (!confirm(confirmMsg)) return;

    setError(null);
    setDeletingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo eliminar el usuario");
      }
      if (isSelf) {
        await signOut({ callbackUrl: "/login" });
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div className="rounded-xl border border-status-critical/30 bg-status-critical/10 px-3.5 py-2.5 text-sm text-status-critical">
          {error}
        </div>
      )}

      {isAdmin && (
        <form onSubmit={handleCreate} className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink-secondary dark:text-ink-dsecondary">Nuevo usuario</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary dark:text-ink-dsecondary">Usuario</label>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="input"
                placeholder="Ej. maria"
                maxLength={30}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-ink-secondary dark:text-ink-dsecondary">Contraseña</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                placeholder="Mínimo 6 caracteres"
                maxLength={72}
              />
            </div>
          </div>
          <button type="submit" disabled={creating} className="btn-primary">
            {creating ? "Creando…" : "Crear"}
          </button>
        </form>
      )}

      <div className="card divide-y divide-black/5 dark:divide-white/5">
        {loading && <div className="px-5 py-6 text-sm text-ink-muted">Cargando usuarios…</div>}
        {!loading && users.length === 0 && (
          <div className="px-5 py-6 text-sm text-ink-muted">No hay usuarios.</div>
        )}
        {users.map((user) => (
          <div key={user.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{user.username}</span>
                {user.id === currentUserId && <span className="text-xs text-ink-muted">(tú)</span>}
                {user.isAdmin && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand dark:text-dbrand">
                    Admin
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">
                Alta: {new Date(user.createdAt).toLocaleDateString("es-ES")}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="password"
                value={resetPasswords[user.id] ?? ""}
                onChange={(e) => setResetPasswords((prev) => ({ ...prev, [user.id]: e.target.value }))}
                placeholder="Nueva contraseña"
                className="input w-40"
              />
              <button
                type="button"
                disabled={resettingId === user.id}
                onClick={() => handleReset(user.id)}
                className="rounded-lg px-2 py-1 text-xs font-medium text-ink-secondary transition hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5 disabled:opacity-50"
              >
                {resettingId === user.id ? "…" : "Resetear"}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  disabled={deletingId === user.id}
                  onClick={() => handleDelete(user)}
                  className={clsx(
                    "rounded-lg px-2 py-1 text-xs font-medium text-status-critical transition hover:bg-status-critical/10 disabled:opacity-50"
                  )}
                >
                  {deletingId === user.id ? "…" : "Eliminar"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
