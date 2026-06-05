const { generateComparisonReport, generateComparisonTextReport } = require('../reporters/comparison-reporter');

describe('comparison-reporter', () => {
  test('should generate comparison report and detect regression and improvement', () => {
    const baseline = {
      flashlightStats: {
        fps: { avg: 55, p95: 50, p99: 45 },
        cpu: { avg: 40, p95: 60, p99: 70 }
      },
      bottleneckCount: 2,
      reRenderIssueCount: 5
    };

    const current = {
      summary: {
        totalFrames: 100,
        bottleneckCount: 4,
        reRenderIssueCount: 2
      },
      flashlightStats: {
        fps: { avg: 50, p95: 45, p99: 40 }, // regressed
        cpu: { avg: 35, p95: 55, p99: 65 }  // improved
      },
      bottleneckCount: 4,      // regressed
      reRenderIssueCount: 2    // improved
    };

    const result = generateComparisonReport(baseline, current);
    expect(result.summary.improved).toBe(2); // cpu, reRenders
    expect(result.summary.regressed).toBe(2); // fps, bottlenecks
    expect(result.regressions.some(r => r.metric === 'Frame Drops')).toBe(true);
    expect(result.regressions.some(r => r.metric === 'Average FPS')).toBe(true);

    const reportText = generateComparisonTextReport(result);
    expect(reportText).toContain('PERFORMANCE COMPARISON REPORT');
    expect(reportText).toContain('Improved Metrics:  2');
    expect(reportText).toContain('Regressed Metrics: 2');
  });
});
