-- Reinicio del ledger antes del lanzamiento.
--
-- Hasta aquí, la ingesta metía al ledger todo movimiento que el banco
-- devolviera, incluidos los de antes de conectar la cuenta. Un retiro de hace
-- dos semanas dejaba 40.000 en Efectivo que ya no existían. Desde la
-- migración anterior, Sereno cuenta desde el día en que se conecta la cuenta
-- y el saldo del banco es el punto de partida.
--
-- Lo que hay guardado se produjo bajo la regla vieja y no se puede reparar
-- fila a fila: no hay forma de saber qué había en Efectivo el día de inicio.
-- Como la app aún no se ha lanzado y la única instalación es la de desarrollo,
-- el ledger vuelve a empezar: la siguiente importación lo reconstruye bajo la
-- regla nueva en un toque. Las cuentas se conservan; solo se vacía lo que la
-- ingesta y la conciliación produjeron.
--
-- Esta migración es válida UNA vez, antes del lanzamiento. Después del
-- lanzamiento, un reinicio así sería pérdida de datos del usuario y no se
-- haría nunca por migración.
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
DELETE FROM `transactions`;
