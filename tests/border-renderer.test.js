describe('drawBorder', () => {
  let drawBorder;
  let mockP;

  beforeAll(() => {
    drawBorder = require('../p5-collage/border-renderer').drawBorder;
  });

  beforeEach(() => {
    global.generateTornBorder = jest.fn(() => [
      { x: 100, y: 100 }, { x: 150, y: 105 }, { x: 200, y: 98 },
    ]);

    mockP = {
      push: jest.fn(),
      pop: jest.fn(),
      noFill: jest.fn(),
      noStroke: jest.fn(),
      fill: jest.fn(),
      stroke: jest.fn(),
      strokeWeight: jest.fn(),
      beginShape: jest.fn(),
      vertex: jest.fn(),
      endShape: jest.fn(),
      rect: jest.fn(),
      ellipse: jest.fn(),
      strokeJoin: jest.fn(),
      strokeCap: jest.fn(),
      color: jest.fn(() => ({ toString: () => '#000000' })),
      colorMode: jest.fn(),
      CLOSE: 2,
    };
    global.drawingContext = {
      setLineDash: jest.fn(),
      lineDashOffset: 0,
      globalAlpha: 1,
    };
  });

  afterEach(() => {
    delete global.generateTornBorder;
    delete global.drawingContext;
  });

  const defaultCellState = {
    pos: { x: 100, y: 100, w: 200, h: 150, rotation: 0 },
    borderVerts: [
      { x: 100, y: 100 }, { x: 150, y: 105 }, { x: 200, y: 98 },
    ],
  };

  test('torn style does not throw', () => {
    expect(() => drawBorder(defaultCellState, mockP, 'torn')).not.toThrow();
  });

  test('torn style draws vertices via beginShape/vertex/endShape', () => {
    drawBorder(defaultCellState, mockP, 'torn');
    expect(mockP.beginShape).toHaveBeenCalled();
    expect(mockP.vertex).toHaveBeenCalledTimes(3);
    expect(mockP.endShape).toHaveBeenCalledWith(2); // CLOSE
  });

  test('polaroid style does not throw', () => {
    expect(() => drawBorder(defaultCellState, mockP, 'polaroid')).not.toThrow();
  });

  test('polaroid style calls fill and rect 5 times (4 strips + 1 stroke outline)', () => {
    drawBorder(defaultCellState, mockP, 'polaroid');
    expect(mockP.fill).toHaveBeenCalledWith(248, 248, 248);
    // 4 frame strips + 1 stroke outline rect
    expect(mockP.rect.mock.calls.length).toBe(5);
  });

  test('stamp style does not throw', () => {
    expect(() => drawBorder(defaultCellState, mockP, 'stamp')).not.toThrow();
  });

  test('stamp style calls setLineDash for dashed outline', () => {
    drawBorder(defaultCellState, mockP, 'stamp');
    expect(global.drawingContext.setLineDash).toHaveBeenCalledWith([4, 4]);
    // Should also reset to empty array
    expect(global.drawingContext.setLineDash).toHaveBeenCalledWith([]);
  });

  test('gold style does not throw', () => {
    expect(() => drawBorder(defaultCellState, mockP, 'gold')).not.toThrow();
  });

  test('gold style fills dark background and draws gold rect', () => {
    drawBorder(defaultCellState, mockP, 'gold');
    expect(mockP.noStroke).toHaveBeenCalled();
    expect(mockP.fill).toHaveBeenCalledWith(30, 25, 20);
    expect(mockP.stroke).toHaveBeenCalledWith(201, 169, 110);
    expect(mockP.strokeWeight).toHaveBeenCalledWith(2);
    expect(mockP.rect).toHaveBeenCalled();
  });

  test('minimal style does not throw', () => {
    expect(() => drawBorder(defaultCellState, mockP, 'minimal')).not.toThrow();
  });

  test('minimal style uses low alpha stroke', () => {
    drawBorder(defaultCellState, mockP, 'minimal');
    expect(mockP.noFill).toHaveBeenCalled();
    // RGBA stroke — alpha should be ≤ 80 (0.3 * 255 ≈ 76)
    const strokeCalls = mockP.stroke.mock.calls;
    const hasLowAlpha = strokeCalls.some(args => {
      const lastArg = args[args.length - 1];
      return typeof lastArg === 'number' && lastArg <= 80;
    });
    expect(hasLowAlpha).toBe(true);
  });

  test('unknown style does not throw', () => {
    expect(() => drawBorder(defaultCellState, mockP, 'unknown')).not.toThrow();
  });

  // ── New border styles (Phase 4) ──────────────────────────────────

  describe('deckled-edge', () => {
    test('does not throw', () => {
      expect(() => drawBorder(defaultCellState, mockP, 'deckled-edge')).not.toThrow();
    });

    test('uses its own shape (not default torn borderVerts)', () => {
      drawBorder(defaultCellState, mockP, 'deckled-edge');
      // Deckled-edge uses beginShape for the inner jittered edge
      expect(mockP.beginShape).toHaveBeenCalled();
      // Verify it also draws the outer straight rect
      expect(mockP.rect).toHaveBeenCalled();
    });

    test('draws stroke for deckled outline', () => {
      drawBorder(defaultCellState, mockP, 'deckled-edge');
      expect(mockP.stroke).toHaveBeenCalled();
    });
  });

  describe('double-line', () => {
    test('does not throw', () => {
      expect(() => drawBorder(defaultCellState, mockP, 'double-line')).not.toThrow();
    });

    test('does NOT fall back to torn', () => {
      drawBorder(defaultCellState, mockP, 'double-line');
      expect(mockP.beginShape).not.toHaveBeenCalled();
    });

    test('calls rect twice for two concentric outlines', () => {
      drawBorder(defaultCellState, mockP, 'double-line');
      expect(mockP.rect).toHaveBeenCalledTimes(2);
    });
  });

  describe('shadow-box', () => {
    test('does not throw', () => {
      expect(() => drawBorder(defaultCellState, mockP, 'shadow-box')).not.toThrow();
    });

    test('does NOT fall back to torn', () => {
      drawBorder(defaultCellState, mockP, 'shadow-box');
      expect(mockP.beginShape).not.toHaveBeenCalled();
    });

    test('fills dark background rect', () => {
      drawBorder(defaultCellState, mockP, 'shadow-box');
      expect(mockP.fill).toHaveBeenCalled();
      expect(mockP.rect).toHaveBeenCalled();
    });
  });


});
