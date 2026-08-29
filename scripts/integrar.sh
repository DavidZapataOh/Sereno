#!/usr/bin/env bash
#
# Integra la rama de trabajo actual en main, de una sola vez.
#
#   npm run integrar
#
# Existe porque el flujo manual pedía acordarse de dos pushes por sprint —el de
# la rama y el de main—, y main se quedó parado dos sprints sin que nadie lo
# notara. Aquí o pasa todo, o no pasa nada.
#
# Orden deliberado: se espera a que CI pase ANTES de tocar main. Fusionar
# primero y comprobar después deja main roto mientras se investiga.
set -euo pipefail

REPO="DavidZapataOh/Sereno"
PRINCIPAL="main"

# Se trabaja desde la raíz del repo pase lo que pase, no desde donde se invoque.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Un shell NO interactivo —el que abre `wsl -- npm`— no carga nvm y coge el
# /usr/bin/node del sistema. Con ese, better-sqlite3 mata el proceso con
# SIGSEGV. En vez de exigir que quien lo lanza se acuerde, se carga nvm aquí.
if ! node scripts/comprobar-node.mjs >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    set +u
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
    nvm use >/dev/null 2>&1 || true
    set -u
  fi
fi

# Si después de eso sigue mal, que lo diga con detalle y pare antes de tocar nada.
node scripts/comprobar-node.mjs

rojo()  { printf '\033[31m%s\033[0m\n' "$1"; }
verde() { printf '\033[32m%s\033[0m\n' "$1"; }
paso()  { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

rama=$(git rev-parse --abbrev-ref HEAD)

if [ "$rama" = "$PRINCIPAL" ]; then
  rojo "Estás en $PRINCIPAL. Este guion integra una rama de trabajo EN $PRINCIPAL."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  rojo "Hay cambios sin confirmar. Confírmalos o descártalos antes de integrar:"
  git status --short
  exit 1
fi

paso "Verificando en local antes de subir nada"
npm run verify

paso "Subiendo $rama"
git push -u origin "$rama"

sha=$(git rev-parse HEAD)
paso "Esperando a CI sobre $sha"
echo "  https://github.com/$REPO/actions"

for _ in $(seq 1 60); do
  json=$(curl -sf "https://api.github.com/repos/$REPO/commits/$sha/check-runs" || echo '')
  estado=$(printf '%s' "$json" | python3 -c '
import sys, json
try:
    runs = json.load(sys.stdin).get("check_runs", [])
except Exception:
    print("esperando"); raise SystemExit
if not runs:
    print("esperando"); raise SystemExit
if any(r.get("status") != "completed" for r in runs):
    print("corriendo"); raise SystemExit
fallidos = [r["name"] for r in runs if r.get("conclusion") != "success"]
print("fallo:" + ",".join(fallidos) if fallidos else "verde")
' 2>/dev/null || echo esperando)

  case "$estado" in
    verde) verde "  CI en verde"; break ;;
    fallo:*)
      rojo "  CI falló: ${estado#fallo:}"
      rojo "  No se toca $PRINCIPAL. Revisa: https://github.com/$REPO/actions"
      exit 1 ;;
    *) printf '.' ; sleep 20 ;;
  esac
done

if [ "${estado:-}" != "verde" ]; then
  rojo "CI no terminó a tiempo. No se toca $PRINCIPAL."
  exit 1
fi

paso "Fusionando en $PRINCIPAL"
git checkout "$PRINCIPAL"
git pull --ff-only
git merge --no-ff "$rama" -m "Merge: $rama"

paso "Verificando el resultado de la fusión"
# Una suite verde en la rama solo demuestra que la rama estaba bien. Lo que se
# publica es el árbol fusionado, así que es ese el que hay que comprobar.
if ! npm run verify; then
  rojo "La fusión rompe algo. Se deshace y $PRINCIPAL queda como estaba."
  git merge --abort 2>/dev/null || git reset --hard "origin/$PRINCIPAL"
  git checkout "$rama"
  exit 1
fi

paso "Publicando $PRINCIPAL"
git push origin "$PRINCIPAL"

paso "Borrando la rama ya integrada"
# Se borra al final, y solo aquí: hacerlo antes de confirmar que la fusión llegó
# al remoto es cómo se pierde trabajo.
git branch -d "$rama"
git push origin --delete "$rama"

verde ""
verde "Listo. $rama integrada en $PRINCIPAL y publicada."
