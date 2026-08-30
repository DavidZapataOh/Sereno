# Principios de diseño

Cinco reglas. Cada una descarta algo que alguien podría defender. Si nadie defendería lo
contrario, no es un principio: es un adorno.

## 1. La cifra manda

Cuando la legibilidad de un monto compita con la estética, gana el monto. Cifras
tabulares, contraste alto, tamaño suficiente, moneda explícita. Un balance mal alineado
destruye la confianza más rápido que cualquier acierto visual la construye.

**Descarta:** tipografías de display para cifras, montos en gris claro, animar un número
mientras se lee, mostrar un monto sin su moneda.

## 2. Nunca solo color

Ingreso, gasto y deuda se distinguen por signo, posición y etiqueta antes que por color.
El color refuerza; no informa solo.

**Descarta:** la fila verde y la fila roja como único distintivo. Cerca del 8 % de los
hombres no las diferencia.

## 3. Calma, no alarma

Consultar el dinero cuando uno sabe que va mal ya produce ansiedad. La interfaz informa
sin dramatizar: sin rojos saturados, sin signos de admiración, sin cuentas regresivas.

**Descarta:** teñir de rojo un saldo negativo, notificaciones alarmistas, celebrar el
ahorro con confeti. También descarta lo contrario: minimizar un problema real para no
incomodar.

## 4. Cero trabajo manual en el camino principal

El recorrido central no incluye ninguna pantalla de captura manual. Registrar a mano
existe como corrección, nunca como flujo esperado.

**Descarta:** el botón flotante de «añadir gasto» en la pantalla principal, y cualquier
pantalla que quede vacía hasta que el usuario escriba algo.

## 5. Decir la verdad, aunque incomode

Si un dato es estimado, se dice. Si el saldo no cuadra, se muestra la diferencia en vez de
ocultarla. Si falta información, se declara en vez de rellenar con cero. Si una fuente no
se sincronizó, la cifra que depende de ella lo indica.

**Descarta:** redondear para que cuadre, esconder una discrepancia, presentar una
proyección como si fuera un hecho, mostrar «$ 0» donde lo cierto es «no se sabe».

---

## Cómo se usan

Cuando dos opciones de interfaz son razonables, se elige la que ningún principio
descarte. Si ambas pasan, gana la que haga más por el principio de menor número: la cifra
antes que el color, el color antes que la calma, y así.

Cada principio tiene una prueba automática que lo vigila cuando es posible:

| Principio               | Vigilado por                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| 1 · La cifra manda      | `typography.test.ts` — los montos son mayores que el cuerpo; nada baja de 12                         |
| 2 · Nunca solo color    | `money.test.tsx` — todo monto lleva signo; `palette.test.ts` — ingreso y gasto se distinguen en gris |
| 3 · Calma, no alarma    | `palette.test.ts` — el gasto no es un rojo puro; `tokens.test.ts` — nada anima más de 400 ms         |
| 4 · Cero trabajo manual | `screen-map.test.ts` — ninguna pantalla del camino principal es de captura                           |
| 5 · Decir la verdad     | Revisión de diseño; no hay prueba que sustituya el criterio                                          |
