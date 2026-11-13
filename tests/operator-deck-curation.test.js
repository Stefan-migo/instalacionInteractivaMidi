const Curation = require('../operator/deck-curation');

describe('operator deck curation logic', () => {
  test('toggle, select all, select none and clear selection', () => {
    let selected = new Set();
    selected = Curation.toggleSelection(selected, 'a', ['a', 'b']);
    expect([...selected]).toEqual(['a']);
    selected = Curation.selectAll(['a', 'b']);
    expect([...selected]).toEqual(['a', 'b']);
    selected = Curation.selectNone();
    expect([...selected]).toEqual([]);
    selected = Curation.toggleSelection(new Set(['a']), 'a', ['a', 'b']);
    expect([...selected]).toEqual([]);
  });

  test('shift ranges work in both directions and preserve selections outside range', () => {
    const down = Curation.toggleSelection(new Set(['z']), 'd', ['a', 'b', 'c', 'd', 'e'], 'b');
    expect([...down]).toEqual(['z', 'b', 'c', 'd']);
    const up = Curation.toggleSelection(new Set(['z']), 'b', ['a', 'b', 'c', 'd', 'e'], 'd');
    expect([...up]).toEqual(['z', 'b', 'c', 'd']);
  });

  test('bulk action confirmation names the action and selected image count', () => {
    expect(Curation.bulkActionMessage(12, 'L')).toBe('12 imágenes en L');
  });

  test.each([[31, 0], [30, 0], [29, 1], [25, 5]])('warning reports empty cells for %i usable images', (available, empty) => {
    expect(Curation.warningMessage(available, 30)).toBe(empty ? `${available} imágenes disponibles; al guardar quedarían vacías ${empty} de las 30 celdas.` : '');
  });

  test('assigned images have a visible class marker while unassigned images do not', () => {
    expect(Curation.sizeMarker({ '001': 'L' }, '001')).toEqual({ assigned: true, label: 'L' });
    expect(Curation.sizeMarker({}, '002')).toEqual({ assigned: false, label: '' });
  });

  test('unassigned filter hides exactly assigned images and restores all when disabled', () => {
    const files = ['001', '002', '003'];
    const assignments = { '002': 'M' };
    expect(Curation.visibleImageKeys(files, assignments, true)).toEqual(['001', '003']);
    expect(Curation.visibleImageKeys(files, assignments, false)).toEqual(files);
  });

  test('assignment counts include empty reset and mixed libraries', () => {
    expect(Curation.assignmentCount(210, {})).toEqual({ assigned: 0, total: 210 });
    expect(Curation.assignmentCount(4, { '001': 'S', '003': 'XL' })).toEqual({ assigned: 2, total: 4 });
  });

  test('operator source wires filter, badge and selection independently', () => {
    const fs = require('fs');
    const source = fs.readFileSync(require.resolve('../operator/operator'), 'utf8');
    expect(source).toMatch(/visibleImageKeys/);
    expect(source).toMatch(/sizeMarker/);
    expect(source).toMatch(/selected\.has\(key\)/);
  });

  test('repeating an action replaces its keyed toast instead of stacking', () => {
    const once = Curation.replaceToast([], 'preset', 'Distribución: scatter');
    expect(Curation.replaceToast(once, 'preset', 'Distribución: neat-grid')).toEqual([{ key: 'preset', message: 'Distribución: neat-grid' }]);
    expect(Curation.replaceToast(once, 'filter', 'Filtro: sepia')).toHaveLength(2);
  });
});
