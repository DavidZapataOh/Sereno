-- Segundo y último reinicio antes del lanzamiento: conectar el correo metió
-- un mes de historia.
--
-- La regla del sprint 04 —contar desde el día en que se conecta la cuenta— se
-- fijaba mirando cuándo se conectó la *fuente*. Conectar el correo es un
-- evento aparte y posterior: el buzón guarda semanas, y en la primera traída
-- entraron 78 movimientos de todo agosto. Eso descuadró los saldos que el
-- usuario ya había cuadrado a mano —el efectivo contado y el saldo inicial de
-- Bancolombia—, que era exactamente lo que la regla existía para evitar.
--
-- Desde ahora hay un corte propio del correo, fijado en la primera traída y
-- guardado: nada anterior a él entra nunca.
--
-- Lo guardado se produjo bajo la regla vieja y no se puede reparar fila a
-- fila: no hay forma de saber qué había en Efectivo el día del corte. El
-- ledger vuelve a empezar; las cuentas y las reglas de categorización se
-- conservan. Hay que volver a importar el saldo y a contar el efectivo.
--
-- El cursor de sincronización NO se borra a propósito: lo ya entregado no se
-- vuelve a pedir, y si se pidiera, el corte nuevo lo descartaría igual.
--
-- Esta migración es válida UNA vez, antes del lanzamiento. Después, un
-- reinicio así sería pérdida de datos del usuario y no se haría nunca por
-- migración.
DELETE FROM `postings`;
--> statement-breakpoint
DELETE FROM `transaction_observations`;
--> statement-breakpoint
DELETE FROM `transfers`;
--> statement-breakpoint
DELETE FROM `reconciliations`;
--> statement-breakpoint
DELETE FROM `ingest_runs`;
--> statement-breakpoint
DELETE FROM `transaction_classifications`;
--> statement-breakpoint
DELETE FROM `classification_batches`;
--> statement-breakpoint
DELETE FROM `transactions`;
--> statement-breakpoint
DELETE FROM `estado_sync` WHERE `clave` = 'inicioCorreo';
