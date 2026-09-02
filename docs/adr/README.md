# Registro de decisiones de arquitectura

Un ADR por decisión estructural. Se numeran secuencialmente y **no se editan** una vez
aceptados: si una decisión cambia, se escribe un ADR nuevo que reemplaza al anterior y se
marca el viejo como sustituido.

## Los que hay

| #                                           | Decisión                               |
| ------------------------------------------- | -------------------------------------- |
| [0001](0001-arquitectura-por-capas.md)      | Arquitectura por capas                 |
| [0002](0002-observabilidad-diferida.md)     | Observabilidad diferida                |
| [0003](0003-frontera-de-captura.md)         | Frontera de captura                    |
| [0004](0004-aritmetica-de-dinero-propia.md) | Aritmética de dinero propia            |
| [0005](0005-categorias-como-cuentas.md)     | Una categoría es una cuenta del ledger |
| [0006](0006-cortes-de-saldo.md)             | Cortes de saldo como caché derivado    |

## Cuándo escribir uno

- Se elige entre dos o más opciones con consecuencias duraderas.
- Se descarta una alternativa que a otro le parecería la obvia.
- Se relaja o modifica una restricción del proyecto.

No escribas un ADR para decisiones reversibles en una tarde.

## Formato

```markdown
# NNNN — Título en una línea

**Estado:** Propuesto | Aceptado | Sustituido por [NNNN](NNNN-....md)
**Fecha:** AAAA-MM-DD

## Contexto

Qué situación obliga a decidir.

## Decisión

Qué se decidió, en voz activa.

## Alternativas consideradas

Qué más se evaluó y por qué se descartó.

## Consecuencias

Qué gana y qué cuesta. Incluye lo malo.
```
