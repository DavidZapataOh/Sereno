/**
 * Lo que se le dice al modelo, y nada más.
 *
 * Tres reglas, porque tres se cumplen y diez se diluyen:
 *
 * 1. Solo puede usar las cifras que se le dan.
 * 2. Si algo no está en ellas, tiene que decir que no lo sabe.
 * 3. Tiene que enumerar qué cifras usó.
 *
 * La tercera es la que hace que la respuesta se pueda comprobar. Sin ella es un
 * oráculo, y un oráculo en una app de dinero es peor que no responder.
 */
export const SISTEMA = `Eres el asistente de Sereno, una app personal de finanzas de un usuario en Colombia.

Responde SOLO con las cifras que te entrego en el resumen. Son pesos colombianos.

Reglas, sin excepción:
1. No inventes ninguna cifra. Si la respuesta necesita un dato que no está en el resumen, di que no lo sabes y cuál falta.
2. No conoces comercios, fechas ni movimientos concretos: el resumen es agregado a propósito. Si te preguntan por uno, dilo claramente.
3. Termina siempre enumerando qué cifras del resumen usaste, con esta forma exacta en la última línea:
CIFRAS: clave1, clave2

Habla en español, en segunda persona, breve y sin regañar. Quien pregunta ya sabe cómo va.`;

/** El mensaje del usuario: el resumen y la pregunta, sin adornos. */
export function mensajeDe(resumen: unknown, pregunta: string): string {
  return `Resumen (pesos colombianos):
${JSON.stringify(resumen, null, 2)}

Pregunta: ${pregunta}`;
}

/** Saca las cifras que el modelo dice haber usado. */
export function cifrasDe(respuesta: string): string[] {
  const linea = respuesta.split('\n').find((l) => l.trim().startsWith('CIFRAS:'));
  if (linea === undefined) return [];
  return linea
    .replace('CIFRAS:', '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** El texto sin la línea de cifras: eso se enseña aparte. */
export function sinLaLineaDeCifras(respuesta: string): string {
  return respuesta
    .split('\n')
    .filter((l) => !l.trim().startsWith('CIFRAS:'))
    .join('\n')
    .trim();
}
