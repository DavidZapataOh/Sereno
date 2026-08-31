# Sereno

App personal de administración de dinero. Un solo usuario, Colombia, Android.
Consolida seis fuentes —Bancolombia, Nequi, Nu, RappiCard, Binance y wallets cripto—
sin que el usuario registre nada a mano.

El nombre viene del vigilante nocturno colonial que recorría las calles cantando la hora
y avisando novedades: vigilancia constante, sin sobresaltos.

## Expo HA CAMBIADO

Lee la documentación exacta de la versión en https://docs.expo.dev/versions/v57.0.0/
**antes de escribir código**. No asumas APIs de versiones anteriores.

Stack: Expo SDK 57 · React 19.2 · React Native 0.86 · expo-router 57 · TypeScript.

## Comandos

```bash
npm start              # Metro
npx expo start --tunnel  # OBLIGATORIO en este entorno (ver abajo)
npm run lint
npx expo install <pkg> # SIEMPRE así, nunca npm install, para respetar las versiones del SDK
```

**El entorno de desarrollo es WSL2.** El NAT de WSL2 impide que el teléfono alcance a
Metro por IP local, así que `--tunnel` no es opcional. No hay Java ni Android SDK
instalados, y no hacen falta: la Fase 1 corre en **Expo Go**, sin development build.

## Estructura

```
control-gastos/
├── docs/superpowers/specs/   ← specs y roadmap, FUERA de este repo, no se publican
└── sereno/                   ← este repositorio
```

Los documentos de diseño **no están versionados aquí a propósito**. Antes de trabajar en
una fase, léelos en `../docs/superpowers/specs/`:

- `2026-08-28-roadmap-sereno.md` — decisiones que aplican a todas las fases
- `2026-08-28-spike-webview-captura-bancaria-design.md` — Fase 1

Nunca muevas `docs/` dentro de este repo ni inicialices git en la raíz.

## Dónde está el estado del trabajo

Cada sprint tiene un `progress.md` en `../docs/superpowers/plans/sprint-NN-*/` con lo que
se hizo, las métricas de calidad, los hallazgos y los bloqueos. **Léelo antes de retomar un
sprint**: dice qué quedó a medias y por qué.

El tablero global está en `../docs/superpowers/plans/README.md`.

## Capas

```
src/domain/          TypeScript puro. No importa NADA externo.
src/application/     Casos de uso. Importa domain.
src/infrastructure/  SQLite, HTTP, WebView. Implementa puertos de domain.
src/ui/              Componentes, pantallas y hooks.
src/app/             Rutas de expo-router.
src/test/            Utilidades de prueba.
```

Las dependencias van en un solo sentido y `eslint-plugin-boundaries` lo verifica. Un
import que cruce una capa en dirección prohibida falla el lint.

Las decisiones estructurales se registran en `docs/adr/`.

### El servidor

`servidor/` es un paquete npm aparte dentro de este repositorio (sprint 06). Tiene su
`package.json`, su `tsconfig.json` y sus pruebas con Vitest; la app lo excluye de Metro,
Jest, ESLint, Prettier y su `tsconfig`.

- **Ahí se instala con `npm install`**, no con `npx expo install`: la regla del SDK aplica
  al paquete de la app.
- **Importa el dominio de la app** por el alias `@/*` → `../src/*`. No se copia ningún
  tipo; `servidor/src/dominio-compartido.test.ts` lo vigila.
- **No lleva contabilidad**: guarda correos, movimientos normalizados y cursores. El ledger
  vive en el teléfono.
- `npm run verify` de la app corre también el del servidor, y CI tiene su propio trabajo.

## Flujo de trabajo

El trabajo va en ramas y se integra con **un solo comando**.

```bash
git checkout -b feat/lo-que-sea
# ... trabajo, commits ...
npm run integrar
```

`npm run integrar` verifica en local, sube la rama, **espera a que CI pase antes de tocar
`main`**, fusiona, vuelve a verificar el árbol fusionado, publica `main` y borra la rama en
local y en remoto. Si CI falla, o si la fusión rompe algo, `main` queda intacta.

