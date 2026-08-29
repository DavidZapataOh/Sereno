# Dominio

Entidades, objetos de valor y reglas de negocio. TypeScript puro.

**No importa nada fuera de `domain/`.** Ni React, ni SQLite, ni Expo, ni fetch.

Si algo aquí necesita hablar con el mundo, declara una interfaz (un puerto) y deja que
`infrastructure/` la implemente.

Se prueba sin montar nada.
