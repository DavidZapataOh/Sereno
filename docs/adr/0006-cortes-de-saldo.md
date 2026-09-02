# 0006 — Cortes de saldo como caché derivado

**Estado:** Aceptado
**Fecha:** 2026-09-01

## Contexto

Desde el sprint 03, `balanceOf` calcula el saldo de una cuenta sumando **todos** sus
apuntes. Es lo que hace que la contabilidad no pueda desincronizarse: no hay un saldo
guardado que pueda contradecir al ledger, porque no hay saldo guardado.

El coste de eso apareció al medirlo en el sprint 12. La pantalla de inicio llama a
`balanceOf` **una vez por cuenta, en serie**: con las diecinueve cuentas de David y cinco
años de historial, abrirla lee 766 filas donde con un año lee 190. Es lineal en el
historial y no tiene techo —la app se vuelve más lenta cada mes y nunca vuelve a ser
rápida—, y el mismo patrón se repite en las métricas, los informes y el presupuesto, que
cortan el saldo una vez por categoría y por mes.

## Decisión

Se guarda, por cuenta y mes, cuánto valía la cuenta al cerrar ese mes: un **corte**.

`balanceOf(hasta)` pasa a ser «el corte más reciente cuya frontera no pase de `hasta`, más
los apuntes posteriores». El trabajo queda acotado a un mes de apuntes en vez de al
historial entero: con cinco años, abrir la pantalla de inicio pasó de **766 filas a 65**.

Tres reglas sostienen que esto no puede mentir:

1. **Un corte es un caché, nunca una fuente de verdad.** Se puede borrar la tabla entera y
   la app da exactamente las mismas cifras, solo leyendo más. Hay una prueba de eso.
2. **Los cortes se borran, no se ajustan.** Un movimiento que llega con fecha vieja —y la
   ingesta trae correo con retraso todos los días— borra los cortes de esa cuenta desde su
   mes en adelante, y se vuelven a calcular. Ajustar un corte es hacer aritmética sobre un
   caché, y basta una cuenta mal hecha para que el saldo quede mal para siempre sin fallar.
3. **La frontera del corte se compara como texto**, igual que el resto de las fechas del
   repositorio. Es lo que garantiza que el corte y los apuntes que se suman aparte partan
   exactamente el mismo conjunto: sin solaparse —un apunte contado dos veces— ni dejar
   hueco.

Los cortes se ponen al día al arrancar, en segundo plano y **hasta el mes anterior**: un
mes a medias no es un corte, es una foto que habría que reescribir cada día.

## Alternativas consideradas

**Sumar en SQL.** Habría sido menos código. Se descartó porque los montos se guardan como
texto —un entero de escala cripto no cabe en el entero de SQLite—, así que `SUM` obliga a
convertir a número y perder dígitos: exactamente lo que el ADR 0004 existe para impedir.

**Un saldo materializado por cuenta**, actualizado al insertar cada apunte. Es lo que hace
la mayoría de las apps. Se descartó porque crea una segunda fuente de verdad: un apunte
que entre por otro camino la deja mintiendo, y no hay forma de notarlo. Un corte, en
cambio, es reconstruible y comprobable —`npm run verificar-saldos` lo hace sobre la base
real del teléfono—.

## Consecuencias

- Hay una tabla que **no** es fuente de verdad, lo cual es una excepción a «nada se guarda
  que se pueda derivar». Es la primera del proyecto, y por eso está escrita aquí.
- Cualquier camino nuevo que escriba apuntes **tiene que invalidar cortes**. Hoy el único
  es el repositorio de transacciones, y lo hace dentro de la misma transacción de base de
  datos que la escritura.
- La primera vez que se arranca con historial, calcular los cortes cuesta un recorrido
  completo. Va en segundo plano, después de pintar: la primera pantalla no espera.
