const { generateHTMLReport } = require('../reporters/html-reporter');

describe('html-reporter', () => {
  test('should generate an HTML report containing expected page elements', () => {
    const data = {
      flashlightMeasures: [
        { time: 100, fps: 60, cpuTotal: 10, ram: 100 },
        { time: 500, fps: 55, cpuTotal: 15, ram: 105 }
      ],
      bottlenecks: [],
      reRenderIssues: [],
      memoryAnalysis: {
        timeline: [
          { timestamp: 100, value: 100 },
          { timestamp: 500, value: 105 }
        ],
        avgMemory: 102,
        maxMemory: 105,
        minMemory: 100,
        trend: 'stable',
        spikes: [],
        leaks: []
      },
      hierarchyIssues: [],
      bundleAnalysis: null,
      hierarchyTree: [],
      concurrentAnalysis: {
        transitions: [],
        suspenseBoundaries: [],
        deferredUpdates: [],
        interruptedRenders: []
      },
      prediction: []
    };

    const result = generateHTMLReport(data);
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('Performance Analysis Report');
    expect(result).toContain('chart.umd.min.js');
    expect(result).toContain('Health Score');
  });
});
