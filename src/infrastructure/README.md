# Infraestructura

Adaptadores hacia el mundo exterior: SQLite, HTTP, WebView, almacenamiento seguro,
monitoreo.

Implementa los puertos que declara `domain/`. Es la única capa que conoce librerías
externas de acceso a datos.

Reemplazar SQLite por otra base debe tocar solo esta carpeta.
