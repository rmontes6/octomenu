import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "automenu",
    short_name: "automenu",
    description: "Generador de menús semanales y lista de la compra",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f1ed",
    theme_color: "#f97316",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
