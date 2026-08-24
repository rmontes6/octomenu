# OctoMenu

Generador de menús semanales a partir de tu propio catálogo de platos, con lista de la compra automática.

Guardas los platos que sueles cocinar (con su categoría, si son de comida/cena/ambas, y sus ingredientes) y la app te genera el menú completo de la semana sin tener que pensarlo, más la lista de la compra correspondiente.

## Funcionalidad

- **Catálogo de platos** (`/platos`): alta, edición y baja de platos con categoría (plato único, primer plato, segundo plato, acompañamiento), franja (comida, cena o ambas), ingredientes (nombre, cantidad y unidad opcionales) y disponibilidad ("no disponible ahora" para excluirlo temporalmente sin borrarlo).
- **Generación de menú semanal** (`/menu`): un botón genera automáticamente los 7 días, decidiendo por cada comida/cena si va plato único o primero + segundo (con acompañamiento opcional), sin repetir ningún plato en la semana.
  - Los platos marcados como "rinde para 2 tomas" se repiten automáticamente al día siguiente en la misma franja (comida→comida, cena→cena), simulando que cocinas una vez y comes de ello dos veces.
  - Cada hueco se puede regenerar individualmente (🔀) si un plato no convence, sin rehacer toda la semana.
- **Lista de la compra** (`/menu/compra`): ingredientes de la semana seleccionada, sumados y agrupados automáticamente (los platos que son "sobras" del día anterior no vuelven a sumar ingredientes). Cada ingrediente se puede marcar como comprado; el estado se guarda y sobrevive a un reroll o a recargar la página.
- **Login** con usuario y contraseña (NextAuth), pensado para un único usuario.

## Stack

Next.js 14 (App Router) + TypeScript + Prisma/PostgreSQL + NextAuth + Tailwind CSS, dockerizado. Mismo patrón que el proyecto hermano `trip2millionaire`.

## Desarrollo local

Requisitos: Docker y Node 20 (usa `nvm` si lo tienes instalado).

```bash
./scripts/dev.sh
```

Este script, en un checkout limpio:

1. Crea `.env` a partir de `.env.example` generando secretos aleatorios si faltan.
2. Levanta solo Postgres en Docker (`docker compose up -d db`).
3. Instala dependencias (`npm install`) si hace falta.
4. Genera el cliente de Prisma y aplica las migraciones.
5. Crea (o actualiza) el usuario de login a partir de `SEED_USERNAME`/`SEED_PASSWORD`.
6. Arranca `next dev` con hot reload.

La app queda en `http://localhost:3001` (puerto configurable con `APP_PORT` en `.env`). El usuario y contraseña de login están en `.env` (`SEED_USERNAME`/`SEED_PASSWORD`, generados automáticamente la primera vez si no existían).

Para crear una migración nueva tras cambiar `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name <descripción>
```

## Despliegue

`./scripts/deploy.sh` construye la imagen Docker en local, la exporta y la copia por SSH al servidor definido por `DEPLOY_HOST`/`DEPLOY_PATH` en `.env` (nunca viaja código fuente, solo la imagen ya construida). Requiere que `DEPLOY_HOST` sea un alias configurado en `~/.ssh/config`.

> **Estado actual**: el despliegue todavía no se ha hecho. OctoMenu comparte servidor EC2 con `trip2millionaire`, que ya ocupa los puertos 80/443 con su propio Caddy; OctoMenu está preparado para convivir con su propio Caddy en un puerto alternativo (`CADDY_PORT`, por defecto 8443), sirviendo HTTP plano (sin TLS) de momento, sin tocar el deploy de `trip2millionaire`. Requiere abrir `CADDY_PORT` en el Security Group de la instancia.

## Estructura

```
prisma/schema.prisma       Modelo de datos (Dish, WeeklyMenu, MenuEntry, ShoppingListCheck...)
src/lib/menuGenerator.ts   Algoritmo de generación del menú (función pura, sin BD)
src/lib/menuService.ts     Capa que conecta el generador con Prisma (crear/regenerar/reroll)
src/lib/shoppingList.ts    Agregación de ingredientes en la lista de la compra
src/app/(app)/             Páginas de la app (platos, menu, menu/compra)
src/app/api/                Rutas API (dishes, weekly-menus, ...)
scripts/dev.sh              Arranque completo de desarrollo local
scripts/deploy.sh           Despliegue por SSH a producción
```
