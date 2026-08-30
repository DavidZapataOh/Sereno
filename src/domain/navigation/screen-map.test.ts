import { mustExist } from '@/test/must-exist';

import { depthOf, SCREEN_MAP, TAB_IDS } from './screen-map';

describe('mapa de pantallas', () => {
  it('declara exactamente cuatro pestañas', () => {
    expect(TAB_IDS).toHaveLength(4);
  });

  it('las pestañas no tienen padre', () => {
    TAB_IDS.forEach((id) => {
      expect(mustExist(SCREEN_MAP.find((s) => s.id === id)).padre).toBeNull();
    });
  });

  it('solo las pestañas carecen de padre', () => {
    // Una pantalla sin padre que no sea pestaña sería inalcanzable.
    const sinPadre = SCREEN_MAP.filter((s) => s.padre === null).map((s) => s.id);
    expect([...sinPadre].sort()).toEqual([...TAB_IDS].sort());
  });

  it('los identificadores son únicos', () => {
    const ids = SCREEN_MAP.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('las rutas son únicas', () => {
    const rutas = SCREEN_MAP.map((s) => s.ruta);
    expect(new Set(rutas).size).toBe(rutas.length);
  });

  it('todo padre declarado existe', () => {
    const ids = new Set(SCREEN_MAP.map((s) => s.id));
    SCREEN_MAP.forEach((pantalla) => {
      if (pantalla.padre !== null) expect(ids.has(pantalla.padre)).toBe(true);
    });
  });

  it('no hay ciclos en la jerarquía', () => {
    SCREEN_MAP.forEach((pantalla) => {
      expect(() => depthOf(pantalla.id)).not.toThrow();
    });
  });

  it('ninguna pantalla queda a más de tres toques', () => {
    const profundas = SCREEN_MAP.filter((s) => depthOf(s.id) > 3).map((s) => s.id);
    expect(profundas).toEqual([]);
  });

  it('cada pantalla declara la pregunta que responde', () => {
    SCREEN_MAP.forEach((pantalla) => {
      expect(pantalla.pregunta.length).toBeGreaterThan(10);
      expect(pantalla.pregunta.endsWith('?')).toBe(true);
    });
  });

  it('cada pantalla declara en qué sprint aparece', () => {
    SCREEN_MAP.forEach((pantalla) => {
      expect(pantalla.fase).toBeGreaterThanOrEqual(1);
    });
  });

  it('ninguna pantalla del camino principal es de captura manual', () => {
    // Principio 4: cero trabajo manual en el recorrido central.
    const principales = SCREEN_MAP.filter((s) => depthOf(s.id) <= 2);
    principales.forEach((pantalla) => {
      expect(pantalla.id).not.toMatch(/registrar|nuevo-gasto|agregar-manual/);
    });
  });

  it('las rutas de expo-router empiezan por barra', () => {
    SCREEN_MAP.forEach((pantalla) => {
      expect(pantalla.ruta.startsWith('/')).toBe(true);
    });
  });
});

describe('depthOf', () => {
  it('una pestaña está a profundidad 1', () => {
    expect(depthOf('hoy')).toBe(1);
  });

  it('una pantalla bajo ajustes está a profundidad 3', () => {
    expect(depthOf('diagnostico')).toBe(3);
  });

  it('lanza ante un identificador desconocido', () => {
    expect(() => depthOf('inexistente')).toThrow(/desconocida/);
  });
});
