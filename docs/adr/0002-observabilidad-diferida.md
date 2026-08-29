# 0002 — Observabilidad tras un puerto, con Sentry diferido

**Estado:** Aceptado
**Fecha:** 2026-08-29

## Contexto

Se necesita saber cuándo falla la app. Sentry es el estándar para React Native, pero en
Expo Go solo captura errores de JavaScript: los crashes nativos, el seguimiento de cuadros
y la repetición de sesión exigen un development build. El sprint 01 corre en Expo Go a
propósito, para no gastar tiempo en toolchain antes de responder si la captura bancaria es
viable.

Además, esta app maneja saldos, movimientos y credenciales de acceso bancario. Un servicio
externo de monitoreo es exactamente el lugar donde esos datos no deben aparecer.

## Decisión

La observabilidad se declara como puerto en `domain` y se consume siempre a través de él.
Ningún módulo importa Sentry.

Entre el código y cualquier destino se interpone `redact`, que elimina montos, saldos,
números de cuenta, correos, teléfonos, documentos y credenciales — por nombre de clave y
por forma del valor.

El adaptador activo hoy escribe a consola con la misma redacción. Sentry se activa en el
sprint 13, cuando exista development build, cambiando una línea en
`infrastructure/observability/index.ts`.

La interfaz no importa el adaptador: lo recibe inyectado desde la capa de composición. El
`ErrorBoundary` acepta un `onError` y es el layout raíz quien lo cablea con la instancia
real. Así se respetan las fronteras del ADR 0001 y el componente se prueba sin dobles.

## Alternativas consideradas

**Integrar Sentry ahora en modo solo-JavaScript.** Se descartó porque añade una dependencia
y una cuenta externa para obtener menos de lo que da la consola durante el desarrollo, y
crea la tentación de reportar antes de que la redacción esté probada.

**Usar `console` directamente y decidir después.** Se descartó porque los llamados a consola
se dispersan por todo el código y luego reemplazarlos es un cambio transversal. Peor: sin
una capa que redacte, cada llamado es una posible fuga.

**Que el `ErrorBoundary` importe la instancia directamente.** Es lo más corto de escribir,
pero rompe la frontera entre interfaz e infraestructura y obliga a montar dobles para
probarlo.

## Consecuencias

**A favor:** cambiar de proveedor de monitoreo no toca código de negocio. La redacción se
aplica en un solo punto y está probada con 33 casos, incluidos ciclos y profundidad
excesiva. La regla `no-console` en error garantiza que nadie se salte la capa.

**En contra:** durante los sprints 01 a 12 no hay reporte remoto de errores; los fallos se
ven solo en el dispositivo o en la consola de Metro. Es aceptable porque en esos sprints la
única usuaria es la persona que desarrolla.

## Activación

En el sprint 13:

1. `npx expo install @sentry/react-native`
2. Añadir el plugin `@sentry/react-native/expo` a `app.json`
3. Crear `sentry-logger.ts` implementando `Observability`, aplicando `redact` antes de cada
   envío y usando `beforeSend` como segunda barrera
4. Cambiar la instancia en `infrastructure/observability/index.ts`
5. Verificar con un error de prueba que el evento llega **sin** datos financieros
