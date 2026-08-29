# 0003 — Frontera de captura por lista de exclusión

**Estado:** Aceptado
**Fecha:** 2026-08-29

## Contexto

La aplicación inyecta JavaScript en la sesión bancaria del usuario para leer respuestas de
la API interna del portal. Ese código ve todo el tráfico de la página, incluidas las
respuestas de autenticación que contienen tokens de sesión.

Hay que decidir qué se captura y qué no.

## Decisión

Lista de exclusión por patrones sobre la URL, más restricción a contenido JSON. La decisión
por defecto es **no capturar**.

La URL se decodifica hasta tres veces antes de evaluarla, para que un escape porcentual no
oculte un patrón.

**Los patrones cubren español además de inglés.** Los portales colombianos usan rutas como
`/autenticacion` o `/cambiar-contrasena`, que `auth` y `password` no capturan. Se detectó al
ejecutar las pruebas, no al escribir el plan.

Se verifica por tres vías: casos concretos, propiedades sobre entradas generadas con
`fast-check`, y una comprobación sobre los volcados reales en la validación de campo.

## Alternativas consideradas

**Lista de inclusión** — capturar solo rutas declaradas explícitamente. Es más segura en
teoría, pero inaplicable aquí: el objetivo del sprint es **descubrir** qué endpoints
existen. Una lista de inclusión exigiría conocer de antemano lo que venimos a averiguar.

**Filtrar por el contenido de la respuesta** en vez de por la URL. Se descartó porque obliga
a leer el cuerpo para decidir si se podía leer. El daño ya estaría hecho.

**No filtrar y depurar el volcado después.** Se descartó porque deja datos sensibles en
memoria y en el archivo exportado, aunque sea temporalmente.

## Consecuencias

**A favor:** permite descubrir endpoints desconocidos, que es el propósito del sprint. La
regla es simple, auditable en una lectura y verificada con propiedades.

**En contra:** una lista de exclusión puede dejar pasar algo que no anticipamos. Un banco
podría servir datos de sesión desde una ruta llamada `/api/perfil`. Se mitiga con la
verificación sobre volcados reales del plan 06, que **aborta el sprint** si aparece una sola
captura sensible.

**Falsos positivos aceptados:** un endpoint legítimo llamado `/api/autorizaciones` queda
excluido por contener `auth`. Se prefiere perder ese dato a arriesgar una credencial.