Existe porque el flujo anterior pedía acordarse de dos push por sprint —el de la rama y el
de `main`— y el segundo no da ninguna señal cuando falta: `main` se quedó dos sprints atrás
sin que nadie lo notara.

`npm run verify` corre el mismo conjunto que CI, por separado.

### Un plan no se cierra porque `verify` pase

`verify` demuestra que el código **que existe** funciona. No dice nada del código que
falta. En el sprint 08 los cinco planes se marcaron ✅ con `verify` en verde y cuatro
tareas sin hacer: un sprint entero que el usuario no podía ver, y un `progress.md` que
afirmaba lo contrario. Lo detectó él, no la suite.

**Para cerrar un plan hay que releer su sección «Verificación del plan» y recorrerla
entera, criterio por criterio.** Los que empiezan por «En el teléfono» no tienen señal
automática y son justo los que importan: son los que dicen si el usuario ve algo.

`npm run comprobar-plan` lo vigila —y `npm run integrar` lo corre antes de subir nada—:
falla si un plan marcado ✅ declara archivos que no existen o deja criterios sin recorrer.
Un renombrado durante la ejecución también salta, y está bien: se corrige la ruta en el
plan. Lo que no vale es dejar el ✅ puesto.

Si algo queda a medias, se marca **⚠️ Parcial** diciendo qué falta y por qué. Un registro
que miente es peor que el código que falta, porque el código ausente se nota y el registro
no.

**`main` no está protegida en GitHub.** La disciplina la impone el guion, no el servidor.
Activar la protección de rama es pendiente conocido; con un solo desarrollador añade
fricción sin añadir garantías, porque nadie más puede empujar.

### Node: hay dos en esta máquina

`/usr/bin/node` es v18 y el de nvm es el que el proyecto exige. **Un shell no interactivo
—el que abre `wsl -- npm`, un cron, un hook de editor— no carga nvm y coge el v18.** Con
ese, el binario nativo de `better-sqlite3` no avisa: mata el proceso con `SIGSEGV`, y se
ve como ocho suites de pruebas muriendo con «A jest worker process was terminated» sin
mencionar a Node.

`npm test` y `npm run verify` lo comprueban antes de empezar y explican el arreglo;
`npm run integrar` además lo repara solo. Trabajar desde la terminal de Ubuntu evita el
problema entero.

Dos detalles que cuestan tiempo si no se saben:

- **`bash -lc` no carga nvm.** El `.bashrc` de Ubuntu se corta en su primera línea cuando
  el shell no es interactivo, y nvm vive ahí. Desde PowerShell hace falta `bash -ic`.
- **`nvm use` no sirve dentro de un script de npm.** npm exporta `npm_config_prefix` y nvm
  se niega a correr con esa variable puesta. Por eso `integrar.sh` localiza el binario a
  mano en vez de usar nvm.

## Estado

Sprints ejecutados: **00** fundaciones · **01** captura bancaria (Bancolombia sí, Nequi
no: va por correo) · **02** sistema de diseño y navegación · **03** ledger de doble
partida sobre SQLite · **04** ingesta, deduplicación, transferencias, conciliación y las
pantallas de Hoy, Movimientos y Cuentas · **05** categorización: comercios legibles,
categorías como cuentas, reglas, clasificador que aprende, y las pantallas Categorías,
Revisar y Reglas. El tablero vivo está en `../docs/superpowers/plans/README.md`.

«Hoy» ya muestra dinero de verdad: lo capturado de Bancolombia entra al ledger con
`Importar` desde la sesión del portal, y al importar se clasifica solo (regla > aprendido >
catálogo); lo que no, queda «por revisar» en Movimientos → Categorías → Revisar. Las
pestañas Deudas y Metas siguen vacías hasta sus sprints.

Reglas del sprint 04 que conviene conocer antes de tocar la ingesta:

- **La idempotencia se deriva:** el id de una transacción ingerida es `fuente:referencia`.
  No la implementes; no la rompas cambiando el id.
