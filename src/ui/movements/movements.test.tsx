import { fireEvent, waitFor } from '@testing-library/react-native';

import type { MovementDetail, MovementView } from '@/application/movements/movements';
import type { Observation } from '@/domain/ingest/observation';
import type { TransferRecord } from '@/domain/ingest/transfer-record';
import { merchantOf } from '@/domain/categorization/merchant';
import { createAccount } from '@/domain/ledger/account';
import { accountId, ownerId, transactionId } from '@/domain/ledger/ids';
import { createTransaction } from '@/domain/ledger/transaction';
import { money } from '@/domain/money/money';
import { renderWithProviders } from '@/test/render';

import { CashExpenseForm } from './cash-expense-form';
import { MovementDetail as MovementDetailView } from './movement-detail';
import { MovementRow } from './movement-row';

const owner = ownerId('david');
const banco = createAccount({
  id: accountId('bancolombia:ahorros'),
  owner,
  kind: 'activo',
  nombre: 'Bancolombia',
  currency: 'COP',
});
const nequi = createAccount({
  id: accountId('nequi:ahorros'),
  owner,
  kind: 'activo',
  nombre: 'Nequi',
  currency: 'COP',
});
const gastos = createAccount({
  id: accountId('sistema:gastos-sin-clasificar'),
  owner,
  kind: 'gasto',
  nombre: 'Gastos sin clasificar',
  currency: 'COP',
});

const compra: MovementView = {
  id: transactionId('bancolombia:C1'),
  fecha: '2026-08-28T00:00:00.000-05:00',
  descripcion: 'COMPRA EXITO',
  monto: money(45000, 'COP'),
  direction: 'sale',
  cuenta: banco,
  contraparte: gastos,
  esTransferencia: false,
  sinClasificar: true,
  fuente: 'bancolombia',
  comercio: merchantOf('COMPRA EXITO'),
  categoria: null,
  clasificacion: null,
};
const mercado = createAccount({
  id: accountId('categoria:mercado'),
  owner,
  kind: 'gasto',
  nombre: 'Mercado',
  currency: 'COP',
});
const clasificada: MovementView = {
  ...compra,
  contraparte: mercado,
  sinClasificar: false,
  categoria: {
    id: mercado.id,
    owner,
    kind: 'gasto',
    nombre: 'Mercado',
    grupo: 'comida',
    icono: 'cart',
    orden: 1,
    archivedAt: null,
  },
  clasificacion: {
    transactionId: compra.id,
    owner,
    categoria: mercado.id,
    origen: 'aprendida',
    reglaId: null,
    confianza: 72,
    clasificadoEn: '2026-08-28T10:00:00.000-05:00',
  },
};
const transferencia: MovementView = {
  ...compra,
  id: transactionId('bancolombia:T1'),
  descripcion: 'Transferencia entre cuentas',
  monto: money(200000, 'COP'),
  direction: 'neutro',
  contraparte: nequi,
  esTransferencia: true,
  sinClasificar: false,
};

describe('MovementRow', () => {
  it('muestra el comercio legible, fecha corta, cuenta, categoría y monto con signo', async () => {
    const { getByText } = await renderWithProviders(
      <MovementRow movement={compra} onPress={() => undefined} />,
    );
    expect(getByText('Éxito')).toBeOnTheScreen();
    expect(getByText('28 ago · Bancolombia · Por clasificar')).toBeOnTheScreen();
    expect(getByText('−$ 45.000')).toBeOnTheScreen();
  });

  it('con categoría la nombra en el subtítulo', async () => {
    const { getByText } = await renderWithProviders(
      <MovementRow movement={clasificada} onPress={() => undefined} />,
    );
    expect(getByText('28 ago · Bancolombia · Mercado')).toBeOnTheScreen();
  });

  it('una transferencia muestra origen → destino y monto neutro', async () => {
    const { getByText } = await renderWithProviders(
      <MovementRow movement={transferencia} onPress={() => undefined} />,
    );
    expect(getByText('Bancolombia → Nequi')).toBeOnTheScreen();
    expect(getByText('$ 200.000')).toBeOnTheScreen();
  });
});

