import type { Metadata, Viewport } from "next";
import { Caveat, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import { MARK_VERSION } from "@/lib/markVersion";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Fuente "de receta" para la lista de la compra: solo se usa ahí (nombres de
// ingredientes y cabeceras), el resto de la app sigue en Inter.
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-recipe",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OctoMenu",
  description: "Generador de menús semanales y lista de la compra",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "OctoMenu",
  },
  // Declared by hand (instead of the app/apple-icon.tsx file convention) so the URL's path
  // segment itself changes with MARK_VERSION — iOS's Home Screen icon cache ignores query-string
  // cache-busting, so the path is the only lever that reliably forces a refetch. See markVersion.ts.
  icons: {
    apple: `/touch-icon/${MARK_VERSION}`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f1ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a09" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} ${caveat.variable}`}>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
