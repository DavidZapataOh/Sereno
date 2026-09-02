#!/usr/bin/env bash
set -uo pipefail

# Comprueba que ningún plan marcado «✅ Completado» tenga trabajo sin hacer.
#
# Existe por lo que pasó en el sprint 08: los cinco planes se cerraron con ✅
# porque `npm run verify` pasaba y la rama estaba integrada. Pero cuatro tareas
# no se habían hecho, y ningún plan cumplía sus criterios de verificación —los
# que empiezan por «En el teléfono»—. El resultado fue un sprint entero que el
# usuario no podía ver, y un progress.md que decía lo contrario.
#
# La lección: `verify` demuestra que el código que existe funciona. No dice
# nada del código que falta. Hacía falta una señal para lo segundo.
#
# Comprueba dos cosas, ambas mecánicas:
#
#   1. Cada ruta que un plan declara con `Create:` existe en el disco. Un
#      renombrado durante la ejecución también salta, y está bien que salte:
#      obliga a corregir el plan o a justificarlo en progress.md.
#   2. Ningún plan marcado ✅ tiene tareas o criterios de verificación sin
#      recorrer.
#   3. Ningún plan con todos sus pasos recorridos sigue diciendo «No iniciado»
#      en la tabla. Este se añadió el 2026-09-01, cuando se encontraron los
#      sprints 10 y 11 con los planes en `main` y la tabla entera sin tocar:
#      el guion no dijo nada porque **solo miraba las filas ✅**, y una fila sin
#      tocar se saltaba. Un registro que calla se lee igual que uno que miente.
#
# No decide nada por su cuenta: enseña la lista y para. Quien la lea decide si
# es un renombrado o es trabajo que falta —pero ya no puede no verla.

PLANES="${PLANES_DIR:-../docs/superpowers/plans}"
cd "$(dirname "$0")/.." || exit 1
[ -d "$PLANES" ] || { echo "  (sin planes en $PLANES, no hay nada que comprobar)"; exit 0; }

fallos=0

for sprint in "$PLANES"/sprint-*/; do
  progress="$sprint/progress.md"
  [ -f "$progress" ] || continue

  # Solo los sprints en marcha o dados por cerrados. Los que aún no se han
  # empezado declaran archivos que, por definición, no existen todavía.
  grep -qE '✅|⚠️|🔄' "$progress" || continue

  for plan in "$sprint"/[0-9][0-9]-*.md; do
    [ -f "$plan" ] || continue
    nombre="$(basename "$plan" .md)"
    case "$nombre" in *DESCARTADO*) continue;; esac

    # ¿Este plan está dado por terminado en la tabla del progress?
    #
    # Se cruza por el NÚMERO del plan, no por el nombre: en la tabla va como
    # «Wallets on-chain» y el archivo se llama «02-wallets-on-chain.md», y
    # cruzarlos por nombre no casa nunca. Se descubrió probando el guion contra
    # el fallo real que lo motivó, y en silencio habría dado siempre verde.
    # El número puede ir en la primera columna («| 01 | Plan | ✅ |») o en la
    # segunda cuando el sprint lleva orden de ejecución («| 2º | 02 | ... |»).
    numero="${nombre%%-*}"
    linea="$(grep -E "^\\| *${numero} *\\||^\\|[^|]*\\| *${numero} *\\|" "$progress" | head -1)"
    if [ -z "$linea" ]; then
      # Sin fila no se puede saber nada. Se avisa una sola vez por sprint y no
      # se cuenta como fallo: el formato de la tabla no es el objeto de esto.
      echo "  ? $(basename "$sprint")/$nombre — sin fila en la tabla de progress.md"
      continue
    fi
    # Un plan con pasos recorridos y la fila sin tocar. No es que el registro
    # mienta: es que no dice nada, y a las tres semanas eso se lee como «no se
    # hizo».
    #
    # Basta **un** paso marcado: si se empezó, la fila tenía que decir 🔄, y si
    # se terminó, ✅ o ⚠️. Exigir que estuvieran todos dejaba pasar justo el
    # caso de en medio, que es cuando el registro más falta hace.
    if echo "$linea" | grep -q 'No iniciado'; then
      if [ "$(grep -c '^- \[x\] \*\*Step' "$plan")" -gt 0 ]; then
        fallos=$((fallos + 1))
        echo "  ✗ $(basename "$sprint")/$nombre — tiene pasos recorridos y la tabla dice «No iniciado»"
      fi
      continue
    fi

    echo "$linea" | grep -q '✅' || continue

    pendientes=""

    while read -r ruta; do
      [ -z "$ruta" ] && continue
      [ -e "$ruta" ] || pendientes="$pendientes\n      falta el archivo: $ruta"
    done < <(sed -n '/^\*\*Files:\*\*/,/^\*\*/p' "$plan" \
             | grep -oE '`(src|servidor|scripts|drizzle)/[A-Za-z0-9._/-]+\.(ts|tsx|sql)`' \
             | tr -d '`' | sort -u)

    sinRecorrer="$(sed -n '/^## Verificación del plan/,$p' "$plan" | grep -c '^- \[ \]')"
    if [ "$sinRecorrer" -gt 0 ]; then
      pendientes="$pendientes\n      $sinRecorrer criterio(s) de verificación sin recorrer"
    fi

    if [ -n "$pendientes" ]; then
      fallos=$((fallos + 1))
      echo "  ✗ $(basename "$sprint")/$nombre — marcado ✅ pero:"
      printf "%b\n" "$pendientes"
    fi
  done
done

if [ "$fallos" -gt 0 ]; then
  cat <<'AVISO'

  ─────────────────────────────────────────────────────────────────────
  Hay planes cuyo registro no coincide con lo que se hizo.

  Antes de seguir, para cada uno: o se hace lo que falta, o se pone en
  progress.md el estado real —🔄 en curso, ⚠️ parcial— diciendo qué falta
  y por qué. Un renombrado se corrige en el plan.

  Lo que NO vale es dejarlo ✅ con trabajo sin hacer, ni dejar la fila en
  «No iniciado» con el trabajo hecho. Un registro que miente es peor que
  el código que falta, porque el código ausente se nota y el registro no.
  Y uno que calla se lee, a las tres semanas, igual que uno que miente.
  ─────────────────────────────────────────────────────────────────────
AVISO
  exit 1
fi

echo "  ✓ El registro de los planes coincide con lo que se hizo"
