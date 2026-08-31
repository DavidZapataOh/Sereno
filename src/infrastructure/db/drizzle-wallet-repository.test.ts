import type { Wallet } from '@/domain/crypto/wallet';
import { ownerId } from '@/domain/ledger/ids';

import { createDrizzleWalletRepository } from './drizzle-wallet-repository';
import { createTestDb } from './test-client';

const owner = ownerId('david');
const otro = ownerId('otra-persona');

const polygon: Wallet = {
  id: 'wallet:polygon:1',
  owner,
  chain: 'polygon',
  direccion: '0x5a4e9Bb1f224e8254C1d63e90dE34E8572f8dC71',
  nombre: 'Polygon',
};
const solana: Wallet = {
  id: 'wallet:solana:1',
  owner,
  chain: 'solana',
  direccion: '2VWvtXH5du9amnpU9NHP3dnry2ggSj6qcHwzwUn8DB5J',
  nombre: 'Solana',
};

const AHORA = '2026-08-31T10:00:00.000-05:00';

describe('WalletRepository sobre Drizzle', () => {
  let cliente: ReturnType<typeof createTestDb>;
  let repo: ReturnType<typeof createDrizzleWalletRepository>;

  beforeEach(() => {
    cliente = createTestDb();
    repo = createDrizzleWalletRepository(cliente.db);
  });

  afterEach(() => {
    cliente.close();
  });

  it('guarda y devuelve una wallet', async () => {
    await repo.guardar(polygon);

    expect(await repo.listar(owner)).toEqual([{ ...polygon, leidoEn: null, error: null }]);
  });

  it('lista solo las del propietario', async () => {
    await repo.guardar(polygon);
    await repo.guardar({ ...solana, id: 'wallet:solana:ajena', owner: otro });

    expect((await repo.listar(owner)).map((w) => w.id)).toEqual([polygon.id]);
  });

  it('una wallet recién guardada no tiene lectura todavía', () => {
    // Distinto de «se leyó y dio cero», que es lo que se enseña en la tarjeta.
    return repo.guardar(polygon).then(async () => {
      const [w] = await repo.listar(owner);
      expect(w?.leidoEn).toBeNull();
      expect(w?.error).toBeNull();
    });
  });

  it('marcarLectura deja el momento', async () => {
    await repo.guardar(polygon);
    await repo.marcarLectura(polygon.id, AHORA, null);

    expect((await repo.listar(owner))[0]?.leidoEn).toBe(AHORA);
  });

  it('marcarLectura con error lo guarda, y volver a leer bien lo limpia', async () => {
    await repo.guardar(polygon);
    await repo.marcarLectura(polygon.id, AHORA, 'el nodo no respondió');
    expect((await repo.listar(owner))[0]?.error).toBe('el nodo no respondió');

    await repo.marcarLectura(polygon.id, AHORA, null);
    expect((await repo.listar(owner))[0]?.error).toBeNull();
  });

  /**
   * Lo que este adaptador tiene de particular. Editar el nombre no puede borrar
   * la constancia de la última lectura: es lo que distingue «se leyó y da cero»
   * de «nunca se ha leído», y la tarjeta de la pantalla enseña las dos cosas.
   */
  it('volver a guardar no pisa leidoEn ni error', async () => {
    await repo.guardar(polygon);
    await repo.marcarLectura(polygon.id, AHORA, 'falló');

    await repo.guardar({ ...polygon, nombre: 'Mi Polygon' });

    const [w] = await repo.listar(owner);
    expect(w?.nombre).toBe('Mi Polygon');
    expect(w?.leidoEn).toBe(AHORA);
    expect(w?.error).toBe('falló');
  });

  it('volver a guardar no duplica', async () => {
    await repo.guardar(polygon);
    await repo.guardar({ ...polygon, nombre: 'otro nombre' });

    expect(await repo.listar(owner)).toHaveLength(1);
  });

  it('borrar la quita', async () => {
    await repo.guardar(polygon);
    await repo.borrar(polygon.id);

    expect(await repo.listar(owner)).toEqual([]);
  });

  it('borrar una que no existe no revienta', async () => {
    await expect(repo.borrar('wallet:que:no:existe')).resolves.toBeUndefined();
  });

  it('marcarLectura sobre una que no existe no crea nada', async () => {
    await repo.marcarLectura('wallet:fantasma', AHORA, null);

    expect(await repo.listar(owner)).toEqual([]);
  });
});