- **Nada se borra:** un duplicado es una observación más; una transferencia fundida deja
  instantáneas en `transfers`. Deshacer es reconstruir desde ahí.
- **Los casos de uso se prueban con los dobles de `src/test/fakes/`**, no contra SQLite.
- **Ventanas:** ±1 día para la misma compra vista por dos canales; ±5 para dinero que viaja
  entre bancos. No las unifiques.
- **Una categoría es una cuenta** de gasto o ingreso, `categoria:<slug>` (ADR 0005):
  clasificar es reasentar la contrapartida; «cuánto gasté en Mercado» es `balanceOf` entre
  dos fechas. La taxonomía vive en `domain/categorization/taxonomy.ts`.
- **El clasificador solo aprende de lo manual** (`origen: 'manual'`), nunca de sus propias
  conjeturas. **Prioridad fija:** regla del usuario > aprendido > catálogo de marcas > sin
  clasificar. Umbrales explícitos en `naive-bayes.ts`; no bajarlos para «que clasifique más».
- **La descripción cruda nunca se toca:** el comercio legible se deriva al mostrar
  (`merchantOf`). Si el catálogo mejora, mejora todo el historial.
- **Nunca edites un `.sql` de `drizzle/` que ya se haya compilado, y nunca escribas a mano
  el `when` del journal.** Las dos cosas fallan en silencio y solo en el dispositivo:
  - `babel.config.js` usa `inline-import`, que **pega el contenido del `.sql` dentro del
    JavaScript** y cachea por el archivo JS. Si cambias el `.sql` sin tocar
    `drizzle/migrations.js`, Metro sigue sirviendo el SQL viejo: el teléfono ejecuta una
    sentencia que ya no existe en disco. Se arregla con `npx expo start --clear`. Si hay
    que corregir una migración ya generada, **añade otra**; y si la editas igualmente,
    limpia la caché.
  - `migrate` solo aplica las migraciones con marca de tiempo **mayor** que la última
    aplicada, y lee esa última **una sola vez antes del bucle**. En una base vacía se
    aplican todas sin mirar marcas —por eso las pruebas no lo ven—; en una base con
    historia, una marca fuera de orden **descarta esa migración para siempre**, sin error.
  - El arranque registra `migraciones {...}` con lo aplicado, lo pendiente y lo descartado
    (`infrastructure/db/migration-state.ts`). Es lo primero que hay que mirar ante un «no
    such table» o un `ALTER` que se repite.
- **Sereno cuenta desde el día en que se conecta la cuenta.** El saldo del banco es el punto
  de partida (se asienta como «Saldo inicial» en la primera conciliación) y los movimientos
  anteriores a ese día no entran al ledger: se cuentan como `anteriores`. El día de inicio
  es el de la primera corrida de la fuente (`domain/ingest/account-start.ts`). Lo pidió el
  usuario: la historia de una cuenta de años no sirve aquí y sí hace daño.
- **Conectar el correo tiene su propio corte, y manda el más tarde de los dos**
  (`domain/sync/mail-start.ts`). Un buzón guarda semanas: la primera traída del servidor
  metió 78 movimientos de todo agosto y descuadró unos saldos que el usuario ya había
  cuadrado a mano. El corte se fija en la primera traída, se guarda en `estado_sync` y no
  se recalcula. **No lo derives de la fecha del correo ni de la corrida de la fuente.**

## Diseño

Las decisiones visuales se arbitran con `docs/diseno/principios.md`. Antes de proponer un
cambio de interfaz, léelo: cada principio descarta explícitamente algo que suena
razonable. El resto de `docs/diseno/` explica para quién es la app, cuál es el listón por
pantalla y cómo se usan color y tipografía.

Reglas que las pruebas hacen cumplir:

- **Ningún color escrito a mano.** `no-literals.test.ts` recorre `src/` y falla ante un
  hex, un `rgb()` o un nombre de color fuera de `ui/theme/palette.ts`. Todo sale de
  `useTheme()`.
