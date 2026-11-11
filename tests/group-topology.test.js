const fs = require('fs');
const path = require('path');
const { deriveTopology, SLOT_COUNT, DEFAULT_GROUP_COUNT } = require('../bridge/topology');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

describe('group topology', () => {
  test('partitions the thirty slots into ten groups of three', () => {
    expect(SLOT_COUNT).toBe(30);
    expect(DEFAULT_GROUP_COUNT).toBe(10);
    expect(deriveTopology(30, 10)).toEqual({ slotCount: 30, groupCount: 10, slotsPerGroup: 3 });
  });

  test('a count that does not divide the phones evenly is refused, naming the divisors', () => {
    expect(() => deriveTopology(30, 7)).toThrow(/no divide los 30 telefonos en grupos iguales/);
    expect(() => deriveTopology(30, 7)).toThrow(/1, 2, 3, 5, 6, 10, 15, 30/);
    expect(() => deriveTopology(30, 0)).toThrow(/entero positivo/);
    expect(() => deriveTopology(30, 2.5)).toThrow(/entero positivo/);
  });

  test('the score declares the same ten groups the bridge partitions', () => {
    const mapping = JSON.parse(read('music/mapping.json'));
    expect(mapping.groups).toHaveLength(DEFAULT_GROUP_COUNT);
    mapping.groups.forEach((group, index) => {
      expect(group.group).toBe(index + 1);
      expect(group.channel).toBe(index + 1);
      expect(group.ccController).toBe(21);
      expect(group.aggregation).toBe('average');
      expect(group.notes).toEqual({ tilt: 36, flick: 37, rotation: 38 });
    });
    const pairs = mapping.groups.flatMap((group) => Object.values(group.notes).map((note) => `${group.channel}:${note}`));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs).toHaveLength(30);
  });

  test('the setup sheet lists the same ten channels and the same total', () => {
    const setup = read('music/ableton/SETUP.md');
    const section = setup.slice(setup.indexOf('## 5.'), setup.indexOf('## 6.'));
    for (let channel = 1; channel <= 10; channel += 1) {
      expect(section).toMatch(new RegExp(`\\| ${channel} \\| slots `));
    }
    expect(section).toMatch(/Sixty parameters/);
    expect(section).toMatch(/CC 21 posición, 22 escala, 23 rotación/);
    expect(section).toMatch(/GROUP_COUNT/);
  });
});
