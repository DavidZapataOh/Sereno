import type { PendingGroup } from '@/application/categorization/review';
import type { Category } from '@/domain/categorization/category';
import { merchantOf } from '@/domain/categorization/merchant';
import type { Rule } from '@/domain/categorization/rule';
import { categoryAccountId } from '@/domain/categorization/taxonomy';
import { ownerId, transactionId } from '@/domain/ledger/ids';
import { money } from '@/domain/money/money';
import { fireEvent, renderWithProviders } from '@/test/render';

import { CategoryPicker } from './category-picker';
import { CategoryRow } from './category-row';
import { PendingGroupRow } from './pending-group-row';
import { RuleRow, ruleSentence } from './rule-row';

const owner = ownerId('david');
const categoria = (slug: string, nombre: string, grupo: Category['grupo']): Category => ({
  id: categoryAccountId(slug),
  owner,
  kind: grupo === 'ingresos' ? 'ingreso' : 'gasto',
  nombre,
  grupo,
  icono: 'cart',
  orden: 1,
  archivedAt: null,
});
const mercado = categoria('mercado', 'Mercado', 'comida');
const arriendo = categoria('arriendo', 'Arriendo o cuota de vivienda', 'vivienda');
const salario = categoria('salario', 'Salario', 'ingresos');

describe('CategoryPicker', () => {
  it('agrupa por sección, marca la elegida con palabras y entrega la elección', async () => {
    const onSelect = jest.fn();
    const { getByText, getByRole } = await renderWithProviders(
      <CategoryPicker
        visible
        categories={[mercado, arriendo, salario]}
        selected={mercado.id}
        onSelect={onSelect}
        onClose={() => undefined}
      />,
    );
    expect(getByText('COMIDA')).toBeOnTheScreen();
    expect(getByText('VIVIENDA')).toBeOnTheScreen();
    expect(getByText('Elegida')).toBeOnTheScreen();
    await fireEvent.press(getByRole('button', { name: 'Arriendo o cuota de vivienda' }));
    expect(onSelect).toHaveBeenCalledWith('categoria:arriendo');
  });

  it('el buscador filtra sin acentos y dice cuando no hay nada', async () => {
    const { getByLabelText, queryByText, getByText } = await renderWithProviders(
      <CategoryPicker
        visible
        categories={[mercado, arriendo, salario]}
        selected={null}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );
    await fireEvent.changeText(getByLabelText('Buscar'), 'MÉRC');
    expect(getByText('Mercado')).toBeOnTheScreen();
    expect(queryByText('Salario')).toBeNull();
    await fireEvent.changeText(getByLabelText('Buscar'), 'zzz');
    expect(getByText('Ninguna categoría se llama así.')).toBeOnTheScreen();
  });
});

describe('CategoryRow', () => {
  it('nombra la categoría y muestra el total con signo de salida', async () => {
    const onPress = jest.fn();
    const { getByText, getByRole } = await renderWithProviders(
      <CategoryRow
        spending={{ categoria: mercado, total: money(150000, 'COP') }}
        onPress={onPress}
      />,
    );
    expect(getByText('Mercado')).toBeOnTheScreen();
    expect(getByText('−$ 150.000')).toBeOnTheScreen();
    await fireEvent.press(getByRole('button', { name: /Mercado. Salen/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('PendingGroupRow', () => {
  it('muestra comercio, cuántos, cuánto y la sugerencia', async () => {
    const group: PendingGroup = {
      comercio: merchantOf('COMPRA PANADERIA DONA ROSA'),
      transacciones: [
        {
          id: transactionId('a'),
          fecha: '2026-08-30T00:00:00.000-05:00',
          descripcion: 'x',
          monto: money(8000, 'COP'),
          sugerida: null,
        },
        {
          id: transactionId('b'),
          fecha: '2026-08-30T00:00:00.000-05:00',
          descripcion: 'y',
          monto: money(12000, 'COP'),
          sugerida: null,
        },
      ],
      total: money(20000, 'COP'),
      sugerida: mercado.id,
    };
    const { getByText } = await renderWithProviders(
      <PendingGroupRow
        group={group}
        categorias={new Map([[mercado.id, mercado]])}
        onPress={() => undefined}
      />,
    );
    expect(getByText('Panaderia Dona Rosa')).toBeOnTheScreen();
    expect(getByText('2 movimientos · Sereno sugiere: Mercado')).toBeOnTheScreen();
    expect(getByText('−$ 20.000')).toBeOnTheScreen();
  });
});

describe('RuleRow', () => {
  const rule: Rule = {
    id: 'r1',
    owner,
    campo: 'comercio',
    operador: 'es',
    valor: 'panaderia dona',
    categoria: mercado.id,
    creadaEn: '2026-08-30T10:00:00.000-05:00',
    activa: true,
  };

  it('se lee en llano y se puede borrar', async () => {
    const onDelete = jest.fn();
    const { getByText, getByRole } = await renderWithProviders(
      <RuleRow rule={rule} categoria="Mercado" onDelete={onDelete} />,
    );
    expect(getByText('Cuando el comercio es «panaderia dona» → Mercado')).toBeOnTheScreen();
    await fireEvent.press(getByRole('button', { name: /Borrar la regla/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('si la categoría ya no existe, lo dice', () => {
    expect(ruleSentence({ ...rule, operador: 'contiene', campo: 'descripcion' }, undefined)).toBe(
      'Cuando la descripción contiene «panaderia dona» → una categoría que ya no existe',
    );
  });
});
