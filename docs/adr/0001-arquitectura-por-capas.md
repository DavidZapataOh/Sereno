# 0001 — Arquitectura por capas con dominio aislado

**Estado:** Aceptado
**Fecha:** 2026-08-29

## Contexto

Sereno es una aplicación de contabilidad personal: un ledger de doble partida con ingesta
desde fuentes heterogéneas —portales bancarios, correo, APIs de exchange, cadenas de
bloques— y una interfaz móvil. Las fuentes de datos van a cambiar: los bancos modifican sus
formatos, y el open banking regulado llegará hacia 2027 y podría reemplazar la captura por
WebView.

Lo que no puede cambiar es la contabilidad. Un asiento debe cuadrar hoy y dentro de cinco
años, sin importar de dónde vino el dato.

## Decisión

Cuatro capas con dependencias en un solo sentido: `domain` ← `application` ←
`infrastructure` / `ui` ← `app`.

El dominio es TypeScript puro y no importa nada externo. Declara puertos como interfaces;
la infraestructura los implementa.

Las reglas se verifican con `eslint-plugin-boundaries` y su violación es un error de lint
que bloquea el commit y el pipeline.

## Alternativas consideradas

**Estructura por funcionalidad** (una carpeta por pantalla, con todo dentro). Más cómoda al
principio y muy común en React Native. Se descartó porque diluye las reglas contables entre
componentes: cuando la lógica de cuadre vive junto a un `View`, probarla exige renderizar, y
reemplazar la base de datos obliga a tocar toda la app.

**Sin capas, con disciplina.** Se descartó porque la disciplina no verificada se erosiona.
Un import cómodo bajo presión se vuelve permanente, y nadie lo nota en revisión.

## Consecuencias

**A favor:** el motor contable se prueba sin base de datos ni renderizado, lo que mantiene
la suite rápida. Cambiar de SQLite a otra cosa toca una sola carpeta. La captura bancaria
puede reemplazarse por open banking sin tocar el ledger.

**En contra:** más indirección. Un caso de uso simple atraviesa más archivos que en una
estructura plana, y hay que declarar un puerto para cosas que en otro proyecto serían una
llamada directa. Es un costo real y se acepta a cambio de que el núcleo contable no se
contamine.
