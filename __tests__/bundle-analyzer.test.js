const { analyzeBundleSize } = require('../analyzers/bundle-analyzer');

describe('bundle-analyzer', () => {
  test('should return null if bundleData is missing', () => {
    const result = analyzeBundleSize(null, new Map());
    expect(result).toBeNull();
  });

  test('should analyze bundle size and correlate with performance', () => {
    const componentSizes = new Map([
      ['ProductCard', 120 * 1024], // >100KB warning threshold
      ['Header', 10 * 1024]
    ]);
    const componentPaths = new Map([
      ['ProductCard', '/path/to/ProductCard.js'],
      ['Header', '/path/to/Header.js']
    ]);
    const bundleData = {
      totalSize: 130 * 1024,
      componentSizes,
      componentPaths,
      modules: []
    };

    const componentRenderMap = new Map([
      ['ProductCard', [{ timestamp: 100, duration: 10 }]],
      ['Header', [{ timestamp: 100, duration: 2 }]]
    ]);

    const result = analyzeBundleSize(bundleData, componentRenderMap);
    expect(result.totalSizeKB).toBe('130.00');
    expect(result.largeComponents.length).toBe(1);
    expect(result.largeComponents[0].component).toBe('ProductCard');
    expect(result.largeComponents[0].severity).toBe('warning');
    expect(result.componentPaths.ProductCard).toBe('/path/to/ProductCard.js');
    expect(result.correlationCoefficient).toBe(1); // perfectly correlated size vs render time
  });
});
