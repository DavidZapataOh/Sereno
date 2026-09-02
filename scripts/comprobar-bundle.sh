#!/usr/bin/env bash
set -uo pipefail

# Le pone tope al tamaño del paquete que se instala en el teléfono.
#
# Nadie lo había medido nunca. Y es de las cosas que se degradan sin que nadie
# lo note: una dependencia nueva engorda el arranque de todos los días, y el
# coste aparece seis meses después, cuando ya hay diez y ninguna se puede
# quitar sin romper algo.
#
# Va en `integrar`, junto a `comprobar-plan` y `comprobar-secretos`: es el
# mismo tipo de guarda —algo que la suite no puede ver—. La idea no es que el
# número no suba nunca, sino que **suba a propósito**: subir el tope es una
# línea en un commit, y ahí queda dicho que alguien lo decidió.
#
# Medido el 2026-09-01: 5 171 970 bytes.

# El tope, en bytes. Un 25 % por encima de lo medido: sitio para crecer sin
# que una dependencia grande pase desapercibida.
TOPE=${SERENO_TOPE_BUNDLE:-6500000}

cd "$(dirname "$0")/.." || exit 1

salida="$(mktemp -d)"
trap 'rm -rf "$salida"' EXIT

echo "  Exportando el paquete de Android (tarda un minuto)…"
if ! npx expo export --platform android --output-dir "$salida" >/dev/null 2>&1; then
  echo "  ✗ La exportación falló. Con esto no se puede saber cuánto pesa el paquete."
  exit 1
fi

# El paquete es el .hbc: bytecode de Hermes, que es lo que de verdad se carga
# al abrir la app. Los assets van aparte y no cuestan arranque.
bundle="$(find "$salida" -name '*.hbc' -print -quit)"
if [ -z "$bundle" ]; then
  echo "  ✗ La exportación no produjo ningún .hbc. Algo cambió en el empaquetado."
  exit 1
fi

bytes="$(wc -c < "$bundle" | tr -d ' ')"
mb="$(awk -v b="$bytes" 'BEGIN { printf "%.2f", b / 1048576 }')"
topeMb="$(awk -v b="$TOPE" 'BEGIN { printf "%.2f", b / 1048576 }')"

if [ "$bytes" -gt "$TOPE" ]; then
  cat <<AVISO
  ✗ El paquete pesa $mb MB y el tope es $topeMb MB.

  Antes de subir el tope: mirar qué dependencia entró. El paquete se carga
  entero cada vez que se abre la app, y esto es lo único que lo vigila.

  Si el crecimiento es legítimo, se sube el tope en scripts/comprobar-bundle.sh
  y se dice por qué en el commit.
AVISO
  exit 1
fi

echo "  ✓ El paquete pesa $mb MB (tope: $topeMb MB)"
