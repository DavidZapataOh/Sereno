# Arquitectura de información

## Cuatro pestañas, cuatro preguntas

| Pestaña         | Pregunta que responde                        |
| --------------- | -------------------------------------------- |
| **Hoy**         | ¿Cuánto tengo en total y qué se paga pronto? |
| **Movimientos** | ¿En qué se me está yendo el dinero?          |
| **Deudas**      | ¿Cuánto debo y cuándo salgo?                 |
| **Metas**       | ¿Cuánto debo ganar y ahorrar para llegar?    |

Son las cuatro preguntas que el usuario declaró en `publico-objetivo.md`. Si una pantalla
no ayuda a responder ninguna de ellas, no entra.

Iconos de trazo con el activo relleno y etiqueta siempre visible: es el patrón de Android.
Los iconos no llevan color propio; lo pone el estado.

## Por qué no hay pestaña de ajustes

Se visitan una vez al mes. Un cuarto de la barra de navegación es el espacio más caro de
la interfaz, y gastarlo en algo que se usa doce veces al año es desperdiciarlo. Los
ajustes cuelgan de «Hoy», desde el icono de la cabecera, y quedan a dos toques.

## Por qué no hay botón de añadir gasto

Principio 4: cero trabajo manual en el camino principal. El botón flotante de «añadir
gasto» es el patrón dominante en las apps de finanzas, y es exactamente lo que esta app
existe para evitar. El registro manual existe como corrección, dentro del detalle de un
movimiento.

## Regla de profundidad

Ninguna pantalla queda a más de **tres toques** del arranque. Se verifica en
`screen-map.test.ts`: añadir una pantalla más profunda rompe la prueba.

Esta regla tuvo una consecuencia concreta al ejecutar el sprint: el plan ponía las
conexiones bancarias en `Ajustes → Conexiones → Portal`, que son **cuatro** toques. La
solución no fue relajar la regla sino quitar la pantalla intermedia: con dos portales, una
lista aparte es un toque que no aporta nada. Las conexiones viven dentro del propio hub de
ajustes.

## Dónde vive la captura bancaria

Las pantallas del sprint 01 —sesión del portal y bandeja de capturas— cuelgan de
`Ajustes`. No son parte del recorrido diario: se usan al conectar una cuenta y luego casi
nunca. En el sprint 01 estaban en la raíz porque eran lo único que existía; dejarlas ahí
convertiría una herramienta de configuración en el centro de la app.

## Diagnóstico

`Ajustes → Diagnóstico` corre las invariantes del ledger sobre la base real del teléfono y
muestra una columna de montos para comprobar a ojo que las cifras tabulares funcionan con
la fuente cargada. Son las dos cosas que ninguna prueba automática puede ver, y las dos
quedaron pendientes de los sprints 02 y 03.

## Arranque

Antes de la primera pantalla, la app espera dos cosas: que las fuentes estén cargadas y
que la base de datos esté abierta con las migraciones aplicadas. Mientras tanto se ve la
pantalla de inicio; si la base falla, se dice, en vez de dejar el logo para siempre.

## Mapa completo

El mapa vive en `src/domain/navigation/screen-map.ts` como dato, no como diagrama. Cada
pantalla declara la pregunta que responde y el sprint en el que aparece. Es la única
versión: si el mapa y el código divergen, las pruebas fallan.
