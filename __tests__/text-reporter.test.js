const { generateTextReport } = require('../reporters/text-reporter');

describe('text-reporter', () => {
  test('should generate a text report containing all expected sections', () => {
    const data = {
      flashlightMeasures: [
        { time: 100, fps: 60, cpuTotal: 10, ram: 100 },
        { time: 500, fps: 55, cpuTotal: 15, ram: 105 }
      ],
      bottlenecks: [
        { timestamp: 500, fps: 55, cpuTotal: 15, cpuRender: 5, cpuUI: 2, cpuJS: 3, ram: 105, issues: ['Low FPS (55 FPS)'], severity: 0.3, candidates: [] }
      ],
      reRenderIssues: [
        { component: 'ProductCard', renderCount: 5, frequency: '10.0', avgRenderTime: '8.00', totalTimeSpent: '40.00', issues: ['Renders frequently'], severity: 0.5 }
      ],
      memoryAnalysis: {
        avgMemory: 102,
        maxMemory: 105,
        minMemory: 100,
        trend: 'stable',
        spikes: [],
        leaks: []
      },
      hierarchyIssues: [],
      bundleAnalysis: {
        totalSizeKB: '150.00',
        largeComponents: [],
        correlationCoefficient: 0.1
      },
      concurrentAnalysis: {
        transitions: [],
        interruptedRenders: []
      },
      animations: [],
      executiveSummary: 'This is a test executive summary'
    };

    const result = generateTextReport(data);
    expect(result).toContain('REACT NATIVE PERFORMANCE ANALYSIS REPORT');
    expect(result).toContain('OVERALL HEALTH SCORE');
    expect(result).toContain('ProductCard');
    expect(result).toContain('This is a test executive summary');
  });
});
