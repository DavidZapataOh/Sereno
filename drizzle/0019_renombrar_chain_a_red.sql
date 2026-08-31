-- Una wallet se define por su **red**, no por una cadena.
--
-- Una dirección EVM es válida en las catorce cadenas EVM, así que atarla a una
-- sola dejaba invisible lo que hubiera en las otras trece —sin ningún aviso: un
-- saldo que nadie mira no se distingue de un saldo en cero—.
--
-- Va aparte y no editando la 0018 porque esa ya se compiló: `inline-import`
-- pega el SQL dentro del JavaScript y cachea por el archivo JS, así que
-- cambiarla dejaría al teléfono ejecutando una sentencia que ya no existe.
ALTER TABLE `wallets` RENAME COLUMN `chain` TO `red`;
--> statement-breakpoint

-- Lo guardado antes de este cambio tenía una cadena donde ahora va una red.
-- 'solana' ya vale; todo lo demás era una cadena EVM.
UPDATE `wallets` SET `red` = 'evm' WHERE `red` <> 'solana';
