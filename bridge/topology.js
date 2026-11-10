'use strict';

// Thirty phones are partitioned into groups. How many groups is configuration,
// never a constant: the score in `music/mapping.json` declares the same number,
// and the bridge refuses to start on a partition that does not divide evenly,
// because a half-filled group would silently lose phones.

const SLOT_COUNT = 30;
const DEFAULT_GROUP_COUNT = 10;

function divisorsOf(value) {
  const divisors = [];
  for (let n = 1; n <= value; n += 1) if (value % n === 0) divisors.push(n);
  return divisors;
}

function deriveTopology(slotCount, groupCount) {
  if (!Number.isInteger(slotCount) || slotCount < 1) {
    throw new RangeError(`SLOT_COUNT tiene que ser un entero positivo (recibi ${slotCount})`);
  }
  if (!Number.isInteger(groupCount) || groupCount < 1) {
    throw new RangeError(`GROUP_COUNT tiene que ser un entero positivo (recibi ${groupCount})`);
  }
  if (slotCount % groupCount !== 0) {
    throw new RangeError(
      `GROUP_COUNT=${groupCount} no divide los ${slotCount} telefonos en grupos iguales; usa un divisor: ${divisorsOf(slotCount).join(', ')}`,
    );
  }
  return { slotCount, groupCount, slotsPerGroup: slotCount / groupCount };
}

module.exports = { SLOT_COUNT, DEFAULT_GROUP_COUNT, deriveTopology };
