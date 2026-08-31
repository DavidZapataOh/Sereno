# Levantar el servidor de Sereno desde cero (Railway)

Tiempo: unos veinte minutos.

## 1. La base de datos

En el proyecto de Railway: **New → Database → Add PostgreSQL**. No hay que crear
tablas: el servidor las crea al arrancar.

En el servicio del servidor, `DATABASE_URL` se pone como **referencia** a la base,
no copiada a mano:

    DATABASE_URL=${{Postgres.DATABASE_URL}}

Así, si Railway rota la contraseña de la base, el servidor se entera solo.

## 2. Los secretos

    openssl rand -base64 32   # SERENO_TOKEN
    openssl rand -base64 32   # SERENO_CLAVE_CIFRADO

**Guarda la clave de cifrado donde no se pierda.** Con ella se abren los correos
guardados; sin ella, lo guardado no se puede volver a leer. Los movimientos ya
extraídos no dependen de ella.

En Google: activar la verificación en dos pasos y crear una **contraseña de
aplicación** para IMAP. Va en `IMAP_CLAVE`, sin espacios.

## 3. Las variables

Copiar `servidor/.env.example` y rellenar en las Variables del servicio.
Ninguna va al repositorio; `npm run comprobar-secretos` lo vigila.

## 4. Desplegar

**New → GitHub Repo**, y elegir este repositorio. `railway.json` va en la **raíz
del repositorio**, que es el único sitio donde Railway lo busca; desde ahí manda
construir con `servidor/Dockerfile` y con la raíz como contexto, que es lo que
hace falta para que el dominio compartido entre.

El contexto es la raíz entera, así que `.dockerignore` —también en la raíz— es
lo que deja fuera `capturas/` y `servidor/.env`. Sin él, los correos reales y la
contraseña de aplicación se suben al constructor. Hay una prueba que lo vigila:
`scripts/despliegue.test.ts`.

**El primer despliegue va a fallar en rojo** si aún no se han puesto las
variables. Es lo correcto: el servidor se niega a arrancar sin sus secretos en
vez de arrancar a medias. Poner las variables y volver a desplegar.

En **Settings → Networking**, generar el dominio público.

Para probar la imagen antes de subir nada:

    docker build -f servidor/Dockerfile -t sereno-servidor .
    docker run --rm -p 8080:8080 --env-file servidor/.env sereno-servidor

## 4b. La primera pasada

La primera lectura no se trae el buzón entero: busca **solo los remitentes de los
bancos** —el filtro lo hace el servidor de correo, no nosotros— y **solo los
últimos 30 días** (`IMAP_DIAS_INICIALES`). Las siguientes van por UID, desde
donde se quedó.

Esto importa: pedir el buzón y descartar después obliga a descargar años de
correo personal, y en un buzón de verdad esa pasada no termina. Pasó en el
primer despliegue (sprint 06, hallazgo 15).

## 5. Comprobar

    curl -H "Authorization: Bearer $SERENO_TOKEN" https://<host>/salud

Debe responder `{"estado":"vivo",...}`. **Sin la cabecera debe responder 401**:
si responde otra cosa, parar, porque el servidor está abierto.

## 6. Conectar la app

En `sereno/.env.local`:

    EXPO_PUBLIC_SERENO_URL=https://<host>
    EXPO_PUBLIC_SERENO_TOKEN=<el mismo token>

Recargar Expo. En Ajustes → Servidor debe aparecer la última traída.

## Cuidado con dormir el servicio

Railway puede dormir un servicio sin tráfico. **Este no puede dormirse**: si
duerme, deja de leer el correo. En el plan del servicio, dejar el
_serverless / sleep_ desactivado. Se nota enseguida: `/salud` dirá que la última
corrida fue hace horas, y la app lo dirá en Ajustes.

## Rotar una credencial

Cambiar la variable en las Variables del servicio y reiniciar. **No se toca ni se
vuelve a desplegar código**: la configuración se lee al arrancar.

- **`DATABASE_URL`:** si es la referencia `${{Postgres.DATABASE_URL}}`, no hay
  nada que rotar; Railway la mantiene al día.
- **`SERENO_TOKEN`:** cambiarlo también en `.env.local` de la app y recargar.
- **`IMAP_CLAVE`:** revocar la contraseña de aplicación vieja en Google y crear
  otra. La ingesta se reanuda sola en la siguiente pasada.
- **`SERENO_CLAVE_CIFRADO`:** rotarla deja **ilegibles los correos ya guardados**.
  Los movimientos extraídos no se pierden. Si hace falta rotarla, primero
  resolver lo que quede en revisión, porque después no se podrá leer.

## Si la ingesta se detiene

`/salud` dice cuándo fue la última corrida y con qué error, y la app lo muestra
en Ajustes. Lo más probable, por orden: contraseña de aplicación revocada, base
de datos dormida por inactividad, o un cambio de formato de un banco —que no
detiene nada: deja correos en revisión—.
