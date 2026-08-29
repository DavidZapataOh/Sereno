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

## Flujo de trabajo

`main` está protegida: el pipeline debe pasar antes de fusionar. El trabajo va en ramas.

```bash
git checkout -b feat/lo-que-sea
npm run verify        # mismo conjunto que corre CI
git push -u origin feat/lo-que-sea
```

## Estado

**Fase 1 de 6:** spike de captura vía WebView contra Bancolombia y Nequi. Es un
experimento para decidir si la ingesta bancaria se construye sobre esta base o pivota a
correo y notificaciones push. No es producto: no hay backend, base de datos ni
categorización todavía.

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

- Código, identificadores y comentarios en **inglés**. Textos de interfaz y documentación
  en **español**.
- Montos como enteros en la unidad mínima, nunca `float`. El peso colombiano no usa
  decimales en la práctica, pero cripto y USD sí: usa enteros escalados.
- Fechas en ISO 8601 con zona horaria explícita.
- Archivos enfocados. Si uno crece demasiado, suele estar haciendo de más.

## Contexto del usuario

Rechaza explícitamente las soluciones que exijan trabajo manual —registrar gastos a mano,
descargar e importar extractos— porque el problema que quiere resolver _es_ su falta de
constancia. Prefiere la vía técnicamente más difícil si es la más automatizada.
No propongas la alternativa manual como si fuera un buen plan B.
