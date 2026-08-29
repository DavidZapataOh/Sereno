# Público objetivo

## Quién

Una persona en Colombia, con ingresos variables, que se define a sí misma como mala
administrando su dinero. No le falta capacidad técnica: le falta constancia. Ya intentó
llevar cuentas y lo abandonó, porque toda herramienta que probó exigía trabajo manual
sostenido.

Maneja seis fuentes de dinero simultáneas —una cuenta de ahorros en Bancolombia, Nequi,
dos tarjetas de crédito (RappiCard y Nu), Binance y varias wallets cripto— repartidas en
aplicaciones que no se hablan entre sí. Ninguna le dice cuánto tiene en total ni cuánto
debe.

## Qué necesita resolver

Ordenados por urgencia declarada:

1. **Saber cuánto tiene, en total, sin abrir seis apps.**
2. **Saber cuánto debe y cuándo se paga**, incluidas las cuotas ya comprometidas.
3. **Saber cuánto tiene que generar este mes** para sostenerse.
4. **Saber si va a alcanzar una meta** y cuánto debe apartar para lograrlo.
5. **Enterarse de en qué se le está yendo el dinero** sin tener que registrarlo.

## Qué NO necesita

- Registrar gastos a mano. Es el problema, no la solución.
- Consejos genéricos de ahorro.
- Gamificación, insignias ni celebraciones.
- Comparaciones con otras personas.
- Publicidad de productos financieros.

## Contexto de uso

- **Android**, teléfono, casi siempre de pie o en movimiento. Una mano.
- **Sesiones cortas y frecuentes** para consultar —«¿cuánto tengo?», treinta segundos—
  y **sesiones largas ocasionales** para revisar y corregir, sentado.
- **Conectividad irregular:** la app tiene que servir sin datos. Todo lo ya sincronizado
  se lee sin conexión.
- **Momento emocional:** consultar el dinero cuando uno sabe que va mal produce ansiedad.
  La interfaz no puede añadir alarma a un momento que ya la tiene. Esto no es una
  preferencia estética: si abrir la app castiga, la app se deja de abrir, y el problema
  que existe para resolver vuelve.
- **Cifras grandes:** en pesos colombianos un mercado son seis dígitos y un sueldo, siete.
  La legibilidad de un número de siete cifras manda sobre cualquier otra consideración.

## Implicaciones de diseño

| Necesidad                          | Consecuencia                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Saber el total sin abrir seis apps | El patrimonio consolidado es lo primero que se ve, sin desplazarse                         |
| Sesiones cortas, de pie            | La información clave cabe en la primera pantalla; los toques son grandes                   |
| Ansiedad al consultar              | Tono sobrio; nada de rojo agresivo, signos de admiración ni cuentas regresivas             |
| Sin constancia para registrar      | Cero pantallas de entrada manual en el camino principal                                    |
| Conectividad irregular             | Lo sincronizado se lee sin conexión; el estado «sin datos» se declara, no se disfraza      |
| Cifras de siete dígitos            | Cifras tabulares, separador de miles, tamaño generoso; los montos mandan sobre la estética |
| Seis fuentes en cinco monedas      | Cada monto declara su moneda; nunca se mezclan sin decirlo                                 |

## Lo que se sabe del usuario y no se puede asumir de otros

La arquitectura es multiusuario desde el esquema de datos, así que las decisiones de
diseño se apoyan en lo que este perfil comparte con cualquier persona en su situación
—ansiedad, falta de constancia, muchas fuentes— y no en gustos individuales. Cuando una
decisión dependa de un gusto, se anota como tal y queda configurable.
