import { ownerId } from '@/domain/ledger/ids';
import { createInMemoryWalletRepository } from '@/test/fakes/in-memory-wallet-repository';
import { createSequentialIds } from '@/test/fakes/sequential-ids';

import { addWallet, listWallets, removeWallet, type ManageWalletsDeps } from './manage-wallets';

const owner = ownerId('david');
const otro = ownerId('otra-persona');

const DIRECCION_EVM = '0x5a4e9Bb1f224e8254C1d63e90dE34E8572f8dC71';
const DIRECCION_SOLANA = '2VWvtXH5du9amnpU9NHP3dnry2ggSj6qcHwzwUn8DB5J';

function deps(): ManageWalletsDeps {
  return { wallets: createInMemoryWalletRepository(), ids: createSequentialIds() };
}

describe('addWallet', () => {
  it('guarda una wallet válida y la devuelve', async () => {
    const d = deps();
    const w = await addWallet(d, {
      owner,
      direccion: DIRECCION_EVM,
      nombre: 'Polygon',
    });

    expect(w.direccion).toBe(DIRECCION_EVM);
    expect(await listWallets(d, owner)).toHaveLength(1);
  });

  /**
   * La red se deduce de la dirección en vez de preguntarse. Elegirla era una
   * decisión que el usuario no tiene por qué tomar, y en la que se podía
   * equivocar sin enterarse: una dirección buena en la red equivocada devuelve
   * cero, y un cero no se distingue de un saldo vacío.
   */
  it('deduce la red de la dirección, sin preguntar', async () => {
    const d = deps();
    const evm = await addWallet(d, { owner, direccion: DIRECCION_EVM, nombre: 'EVM' });
    const sol = await addWallet(d, { owner, direccion: DIRECCION_SOLANA, nombre: 'Solana' });

    expect(evm.red).toBe('evm');
    expect(sol.red).toBe('solana');
  });

  it('rechaza lo que no tiene forma de dirección de ninguna red', async () => {
    await expect(addWallet(deps(), { owner, direccion: '0x123', nombre: 'x' })).rejects.toThrow(
      /forma/i,
    );
  });

  /**
   * La barrera que importa. Sereno no conoce ninguna clave privada y no tiene
   * dónde meterla: si alguien pega una aquí, la validación de forma la rechaza
   * y el error se ve, en vez de quedar guardada en la base.
   */
  it('una clave privada no tiene forma de dirección y se rechaza', async () => {
    const claveFalsa = `0x${'a'.repeat(64)}`;

    await expect(addWallet(deps(), { owner, direccion: claveFalsa, nombre: 'x' })).rejects.toThrow(
      /forma/i,
    );
  });

  it('exige un nombre: una lista de direcciones sin nombre no se lee', async () => {
    await expect(
      addWallet(deps(), { owner, direccion: DIRECCION_EVM, nombre: '   ' }),
    ).rejects.toThrow(/nombre/i);
  });

  it('guarda la dirección sin espacios alrededor', async () => {
    const d = deps();
    // Pegar desde el explorador arrastra espacios, y con ellos la dirección no
    // vale: el nodo devolvería cero sin decir por qué.
    await addWallet(d, {
      owner,
      direccion: `  ${DIRECCION_SOLANA}\n`,
      nombre: 'Solana',
    });

    expect((await listWallets(d, owner))[0]?.direccion).toBe(DIRECCION_SOLANA);
  });

  it('dos wallets distintas no comparten id', async () => {
    const d = deps();
    const a = await addWallet(d, {
      owner,
      direccion: DIRECCION_EVM,
      nombre: 'a',
    });
    const b = await addWallet(d, { owner, direccion: DIRECCION_EVM, nombre: 'b' });

    expect(a.id).not.toBe(b.id);
  });
});

describe('listWallets y removeWallet', () => {
  it('lista solo las del propietario', async () => {
    const d = deps();
    await addWallet(d, { owner, direccion: DIRECCION_EVM, nombre: 'mía' });
    await addWallet(d, { owner: otro, direccion: DIRECCION_EVM, nombre: 'ajena' });

    expect((await listWallets(d, owner)).map((w) => w.nombre)).toEqual(['mía']);
  });

  it('una wallet recién añadida no tiene lectura todavía', async () => {
    // Distinto de «se leyó y dio cero»: sin esto no se puede decir cuál es cuál.
    const d = deps();
    await addWallet(d, { owner, direccion: DIRECCION_EVM, nombre: 'x' });

    expect((await listWallets(d, owner))[0]?.leidoEn).toBeNull();
  });

  it('borrar la quita de la lista', async () => {
    const d = deps();
    const w = await addWallet(d, {
      owner,
      direccion: DIRECCION_EVM,
      nombre: 'x',
    });
    await removeWallet(d, w.id);

    expect(await listWallets(d, owner)).toEqual([]);
  });
});
