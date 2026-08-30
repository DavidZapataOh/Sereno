# Tipografía

## Familia

**Inter**, en variantes estáticas (400, 500, 600, 700). Elegida por sus cifras tabulares,
su altura de x generosa y la distinción clara entre caracteres confundibles en pantalla
pequeña: `1`/`l`/`I`, `0`/`O`.

No se usa la versión variable: las fuentes variables no tienen soporte uniforme en todas
las plataformas. Con estáticas, el peso va en la familia (`Inter_600SemiBold`) y no en
`fontWeight`, que en Android puede provocar una caída a la fuente del sistema.

Las fuentes se cargan al arrancar y la pantalla de inicio espera a que estén listas. Si la
carga falla, la app arranca igual con la fuente del sistema: quedarse en el logo para
siempre sería peor.

## Cifras

Todo monto se pinta con `<Money>`. Nunca con `<Text>` directamente.

El componente garantiza cinco cosas a la vez:

1. **Formato colombiano** — punto de miles, coma decimal, sin decimales en pesos.
2. **Moneda explícita** — cada monto declara la suya; el símbolo va delante (`$`, `₿`) o
   el código detrás (`USDT`).
3. **Signo explícito** — `+` o `−` (menos tipográfico, no guion), porque el color no
   puede ser el único canal. El cero no lleva signo.
4. **Cifras tabulares** — para que una columna de montos alinee.
5. **Etiqueta para el lector de pantalla** — «Salen 45.000 pesos», con la moneda por su
   nombre y no por su símbolo.

El monto llega en `bigint`, en la unidad mínima de su moneda, tal como lo guarda el
ledger. Un `number` se acepta solo si es entero y seguro; con decimales, lanza.

### Estado de `fontVariant` en Android

**Pendiente de verificación en dispositivo.** La propiedad `fontVariant:
['tabular-nums']` tiene soporte irregular con fuentes cargadas por `expo-font`. Las
pruebas confirman que se aplica; no que el motor de fuentes la respete. Se comprueba en la
sesión de campo del sprint con la pantalla de diagnóstico, que apila montos de anchos
distintos. Si no alinean, el cambio afecta solo a `typography.ts` y `money.tsx`.

## Escala

| Nivel          | Tamaño | Peso     | Uso                                               |
| -------------- | ------ | -------- | ------------------------------------------------- |
| `montoGrande`  | 40     | Bold     | El patrimonio, la cifra principal de una pantalla |
| `titulo`       | 28     | Bold     | Título de pantalla                                |
| `montoMediano` | 20     | SemiBold | Montos en tarjetas y detalles                     |
| `subtitulo`    | 18     | SemiBold | Encabezado de sección                             |
| `cuerpo`       | 16     | Regular  | Texto general                                     |
| `montoPequeno` | 15     | Medium   | Montos en filas de lista                          |
| `apoyo`        | 14     | Regular  | Fechas, categorías, contexto                      |
| `micro`        | 12     | Medium   | Marcas de tiempo, etiquetas                       |

Ocho niveles, estrictamente decrecientes, sin dos iguales. Pocos y bien separados es lo
que permite que una pantalla densa no se sienta apretada. Nada baja de 12: por debajo no
se lee en un teléfono.

El espaciado negativo entre letras solo aparece de 20 en adelante: a tamaño pequeño,
juntar las letras las vuelve ilegibles.

## Ampliación de fuente

`allowFontScaling` **nunca** se desactiva. Se acota con `maxFontSizeMultiplier` (1,6) en los
montos, para que el texto al 200 % no rompa el diseño sin dejar de crecer. Quien amplía la
fuente lo hace porque la necesita.
