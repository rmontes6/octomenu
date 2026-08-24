#!/usr/bin/env bash
set -euo pipefail

# Despliegue por SSH sin build remoto: construye la imagen en local,
# la exporta a un .tar.gz, la copia al servidor y la levanta con
# docker compose. El servidor solo recibe la imagen ya construida
# (nunca el código fuente), pensado para hosts con poca RAM.
#
# automenu convive en el mismo EC2 que trip2millionaire, que ya ocupa
# los puertos 80/443 con su propio Caddy: este stack usa su propio
# Caddy en CADDY_PORT (por defecto 8443), de momento sirviendo HTTP
# plano (sin TLS), sin tocar el deploy de trip2millionaire.
#
# Requiere que DEPLOY_HOST y DEPLOY_PATH estén definidos en .env.
# DEPLOY_HOST debe ser un alias configurado en ~/.ssh/config.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

ENV_FILE="$REPO_ROOT/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: no existe $ENV_FILE" >&2
  exit 1
fi

env_var() {
  grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d '=' -f2-
}

DEPLOY_HOST="$(env_var DEPLOY_HOST)"
DEPLOY_PATH="$(env_var DEPLOY_PATH)"
PUBLIC_HOST="$(env_var DOMAIN)"
CADDY_PORT="$(env_var CADDY_PORT)"
CADDY_PORT="${CADDY_PORT:-8443}"

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "Error: define DEPLOY_HOST en .env (debe existir como Host en ~/.ssh/config)" >&2
  exit 1
fi
if [[ -z "$DEPLOY_PATH" ]]; then
  echo "Error: define DEPLOY_PATH en .env (ruta remota de despliegue)" >&2
  exit 1
fi
if [[ -z "$PUBLIC_HOST" ]]; then
  echo "Error: define DOMAIN en .env (hostname público)" >&2
  exit 1
fi

IMAGE_NAME="automenu"
IMAGE_TAG="latest"
IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"
TAR_NAME="${IMAGE_NAME}.tar.gz"

WORKDIR="$(mktemp -d)"
LOCAL_TAR="$WORKDIR/$TAR_NAME"
cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

NEXTAUTH_URL_REMOTE="http://${PUBLIC_HOST}:${CADDY_PORT}"

echo "==> Construyendo imagen $IMAGE_REF (NEXTAUTH_URL=${NEXTAUTH_URL_REMOTE})"
NEXTAUTH_URL="$NEXTAUTH_URL_REMOTE" docker compose build app

echo "==> Exportando imagen a $LOCAL_TAR"
docker save "$IMAGE_REF" | gzip > "$LOCAL_TAR"
du -h "$LOCAL_TAR"

echo "==> Preparando $DEPLOY_HOST:$DEPLOY_PATH"
ssh "$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"

# SEED_USERNAME/SEED_PASSWORD identifican el usuario de login de ESE entorno
# y no deben viajar desde el .env de desarrollo: si el remoto ya tiene un
# .env, se preservan sus valores en vez de sobrescribirlos con los locales.
REMOTE_SEED_USERNAME=""
REMOTE_SEED_PASSWORD=""
if ssh "$DEPLOY_HOST" "test -f '$DEPLOY_PATH/.env'"; then
  REMOTE_SEED_USERNAME="$(ssh "$DEPLOY_HOST" "grep -E '^SEED_USERNAME=' '$DEPLOY_PATH/.env' | tail -n1 | cut -d '=' -f2-" || true)"
  REMOTE_SEED_PASSWORD="$(ssh "$DEPLOY_HOST" "grep -E '^SEED_PASSWORD=' '$DEPLOY_PATH/.env' | tail -n1 | cut -d '=' -f2-" || true)"
fi
SEED_USERNAME_TO_USE="${REMOTE_SEED_USERNAME:-$(env_var SEED_USERNAME)}"
SEED_PASSWORD_TO_USE="${REMOTE_SEED_PASSWORD:-$(env_var SEED_PASSWORD)}"

echo "==> Preparando .env remoto (NEXTAUTH_URL=${NEXTAUTH_URL_REMOTE}, DOMAIN=${PUBLIC_HOST}, CADDY_PORT=${CADDY_PORT}, SEED_USERNAME=${SEED_USERNAME_TO_USE} preservado del servidor)"
REMOTE_ENV="$WORKDIR/.env"
grep -v -E "^(NEXTAUTH_URL|DOMAIN|CADDY_PORT|SEED_USERNAME|SEED_PASSWORD)=" "$ENV_FILE" > "$REMOTE_ENV"
{
  echo "NEXTAUTH_URL=${NEXTAUTH_URL_REMOTE}"
  echo "DOMAIN=${PUBLIC_HOST}"
  echo "CADDY_PORT=${CADDY_PORT}"
  echo "SEED_USERNAME=${SEED_USERNAME_TO_USE}"
  echo "SEED_PASSWORD=${SEED_PASSWORD_TO_USE}"
} >> "$REMOTE_ENV"

echo "==> Copiando compose.yml, Caddyfile, .env e imagen"
scp "$REPO_ROOT/compose.yml" "$REPO_ROOT/Caddyfile" "$REMOTE_ENV" "$LOCAL_TAR" "$DEPLOY_HOST:$DEPLOY_PATH/"

echo "==> Cargando imagen y levantando servicios en remoto"
ssh "$DEPLOY_HOST" bash -s <<EOF
set -euo pipefail
cd "$DEPLOY_PATH"
docker load -i "$TAR_NAME"
rm -f "$TAR_NAME"
docker compose up -d
docker image prune -f
EOF

echo "==> Deploy completado"
echo "App disponible en: ${NEXTAUTH_URL_REMOTE}"
