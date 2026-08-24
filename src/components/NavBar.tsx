"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "@/lib/clsx";
import OctopusMark from "@/components/OctopusMark";

const LINKS = [
  { href: "/menu", label: "Menú" },
  { href: "/menu/compra", label: "Lista de la compra" },
  { href: "/platos", label: "Platos" },
  { href: "/usuarios", label: "Usuarios" },
];

export default function NavBar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-surface-page/75 shadow-[0_1px_0_0_rgba(0,0,0,0.02)] backdrop-blur-md dark:border-white/[0.06] dark:bg-surface-darkpage/75">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/menu" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl shadow-md shadow-brand/30"
              style={{ backgroundImage: "linear-gradient(180deg, #f97316 0%, #c2410c 55%, #9a3412 100%)" }}
            >
              <OctopusMark color="#fdf3e7" size={20} />
            </span>
            OctoMenu
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname?.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    active
                      ? "bg-brand/10 text-brand dark:text-dbrand"
                      : "text-ink-secondary hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-ink-muted sm:inline">{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:bg-black/5 dark:border-white/10 dark:text-ink-dsecondary dark:hover:bg-white/5"
          >
            Salir
          </button>
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
        {LINKS.map((link) => {
          const active = pathname === link.href || pathname?.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition",
                active
                  ? "bg-brand/10 text-brand dark:text-dbrand"
                  : "text-ink-secondary hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
