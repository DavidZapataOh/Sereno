-- El canal por el que llegó cada observación.
--
-- Hasta aquí, la identidad de una transacción dentro de una fuente era su
-- referencia, y la deduplicación se negaba a fundir dos observaciones de la
-- misma fuente. Eso valía cuando cada fuente llegaba por un solo canal.
--
-- Desde el sprint 06 no vale: Bancolombia entra por el portal **y** por el
-- correo, y el correo no trae el número de autorización del portal. La misma
-- compra llegaba con dos referencias distintas, no se fundía, y **el mismo
-- gasto se contaba dos veces**. Además, `observationId` era
-- `transaccion@fuente`: las dos observaciones colisionaban y la segunda pisaba
-- a la primera con `onConflictDoUpdate`, así que ni siquiera quedaba rastro.
--
-- Ahora la identidad es fuente **y** canal.
--
-- Para lo que ya existe, el canal se deduce de la referencia y no se adivina:
-- las observaciones que vinieron del correo llevan una referencia que empieza
-- por `correo:` (ver `referenciaDe` en domain/mail/parsers/parser.ts). Todo lo
-- demás vino del portal, que era el único otro canal que había.
ALTER TABLE `transaction_observations` ADD `canal` text DEFAULT 'web' NOT NULL;
--> statement-breakpoint
UPDATE `transaction_observations` SET `canal` = 'correo' WHERE `referencia` LIKE 'correo:%';
--> statement-breakpoint
-- El id lleva el canal, y las filas viejas tienen el formato anterior
-- (`transaccion@fuente`). Se reescriben al formato nuevo para que una
-- observación futura del otro canal no choque con ellas.
UPDATE `transaction_observations` SET `id` = `id` || ':' || `canal` WHERE `id` NOT LIKE '%:web' AND `id` NOT LIKE '%:correo' AND `id` NOT LIKE '%:notificacion';
