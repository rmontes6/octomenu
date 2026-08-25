"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "@/lib/clsx";
import OctopusMark from "@/components/OctopusMark";

const ALL_LINKS = [
  { href: "/menu", label: "Menú" },
  { href: "/menu/compra", label: "Lista de la compra" },
  { href: "/platos", label: "Platos" },
];

// "/menu" no debe marcarse activo en "/menu/compra": esa ruta ya tiene su
// propio link. Gana el href más específico (más largo) que matchee.
function isActiveHref(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  return !ALL_LINKS.some(
    (l) => l.href !== href && l.href.length > href.length && (pathname === l.href || pathname.startsWith(l.href + "/"))
  );
}

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
            {ALL_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} pathname={pathname} />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-ink-muted sm:inline">{session?.user?.name}</span>
          <Link
            href="/ayuda"
            title="Ayuda"
            aria-label="Ayuda"
            className={clsx(
              "rounded-lg p-2 transition",
              pathname === "/ayuda"
                ? "bg-brand/10 text-brand dark:text-dbrand"
                : "text-ink-secondary hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
            )}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={12} cy={12} r={10} />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1={12} y1={17} x2={12.01} y2={17} />
            </svg>
          </Link>
          <Link
            href="/usuarios"
            title="Usuarios"
            aria-label="Usuarios"
            className={clsx(
              "rounded-lg p-2 transition",
              pathname === "/usuarios"
                ? "bg-brand/10 text-brand dark:text-dbrand"
                : "text-ink-secondary hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
            )}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={12} cy={8} r={4} />
              <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
            </svg>
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:bg-black/5 dark:border-white/10 dark:text-ink-dsecondary dark:hover:bg-white/5"
          >
            Salir
          </button>
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
        {ALL_LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label} pathname={pathname} whitespaceNowrap />
        ))}
      </nav>
    </header>
  );
}

function NavLink({
  href,
  label,
  pathname,
  whitespaceNowrap,
}: {
  href: string;
  label: string;
  pathname: string | null;
  whitespaceNowrap?: boolean;
}) {
  const active = isActiveHref(pathname, href);
  return (
    <Link
      href={href}
      className={clsx(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        whitespaceNowrap && "whitespace-nowrap",
        active
          ? "bg-brand/10 text-brand dark:text-dbrand"
          : "text-ink-secondary hover:bg-black/5 dark:text-ink-dsecondary dark:hover:bg-white/5"
      )}
    >
      {label}
    </Link>
  );
}