- **Las pantallas no usan `Text`:** usan `AppText` (texto) y `Money` (dinero). `Money` es
  el único sitio donde se pinta un monto: formato, signo, moneda, cifras tabulares y
  etiqueta accesible viven ahí.
- **Todo interactivo mide 48 dp** y declara rol y etiqueta. `Button`, `ListRow`, `NavRow`
  e `IconButton` ya lo hacen.
- **Ninguna pantalla a más de tres toques.** El mapa vive en
  `domain/navigation/screen-map.ts`; añadir una pantalla es añadirla ahí primero.
- **La paleta pasa AA en todos los pares** y ambos temas declaran las mismas claves.
  Cambiar un color sin correr `palette.test.ts` no es posible.

## Registros y errores

Nunca uses `console` directamente: `no-console` está en error. Usa la capa de
observabilidad, que redacta datos sensibles antes de emitir.

```ts
import { observability } from '@/infrastructure/observability';

observability.log('info', 'sincronización completada', { fuente: 'nequi' });
observability.captureError(error, { operacion: 'conciliar' });
```

Montos, saldos, números de cuenta, correos y credenciales se redactan automáticamente. Aun
así, no los pases: lo que no se envía no se puede filtrar.

La interfaz no importa la infraestructura. Un componente que necesite reportar recibe la
función inyectada desde la capa de composición (`src/app/`).

## Seguridad — no negociable

La app inyecta JavaScript en la sesión bancaria del usuario. La disciplina de qué lee es
lo único que la hace segura.

1. **Nunca se almacenan credenciales bancarias.** El usuario inicia sesión él mismo.
2. **Solo se leen response bodies.** Jamás request bodies: ahí van las credenciales.
3. **Rutas de `login`, `auth` y `token` se excluyen** de la captura, para no registrar
   tokens de sesión.
4. **No se toca el DOM de autenticación** ni los campos del formulario.
5. **No se automatiza el login.** Rompe con el teclado virtual y la clave dinámica de
   Bancolombia, y dispara los bloqueos antifraude.
6. **Los volcados de captura son datos bancarios reales.** Están en `.gitignore`
   (`capturas/`, `*.capture.json`). Nunca los commitees ni los envíes a ningún servicio.

## Decisiones ya tomadas

No re-litigar sin motivo nuevo. El porqué está en el roadmap.

- **Sin agregadores comerciales.** Belvo cuesta USD $1.000/mes; Prometeo cubre cuentas
  empresariales; el open banking regulado no opera hasta ~2027.
- **Sin zkTLS.** Sirve para probarle algo a un tercero. Aquí el usuario es el único
  consumidor de sus datos.
- **Doble partida contable** desde el modelo de datos. Es lo que hace que transferencias
  entre cuentas propias, efectivo y compras a cuotas cuadren sin parches.
- **El monto original nunca se destruye.** Se guarda moneda nativa, tasa y momento,
  además del equivalente en pesos.
- **Nu y RappiCard no tienen portal web**, así que se resuelven por correo en la Fase 3.

## Convenciones

- **Identificadores en inglés** (`createAccount`, `buildInjectedScript`). **Comentarios,
  mensajes de error, textos de interfaz y documentación en español.** Los comentarios
  explican por qué, y quien los lee piensa en español; el idioma que ayuda gana al que
  queda uniforme. Los identificadores van en inglés porque conviven con los de las
  librerías.
- Montos como enteros en la unidad mínima, nunca `float`. El peso colombiano no usa
  decimales en la práctica, pero cripto y USD sí: usa enteros escalados.
- Fechas en ISO 8601 con zona horaria explícita.
- Archivos enfocados. Si uno crece demasiado, suele estar haciendo de más.

## Contexto del usuario

Rechaza explícitamente las soluciones que exijan trabajo manual —registrar gastos a mano,
descargar e importar extractos— porque el problema que quiere resolver _es_ su falta de
constancia. Prefiere la vía técnicamente más difícil si es la más automatizada.
No propongas la alternativa manual como si fuera un buen plan B.
