# 0005 — Una categoría es una cuenta del ledger

**Estado:** Aceptado
**Fecha:** 2026-08-30

## Contexto

El sprint 04 asienta todo lo ingerido contra `sistema:gastos-sin-clasificar` o
`sistema:ingresos-sin-clasificar`. El sprint 05 tiene que decir en qué se fue cada peso, y
hay dos maneras de guardarlo.

## Decisión

Una categoría **es** una cuenta de naturaleza `gasto` o `ingreso`, con id
`categoria:<slug>`. Clasificar un movimiento es reemplazar el apunte de contrapartida por
uno contra la cuenta de la categoría. La transacción sigue cuadrando por construcción.

Lo que una cuenta no tiene —grupo, icono, orden— vive en `categories`, una tabla cuya
clave primaria es la cuenta. El origen de cada clasificación (manual, regla, aprendida,
catálogo) y su confianza viven en `transaction_classifications`, una fila por
transacción.

## Alternativas consideradas

**Una columna `categoria` en `transactions`.** Es lo que hace casi toda app de finanzas
personales. Se descartó porque rompe la doble partida: el gasto seguiría asentado en
«sin clasificar» y «cuánto gasté en Mercado» sería una suma aparte, con su propia lógica
de fechas, signos y transferencias, que puede contradecir al ledger. Con la categoría
como cuenta, todas las preguntas sobre gasto las responde `balanceOf`.

**Categorías con jerarquía en la propia tabla de cuentas (`parentId`).** Añadiría a todas
las cuentas una jerarquía que solo usan las categorías. La tabla aparte mantiene `accounts`
genérica y hace explícito qué cuentas son categorías.

**Dividir un movimiento entre varias categorías (splits).** La doble partida lo permite
sin cambios (dos apuntes de contrapartida). No se implementa en este sprint: ninguna
fuente lo produce y el usuario no lo pidió. La estructura ya lo soporta.

## Consecuencias

**A favor:** un solo modelo para saldos y gastos; los informes por categoría no tienen
código propio; una transferencia entre cuentas propias es, por construcción, no
categorizable, que es lo correcto.

**En contra:** reclasificar reescribe una transacción (un apunte). Se acepta porque
`save` ya es reemplazo atómico por id, y porque el lote de revisión (plan 05) guarda el
«antes» para deshacer.

**Regla que impone:** las cuentas `categoria:*` no se muestran como «cuentas» en Hoy ni en
Cuentas; son cuentas de flujo, no de saldo (`isRealAccount` ya lo dice).
