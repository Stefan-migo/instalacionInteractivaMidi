/**
 * Tests for the phone pad's two-finger transform math.
 * Pinch drives the scale slider, twist drives the rotation slider.
 * The one-finger drag (position) is untouched and not covered here.
 */

const PadTransform = require('../phone-client/pad-transform');

describe('PadTransform — pinch distance', () => {
  test('measures the distance between two fingers', () => {
    expect(PadTransform.distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  test('returns 0 for fingers on the same point', () => {
    expect(PadTransform.distance({ x: 10, y: 10 }, { x: 10, y: 10 })).toBe(0);
  });
});

describe('PadTransform — twist angle', () => {
  test('reads 0 degrees for horizontal fingers', () => {
    expect(PadTransform.angleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
  });

  test('reads 90 degrees for vertical fingers', () => {
    expect(PadTransform.angleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90);
  });

  test('deltaAngle takes the shortest turn: 170 -> -170 is +20', () => {
    expect(PadTransform.deltaAngle(170, -170)).toBe(20);
  });

  test('deltaAngle takes the shortest turn backwards: -170 -> 170 is -20', () => {
    expect(PadTransform.deltaAngle(-170, 170)).toBe(-20);
  });
});

describe('PadTransform — wrapAngle', () => {
  test('keeps an angle that is already in range', () => {
    expect(PadTransform.wrapAngle(45)).toBe(45);
  });

  test('wraps past half a turn: 190 becomes -170', () => {
    expect(PadTransform.wrapAngle(190)).toBe(-170);
  });

  test('wraps below minus half a turn: -190 becomes 170', () => {
    expect(PadTransform.wrapAngle(-190)).toBe(170);
  });

  test('keeps +180 as +180', () => {
    expect(PadTransform.wrapAngle(180)).toBe(180);
  });
});

describe('PadTransform — pinch drives the scale slider', () => {
  test('doubling the finger distance doubles the starting scale', () => {
    expect(PadTransform.scaleFromPinch(60, 100, 200)).toBe(120);
  });

  test('never exceeds the 180 scale ceiling', () => {
    expect(PadTransform.scaleFromPinch(150, 100, 400)).toBe(180);
  });

  test('never drops below the 40 scale floor', () => {
    expect(PadTransform.scaleFromPinch(50, 100, 10)).toBe(40);
  });

  test('leaves the scale untouched when the pinch started collapsed', () => {
    expect(PadTransform.scaleFromPinch(77, 0, 50)).toBe(77);
  });

  test('rounds to an integer so the bridge accepts the scale action', () => {
    const value = PadTransform.scaleFromPinch(100, 100, 133);
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBe(133);
  });

  test('ignores a non-finite distance instead of emitting NaN', () => {
    expect(PadTransform.scaleFromPinch(88, 100, NaN)).toBe(88);
  });
});

describe('PadTransform — twist drives the rotation slider', () => {
  test('adds the twist delta to the starting rotation', () => {
    expect(PadTransform.rotationFromTwist(10, 35)).toBe(45);
  });

  test('wraps past half a turn instead of leaving the slider range', () => {
    expect(PadTransform.rotationFromTwist(170, 20)).toBe(-170);
  });

  test('wraps a full extra turn back into range', () => {
    expect(PadTransform.rotationFromTwist(0, 400)).toBe(40);
  });

  test('ignores a non-finite delta instead of emitting NaN', () => {
    expect(PadTransform.rotationFromTwist(15, NaN)).toBe(15);
  });
});
