"use client";

import { useState, type FormEvent, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/menu";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-page px-4 dark:bg-surface-darkpage">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #f97316 0%, #9a3412 45%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-2xl text-white shadow-lg"
            style={{ backgroundImage: "linear-gradient(180deg, #f97316 0%, #c2410c 55%, #9a3412 100%)" }}
          >
            🍽️
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">automenu</h1>
          <p className="mt-1 text-sm text-ink-secondary dark:text-ink-dsecondary">
            Inicia sesión para gestionar tu menú
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium text-ink-secondary dark:text-ink-dsecondary">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="Tu usuario"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-ink-secondary dark:text-ink-dsecondary">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-status-critical/30 bg-status-critical/10 px-3.5 py-2.5 text-sm text-status-critical">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
