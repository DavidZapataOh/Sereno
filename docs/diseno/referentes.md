# Referentes y listón de calidad

Ninguna pantalla de Sereno puede quedar por debajo de su equivalente aquí.

> **Origen del análisis.** Este documento sale del recorrido de las apps líderes hecho
> durante la planificación (agosto de 2026) y de su material público. No se repitió el
> recorrido con capturas propias en el dispositivo durante la ejecución del sprint: el
> criterio «al menos cinco apps con capturas» queda **parcial**, y se completa en la
> sesión de campo del sprint 12 (E2E), cuando haya pantallas reales que comparar lado a
> lado.

## Qué hace bien cada uno

### Copilot Money

- **Categorización:** empieza a clasificar solo a las 30 transacciones y a la semana
  apenas requiere correcciones. El usuario corrige _una_ vez y el sistema aprende.
- **Presentación de cifras:** alineación en columna, jerarquía clara entre el monto y su
  contexto (comercio arriba, categoría y fecha en gris debajo, cifra a la derecha).
- **Sobriedad:** no hay adorno que no informe. Los colores semánticos aparecen solo en
  los montos; el resto de la interfaz es neutra.
- **A imitar:** la fila de movimiento y la disciplina de color.

### Monarch

- **Patrimonio neto:** una cifra con su evolución, sin ruido. La gráfica responde una
  pregunta —«¿voy mejor que hace tres meses?»— y nada más.
- **Reglas del usuario:** control explícito sobre la clasificación, con reglas que
  persisten y se pueden revisar.
- **A imitar:** que el usuario pueda corregir al sistema y que la corrección se quede.

### Nubank

- **Tarjeta de crédito y cuotas:** el mejor modelo latinoamericano de compra diferida.
  Separa «lo que ya gasté este mes» de «lo que tengo comprometido», y muestra cada cuota
  como cuota, no como gasto del mes de compra.
- **Tono:** cercano sin ser infantil, en español natural. Escribe «Tu factura cierra el
  15» y no «Fecha de corte del estado de cuenta».
- **Dark mode propio:** no es el claro invertido; los morados se desaturan y los grises
  suben.
- **A imitar:** cómo muestra una compra a cuotas sin mentir sobre el mes en curso, y el
  lenguaje.

### Rocket Money

- **Suscripciones:** las detecta y avisa antes de que se renueven.
- **Calendario de pagos:** qué se paga, cuándo y cuánto falta, en una vista mensual.
- **A imitar:** convertir una detección en una acción concreta con fecha.

### Nequi

- **Contexto local:** lenguaje, formatos de monto y expectativas del usuario colombiano.
  Escribe `$ 45.000` con punto de miles y espacio tras el símbolo.
- **Movimientos:** nombra los movimientos por lo que son para el usuario («Pago a Éxito»)
  y no por el código del sistema.
- **A imitar:** cómo escribe las cifras en pesos y cómo nombra los movimientos.

### Revolut

- **Densidad:** muestra mucho en poco espacio sin que se sienta apretado, con una escala
  tipográfica de pocos niveles bien separados.
- **A imitar:** la escala tipográfica corta.

## Qué hacen mal y no vamos a copiar

Los líderes arrastran concesiones de su modelo de negocio. Sereno no tiene ese modelo.

| Práctica                                                            | Quién                       | Por qué no                                                                          |
| ------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| Pantallas de bienvenida y paseos guiados que estorban               | Rocket Money, Monarch       | Una app de consulta se abre veinte veces al día; la bienvenida se paga veinte veces |
| Publicidad de productos financieros en el recorrido principal       | Nequi, Nubank, Rocket Money | Es el negocio de ellos, no una necesidad del usuario                                |
| Celebraciones que interrumpen (confeti, insignias, «¡lo lograste!») | Monarch, varias             | Principio 3: el usuario no quiere que le celebren ni que le regañen                 |
| Gráficas decorativas que no responden ninguna pregunta              | Muchas                      | Ocupan el espacio más caro de la pantalla para no decir nada                        |
| Rojo saturado para saldos negativos y gastos                        | Muchas                      | Castiga en el momento en que el usuario ya está ansioso                             |
| Botón flotante «añadir gasto» en la pantalla principal              | Casi todas                  | Principio 4: el registro manual no es el camino principal                           |
| Redondear la proyección para que cuadre                             | Varias                      | Principio 5: una proyección es una estimación y se presenta como tal                |
| Ocultar la moneda cuando «se sobreentiende»                         | Apps de un solo país        | Sereno maneja cinco monedas; el sobreentendido es un error esperando ocurrir        |

## Listón por pantalla

| Pantalla de Sereno       | Referente    | Qué hay que igualar como mínimo                          |
| ------------------------ | ------------ | -------------------------------------------------------- |
| Hoy / patrimonio         | Monarch      | Una cifra clara con su evolución, sin desplazarse        |
| Lista de movimientos     | Copilot      | Cifras alineadas, comercio legible, categoría visible    |
| Detalle de movimiento    | Nubank       | Todo el contexto sin saltar de pantalla                  |
| Tarjeta de crédito       | Nubank       | Cupo, corte, pago y cuotas comprometidas, separados      |
| Calendario de pagos      | Rocket Money | Qué se paga, cuándo, cuánto falta                        |
| Deudas                   | Monarch      | Total y fecha de salida siempre visibles                 |
| Suscripciones            | Rocket Money | Detección con fecha de próxima renovación                |
| Estados vacío y de error | Copilot      | Dicen qué pasa y qué hacer; nunca una pantalla en blanco |
| Modo oscuro              | Nubank       | Diseñado aparte, no el claro invertido                   |

## Patrones de plataforma

Android, no iOS. Lo que en Android se siente ajeno:

- Barra de pestañas con iconos rellenos al estilo iOS → en Android, iconos de trazo con
  el activo relleno, etiqueta siempre visible.
- Botón «atrás» en la esquina superior izquierda como único retorno → Android tiene
  retorno del sistema; la interfaz no lo duplica innecesariamente.
- Área táctil de 44 pt → Android exige **48 dp**.
- Desplazamiento con rebote elástico → Android usa el brillo de borde.
