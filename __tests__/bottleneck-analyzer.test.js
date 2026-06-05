const { detectBottlenecks } = require('../analyzers/bottleneck-analyzer');
const CONFIG = require('../config');

describe('bottleneck-analyzer', () => {
  test('should detect no bottlenecks when metrics are within target thresholds', () => {
    const flashlightMeasures = [
      { time: 1000, fps: 60, cpuTotal: 10, cpuRender: 5, cpuUI: 2, cpuJS: 3, ram: 100 }
    ];
    const reactCommits = [];
    const result = detectBottlenecks(flashlightMeasures, reactCommits);
    expect(result.length).toBe(0);
  });

  test('should detect bottleneck on FPS drop and CPU warning', () => {
    const flashlightMeasures = [
      { time: 1000, fps: 30, cpuTotal: 60, cpuRender: 5, cpuUI: 2, cpuJS: 3, ram: 100 } // fps < 45 (critical), cpuTotal > 50 (warning)
    ];
    const reactCommits = [];
    const result = detectBottlenecks(flashlightMeasures, reactCommits);
    expect(result.length).toBe(1);
    expect(result[0].fps).toBe(30);
    expect(result[0].issues).toContain('Critical FPS drop (30 FPS)');
    expect(result[0].issues).toContain('High CPU usage (60%)');
    expect(result[0].severity).toBeGreaterThan(0.5);
  });

  test('should include correlated candidates', () => {
    const flashlightMeasures = [
      { time: 1000, fps: 30, cpuTotal: 80, cpuRender: 5, cpuUI: 2, cpuJS: 30, ram: 100 }
    ];
    const reactCommits = [
      {
        timestamp: 1000,
        duration: 50,
        components: [{ name: 'SlowComponent', duration: 45 }]
      }
    ];

    const result = detectBottlenecks(flashlightMeasures, reactCommits);
    expect(result.length).toBe(1);
    expect(result[0].candidates.length).toBeGreaterThan(0);
    expect(result[0].candidates[0].component).toBe('SlowComponent');
  });
});
