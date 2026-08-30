# Color

## Proporción: 60 / 30 / 10

| Proporción | Qué                                                     | Tokens                                                |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------- |
| **60 %**   | Superficies neutras que se quedan en segundo plano      | `background`, `surface`, `surfaceAlt`                 |
| **30 %**   | Texto en grises con jerarquía                           | `textPrimary`, `textSecondary`, `textMuted`, `border` |
| **10 %**   | Color con significado: identidad y semántica financiera | `accent`, `ingreso`, `gasto`, `deuda`, `peligro`      |

Menos es más. Si una pantalla tiene cinco colores compitiendo, ninguno informa. Los iconos
no llevan color: su trabajo es ser reconocibles, y el color se reserva para el estado
—la pestaña activa, el monto que entra—.

Los neutros no son gris puro: llevan un matiz frío casi imperceptible, el azul de noche
de la identidad muy diluido. Es lo que hace que el fondo se sienta de esta app y no del
sistema, sin que nadie pueda señalar por qué.

## Semántica

| Token                                | Cuándo se usa                                    | Nunca                                    |
| ------------------------------------ | ------------------------------------------------ | ---------------------------------------- |
| `textPrimary`                        | Montos, títulos, todo lo que se lee primero      | Texto de apoyo                           |
| `textSecondary`                      | Fechas, categorías, contexto de una fila         | Un monto                                 |
| `textMuted`                          | Texto auxiliar, estados vacíos, marcas de tiempo | Información necesaria para decidir       |
| `accent`                             | Acciones principales, elemento seleccionado      | Para llamar la atención sobre un dato    |
| `accentPressed`                      | El acento mientras se pulsa                      | Como color en reposo                     |
| `ingreso`                            | Dinero que entra                                 | Cualquier cosa positiva en general       |
| `gasto`                              | Dinero que sale                                  | Errores, advertencias, botones de borrar |
| `deuda`                              | Obligaciones pendientes y cuotas                 | Un gasto ya ejecutado                    |
| `peligro`                            | Acciones destructivas y errores del sistema      | Un gasto; un saldo negativo              |
| `border`                             | Separadores entre filas                          | Bordes de campos interactivos            |
| `borderStrong`                       | Bordes de campos y controles                     | Separadores decorativos                  |
| `surfacePressed`                     | Una fila o tarjeta mientras se pulsa             | Como fondo en reposo                     |
| `onAccent` · `onGasto` · `onPeligro` | Texto encima de ese relleno                      | Sobre el fondo de la app                 |

## Reglas

**El color nunca informa solo.** Todo monto lleva signo (`+` / `−`) y, cuando el contexto
no lo deja claro, una etiqueta. Cerca del 8 % de los hombres no distingue rojo de verde:
para ellos, la fila verde y la fila roja son la misma fila.

**El gasto no es una alarma.** Es el estado normal del dinero. El rojo de `gasto` es
terracota, no bermellón. Los rojos saturados son `peligro`, y se reservan para acciones
destructivas y errores reales del sistema. Un botón de «borrar» va en `peligro` aunque
desentone con la identidad: lo que importa es que se lea como destructivo, y el ámbar no
lo dice.

**La deuda tiene color propio.** No es un gasto: es una obligación futura. Confundirlos
en el color hace que una compra a cuotas parezca un gasto ya ocurrido.

**Ni negro ni blanco puros para el texto.** `textPrimary` claro es `#14161F`; el oscuro,
`#F2F4F8`. Los grises dan jerarquía; el negro y el blanco puros la aplanan. En tema oscuro
se es más agresivo bajando el brillo de los grises, porque el ojo cansa antes.

**El tema oscuro no es el claro invertido.** Se diseñó aparte: los bordes suben para que
se distingan (los colores oscuros necesitan más separación entre sí que los claros), los
colores semánticos se aclaran y desaturan para no vibrar, y el blanco puro se reserva para
lo más importante.

## Estados de los elementos

En móvil no hay _hover_: solo reposo, pulsado y deshabilitado.

| Estado        | Regla                                                                                             | Cómo                                    |
| ------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Pulsado       | Un poco **más oscuro** que el reposo, para que se sienta que se está presionando algo             | `accentPressed`, `surfacePressed`       |
| Deshabilitado | **Desaturado**, no transparente: la transparencia deja ver lo que hay detrás y rompe el contraste | Relleno `surfaceAlt`, texto `textMuted` |
| Cargando      | Igual que deshabilitado, con indicador                                                            | `<Button loading>`                      |

## Verificación

`src/ui/theme/palette.test.ts` audita en cada corrida, 90 comprobaciones:

- Todo texto sobre toda superficie alcanza **AA (4.5:1)** en ambos temas — incluido
  `peligro`.
- `borderStrong` alcanza **3:1**, el mínimo para componentes de interfaz; el acento como
  relleno también, contra el fondo.
- Ingreso y gasto se separan al menos **1.4:1** en luminancia, para que se distingan sin
  color.
- `onAccent`, `onGasto` y `onPeligro` alcanzan **AA** sobre su relleno; `onAccent` también
  sobre `accentPressed`, porque el texto no cambia mientras se pulsa.
- Gasto y peligro son colores distintos.
- El oscuro no usa blanco puro para el texto; el claro no usa negro puro.
- Ambos temas declaran las mismas claves, en hex de seis dígitos en mayúsculas.

Cambiar un color sin correr la auditoría no es posible: el commit se bloquea. Está
comprobado provocándolo: subir `textMuted` a `#9BA3B4` tira tres pares; igualar `peligro`
a `gasto` tira uno.

## Valores

Peor caso de contraste texto/fondo: **4.65** en claro (`textMuted` sobre `surfaceAlt`) y
**5.09** en oscuro. Los valores viven en `src/ui/theme/palette.ts`; este documento no los
repite para que no diverjan.
