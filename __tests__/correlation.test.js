const { findMatchingCommits, correlateMemoryWithComponents } = require('../utils/correlation');

describe('correlation utilities', () => {
  test('findMatchingCommits should return a default native candidate if no commits exist', () => {
    const result = findMatchingCommits(1000, []);
    expect(result.length).toBe(1);
    expect(result[0].component).toBeNull();
    expect(result[0].confidence).toBe(0);
  });

  test('findMatchingCommits should calculate proximity scores and filter by minConfidence', () => {
    const reactCommits = [
      {
        timestamp: 965, // matches exactly: 1000 - 35 (pipelineDelay) = 965
        duration: 20,
        components: [
          { name: 'SlowComponent', duration: 16.67 } // critical render time = 16.67 -> costScore = 1
        ]
      }
    ];

    const result = findMatchingCommits(1000, reactCommits);
    expect(result.length).toBe(1);
    expect(result[0].component).toBe('SlowComponent');
    expect(result[0].confidence).toBe(1.0); // proximity = 1.0, cost = 1.0 -> confidence = 1.0
  });

  test('correlateMemoryWithComponents should correlate memory deltas with components', () => {
    const memoryData = [
      { timestamp: 100, delta: 10 },
      { timestamp: 200, delta: -2 }
    ];
    const componentRenderMap = new Map([
      ['MyLeakyComp', [{ timestamp: 105, duration: 5 }]]
    ]);

    const result = correlateMemoryWithComponents(memoryData, componentRenderMap);
    expect(result.length).toBe(1);
    expect(result[0].component).toBe('MyLeakyComp');
    expect(result[0].avgMemoryDelta).toBe(10);
  });
});
