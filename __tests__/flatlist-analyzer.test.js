const { FlatListAnalyzer } = require('../analyzers/flatlist-analyzer');

describe('flatlist-analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new FlatListAnalyzer();
  });

  test('should detect no issues for healthy lists', () => {
    const componentRenderMap = new Map([
      ['MyFlatList', [
        { duration: 5, reason: { props: ['data'], state: [], context: false } }
      ]]
    ]);
    const result = analyzer.analyze(componentRenderMap, new Map());
    expect(result.length).toBe(0);
  });

  test('should detect high render count, expensive rendering, and wasted renders', () => {
    const renders = Array.from({ length: 25 }, (_, i) => ({
      duration: 25,
      reason: { props: [], state: [], context: false } // wasted render
    }));

    const componentRenderMap = new Map([
      ['MyFlatList', renders]
    ]);

    const result = analyzer.analyze(componentRenderMap, new Map());
    expect(result.length).toBe(1);
    expect(result[0].component).toBe('MyFlatList');
    expect(result[0].renderCount).toBe(25);
    expect(parseFloat(result[0].avgRenderTime)).toBe(25.0);
    expect(result[0].wastedRenders).toBe(25);
    expect(result[0].severity).toBe(1.0); // 0.3 + 0.4 + 0.3 = 1.0
  });
});
