#!/usr/bin/env bash
set -euo pipefail

# Modo desarrollo: levanta solo Postgres en Docker (con el puerto
# publicado en localhost) y corre la app con `next dev` en local, con
# hot reload. La app NO se dockeriza aquí; para eso usa deploy.sh.
#
# Pensado para arrancar desde cero: si falta .env lo crea a partir de
# .env.example generando secretos aleatorios, si faltan node_modules
# instala dependencias, y si falta el cliente de Prisma lo genera.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="$REPO_ROOT/.env"
ENV_EXAMPLE="$REPO_ROOT/.env.example"

command -v docker >/dev/null 2>&1 || { echo "Error: docker no está instalado." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Error: docker no responde (¿está arrancado el daemon?)." >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Error: npm no está instalado." >&2; exit 1; }

random_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    head -c 32 /dev/urandom | base64
  fi
}

env_var() {
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d '=' -f2- || true
}

set_env_var() {
  local key="$1" value="$2"
  if grep -qE "^$key=" "$ENV_FILE"; then
    local tmp
    tmp="$(mktemp)"
    awk -F= -v k="$key" -v v="$value" 'BEGIN{OFS="="} $1==k{print k,v; next} {print}' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "$key=$value" >> "$ENV_FILE"
  fi
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> No existe .env, creándolo a partir de .env.example"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

for key in POSTGRES_PASSWORD NEXTAUTH_SECRET SEED_PASSWORD; do
  current="$(env_var "$key")"
  if [[ -z "$current" || "$current" == cambia-esto* ]]; then
    echo "==> Generando valor aleatorio para $key en .env"
    set_env_var "$key" "$(random_secret)"
  fi
done

POSTGRES_USER="$(env_var POSTGRES_USER)"
POSTGRES_USER="${POSTGRES_USER:-octomenu}"
POSTGRES_PASSWORD="$(env_var POSTGRES_PASSWORD)"
POSTGRES_DB="$(env_var POSTGRES_DB)"
POSTGRES_DB="${POSTGRES_DB:-octomenu}"
DB_PORT="$(env_var DB_PORT)"
DB_PORT="${DB_PORT:-5433}"
APP_PORT="$(env_var APP_PORT)"
APP_PORT="${APP_PORT:-3001}"

if [[ ! -d "$REPO_ROOT/node_modules" ]]; then
  echo "==> No existe node_modules, ejecutando npm install"
  npm install
fi

echo "==> Levantando Postgres (docker compose up -d db)"
docker compose up -d db

echo "==> Esperando a que Postgres esté listo..."
ATTEMPTS=0
until docker compose exec -T db pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [[ "$ATTEMPTS" -ge 30 ]]; then
    echo "Postgres no respondió a tiempo." >&2
    exit 1
  fi
  sleep 1
done
echo "Postgres disponible."

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${DB_PORT}/${POSTGRES_DB}?schema=public"
export NEXTAUTH_URL="$(env_var NEXTAUTH_URL)"
export NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:${APP_PORT}}"
export NEXTAUTH_SECRET="$(env_var NEXTAUTH_SECRET)"
export SEED_USERNAME="$(env_var SEED_USERNAME)"
export SEED_USERNAME="${SEED_USERNAME:-admin}"
export SEED_PASSWORD="$(env_var SEED_PASSWORD)"

if [[ ! -d "$REPO_ROOT/node_modules/.prisma" ]]; then
  echo "==> Generando cliente de Prisma"
  npx prisma generate
fi

echo "==> Aplicando migraciones"
npx prisma migrate deploy

echo "==> Ejecutando seed (crea/actualiza usuario si hace falta)"
npx tsx prisma/seed.ts || true

echo "==> Arrancando Next.js en modo desarrollo (hot reload) en el puerto $APP_PORT"
exec npx next dev -p "$APP_PORT"
