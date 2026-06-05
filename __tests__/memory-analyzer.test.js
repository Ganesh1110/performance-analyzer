const { analyzeMemory } = require('../analyzers/memory-analyzer');

describe('memory-analyzer', () => {
  test('should detect stable memory trend and no spikes/leaks', () => {
    const flashlightMeasures = Array.from({ length: 10 }, (_, i) => ({
      time: i * 500,
      ram: 150
    }));
    const componentRenderMap = new Map();

    const result = analyzeMemory(flashlightMeasures, componentRenderMap);
    expect(result.trend).toBe('stable');
    expect(result.spikes.length).toBe(0);
    expect(result.leaks.length).toBe(0);
  });

  test('should detect memory spikes', () => {
    const flashlightMeasures = [
      { time: 0, ram: 150 },
      { time: 500, ram: 180 }, // +30MB delta
      { time: 1000, ram: 520 } // >512MB critical
    ];
    const componentRenderMap = new Map();

    const result = analyzeMemory(flashlightMeasures, componentRenderMap);
    expect(result.spikes.length).toBe(2);
    expect(result.spikes[0].delta).toBe(30);
    expect(result.spikes[1].severity).toBe('critical');
  });

  test('should detect memory leaks and correlate suspect components', () => {
    // 60 measures to satisfy windowSize >= 10
    const flashlightMeasures = [];
    for (let i = 0; i < 60; i++) {
      flashlightMeasures.push({
        time: i * 500,
        ram: 100 + i * 10 // grows faster to trigger leakThreshold
      });
    }

    const componentRenderMap = new Map([
      ['LeakyComponent', Array.from({ length: 10 }, (_, i) => ({ timestamp: i * 1000, duration: 5 }))]
    ]);

    const result = analyzeMemory(flashlightMeasures, componentRenderMap);
    expect(result.leaks.length).toBeGreaterThan(0);
    expect(result.leaks[0].suspectComponents.some(c => c.name === 'LeakyComponent')).toBe(true);
    expect(result.componentMemoryCorrelations.length).toBeGreaterThan(0);
  });
});
