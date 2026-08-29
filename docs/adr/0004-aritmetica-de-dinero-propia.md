# 0004 — Aritmética de dinero propia, sin Dinero.js

**Estado:** Aceptado
**Fecha:** 2026-08-29
**Reemplaza parcialmente:** la elección de Dinero.js en el documento de stack

## Contexto

El documento de stack eligió Dinero.js v2 para la aritmética monetaria. Al llegar la
implementación aparecieron dos problemas.

El primero es de arquitectura: el ADR 0001 establece que `domain` no importa nada externo.
La aritmética de dinero es el corazón del dominio, y meter una dependencia ahí obliga a
hacer una excepción a la regla en el primer plan donde se aplica.

El segundo es de alcance: esta aplicación maneja pesos colombianos junto a criptomonedas.
Un saldo en wei tiene dieciocho decimales y desborda el `number` de JavaScript. Dinero.js
v2 trabaja con `number`, así que habría que envolverlo igualmente para operar con `bigint`.

## Decisión

Se implementa `Money` en el dominio, sin dependencias: entero `bigint`, código de moneda y
la escala declarada por moneda en un catálogo aparte.

Las operaciones son las que el proyecto necesita: sumar, restar, negar, multiplicar por
fracción exacta, repartir, comparar y acumular. Nada más.

## Alternativas consideradas

**Dinero.js v2 envuelto en un adaptador de infraestructura.** Mantendría el dominio limpio,
pero obligaría a convertir en cada frontera y seguiría sin resolver `bigint`. Se pagaría la
indirección sin obtener lo que se necesita.

**Excepción al ADR 0001 para librerías puras.** Es defendible: una librería sin efectos
secundarios no compromete la testabilidad. Se descartó porque la excepción es difícil de
delimitar —¿qué cuenta como pura?— y porque en este caso la librería tampoco sirve.

**`number` en vez de `bigint`.** Alcanza para pesos y dólares, y desborda en ether. Se
descartó por no querer dos aritméticas distintas según la moneda.

## Consecuencias

**A favor:** el dominio no tiene dependencias. La aritmética soporta cualquier escala sin
casos especiales. `allocate` está verificado con propiedades sobre cientos de casos
generados: el reparto suma exactamente el original, siempre.

**En contra:** hay que mantener unas ciento cincuenta líneas propias, y `allocate` es un
algoritmo con esquinas. Se acepta porque está cubierto por propiedades y porque es el
núcleo del producto: no es código accesorio que convenga delegar.

**Riesgo asumido:** `bigint` no es serializable a JSON directamente. Los repositorios
convierten a texto al persistir, y esa conversión se prueba explícitamente.

**Riesgo pendiente de verificar:** el motor Hermes de React Native soporta `bigint`, pero
no se ha comprobado en el dispositivo. Debe verificarse antes de que el ledger llegue a la
interfaz.
