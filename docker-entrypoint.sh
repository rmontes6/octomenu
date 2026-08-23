#!/bin/sh
set -e

echo "Esperando a PostgreSQL..."
ATTEMPTS=0
until node -e "require('net').connect(5432, process.env.PGHOST || 'db').on('connect', function(){process.exit(0)}).on('error', function(){process.exit(1)})" 2>/dev/null
do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ "$ATTEMPTS" -ge 60 ]; then
    echo "PostgreSQL no respondió a tiempo."
    exit 1
  fi
  sleep 1
done
echo "PostgreSQL disponible."

echo "Aplicando migraciones..."
node_modules/.bin/prisma migrate deploy

echo "Ejecutando seed (crea/actualiza el usuario de SEED_USERNAME si hace falta)..."
node_modules/.bin/tsx prisma/seed.ts || true

echo "Arrancando aplicación..."
exec "$@"