describe('MovementDetail', () => {
  const transaccion = createTransaction({
    id: transactionId('bancolombia:T1'),
    owner,
    fecha: '2026-08-27T00:00:00.000-05:00',
    descripcion: 'Transferencia entre cuentas',
    origen: { fuente: 'bancolombia', referencia: 'T1' },
    postings: [
      { accountId: banco.id, amount: money(-200000, 'COP') },
      { accountId: nequi.id, amount: money(200000, 'COP') },
    ],
  });
  const observacion: Observation = {
    id: 'bancolombia:T1@bancolombia',
    transactionId: transaccion.id,
    owner,
    fuente: 'bancolombia',
    canal: 'web' as const,
    referencia: 'T1',
    huella: 'h',
    capturadoEn: '2026-08-28T10:00:00.000-05:00',
    runId: null,
    crudo: {
      fecha: '2026/08/27',
      descripcion: 'TRANSFERENCIA A NEQUI',
      monto: 200000,
      moneda: 'COP',
      tipo: 'debito',
      fuente: 'bancolombia',
      referencia: 'T1',
    },
  };
  const registro: TransferRecord = {
    id: 'tr',
    owner,
    transactionId: transaccion.id,
    salida: transaccion,
    entrada: transaccion,
    observacionesEntrada: [],
    estado: 'detectada',
    detectadaEn: '2026-08-28T10:00:00.000-05:00',
    resueltaEn: null,
  };
  const detalle: MovementDetail = {
    vista: transferencia,
    transaccion,
    cuentas: new Map([
      [banco.id, banco],
      [nequi.id, nequi],
    ]),
    observaciones: [observacion],
    transferencia: registro,
  };

  it('lista los apuntes con su cuenta y quién lo vio', async () => {
    const { getByText } = await renderWithProviders(<MovementDetailView detalle={detalle} />);
    expect(getByText('Bancolombia')).toBeOnTheScreen();
    expect(getByText('Nequi')).toBeOnTheScreen();
    expect(getByText('Visto por Bancolombia · 28 ago')).toBeOnTheScreen();
  });

  it('una transferencia detectada ofrece confirmar y deshacer', async () => {
    const onConfirm = jest.fn();
    const onUndo = jest.fn();
    const { getByRole } = await renderWithProviders(
      <MovementDetailView
        detalle={detalle}
        onConfirmTransfer={onConfirm}
        onUndoTransfer={onUndo}
      />,
    );
    await fireEvent.press(getByRole('button', { name: 'Sí, es una transferencia' }));
    await fireEvent.press(getByRole('button', { name: 'No, son dos cosas distintas' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('un gasto muestra la categoría con su origen en palabras y deja cambiarla', async () => {
    const onChange = jest.fn();
    const compraTx = createTransaction({
      id: compra.id,
      owner,
      fecha: compra.fecha,
      descripcion: 'COMPRA EXITO',
      origen: { fuente: 'bancolombia', referencia: 'C1' },
      postings: [
        { accountId: banco.id, amount: money(-45000, 'COP') },
        { accountId: mercado.id, amount: money(45000, 'COP') },
      ],
    });
    const { getByText, getByTestId } = await renderWithProviders(
      <MovementDetailView
        detalle={{
          vista: clasificada,
          transaccion: compraTx,
          cuentas: new Map([
            [banco.id, banco],
            [mercado.id, mercado],
          ]),
          observaciones: [],
          transferencia: null,
        }}
        onChangeCategory={onChange}
      />,
    );
    expect(getByText('Éxito')).toBeOnTheScreen();
    expect(getByText('COMPRA EXITO')).toBeOnTheScreen();
    expect(getByText('Clasificado solo (72 % seguro)')).toBeOnTheScreen();
    await fireEvent.press(getByTestId('fila-categoria'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('una transferencia no tiene fila de categoría', async () => {
    const { queryByTestId } = await renderWithProviders(<MovementDetailView detalle={detalle} />);
    expect(queryByTestId('fila-categoria')).toBeNull();
  });

  it('una transferencia confirmada no ofrece confirmar', async () => {
    const { queryByRole, getByText } = await renderWithProviders(
      <MovementDetailView
        detalle={{ ...detalle, transferencia: { ...registro, estado: 'confirmada' } }}
        onConfirmTransfer={() => undefined}
      />,
    );
    expect(queryByRole('button', { name: 'Sí, es una transferencia' })).toBeNull();
    expect(getByText('Transferencia confirmada')).toBeOnTheScreen();
  });
});

describe('CashExpenseForm', () => {
  it('no deja registrar hasta que hay monto y descripción', async () => {
    const { getByRole, getByLabelText } = await renderWithProviders(
      <CashExpenseForm onSubmit={() => Promise.resolve()} onCancel={() => undefined} />,
    );
    expect(getByRole('button', { name: 'Registrar' })).toBeDisabled();
    await fireEvent.changeText(getByLabelText('Monto'), '12000');
    expect(getByRole('button', { name: 'Registrar' })).toBeDisabled();
    await fireEvent.changeText(getByLabelText('Descripción'), 'Almuerzo');
    expect(getByRole('button', { name: 'Registrar' })).not.toBeDisabled();
  });

  it('envía el monto en pesos como bigint y la descripción', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole, getByLabelText } = await renderWithProviders(
      <CashExpenseForm onSubmit={onSubmit} onCancel={() => undefined} />,
    );
    await fireEvent.changeText(getByLabelText('Monto'), '12000');
    await fireEvent.changeText(getByLabelText('Descripción'), 'Almuerzo');
    await fireEvent.press(getByRole('button', { name: 'Registrar' }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(12000n, 'Almuerzo');
    });
  });

  it('si falla, lo dice sin detalle técnico', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('SQLITE_BUSY'));
    const { getByRole, getByLabelText, getByText, queryByText } = await renderWithProviders(
      <CashExpenseForm onSubmit={onSubmit} onCancel={() => undefined} />,
    );
    await fireEvent.changeText(getByLabelText('Monto'), '1');
    await fireEvent.changeText(getByLabelText('Descripción'), 'x');
    await fireEvent.press(getByRole('button', { name: 'Registrar' }));
    await waitFor(() => {
      expect(getByText('No se pudo registrar. Intenta de nuevo.')).toBeOnTheScreen();
    });
    expect(queryByText(/SQLITE/)).toBeNull();
  });
});
