const fs = require('fs');
const { BaselineManager } = require('../analyzers/baseline-manager');

jest.mock('fs');

describe('BaselineManager', () => {
  const storagePath = 'test-baselines.json';
  let baselineManager;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(false);
    baselineManager = new BaselineManager(storagePath);
  });

  test('loadBaselines should handle missing file', () => {
    expect(baselineManager.baselines.size).toBe(0);
  });

  test('loadBaselines should load data from existing file', () => {
    const mockData = {
      'Home': {
        timestamp: Date.now(),
        data: { healthScore: 90, bottleneckCount: 2, reRenderIssueCount: 5, memoryLeakCount: 0, jsBottleneckCount: 1, avgFPS: 60 },
        history: [
          { data: { healthScore: 90, bottleneckCount: 2, reRenderIssueCount: 5, memoryLeakCount: 0, jsBottleneckCount: 1, avgFPS: 60 } }
        ],
        runCount: 1
      }
    };
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(mockData));
    
    baselineManager.loadBaselines();
    expect(baselineManager.baselines.get('Home')).toEqual(mockData.Home);
  });

  test('saveBaseline should update baselines map and history', () => {
    const screen = 'Home';
    const reportData = {
      summary: { healthScore: 85, bottleneckCount: 3, reRenderIssueCount: 4, memoryLeakCount: 0, jsBottleneckCount: 2, avgFPS: 55 }
    };

    baselineManager.saveBaseline(screen, reportData);

    expect(baselineManager.baselines.has(screen)).toBe(true);
    const baseline = baselineManager.baselines.get(screen);
    expect(baseline.data).toEqual(reportData.summary);
    expect(baseline.history.length).toBe(1);
    expect(baseline.history[0].data).toEqual(reportData.summary);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  test('saveBaseline should limit history to 5 runs', () => {
    const screen = 'Home';
    for (let i = 0; i < 7; i++) {
      baselineManager.saveBaseline(screen, { summary: { healthScore: 90 + i, bottleneckCount: 0, reRenderIssueCount: 0, memoryLeakCount: 0, jsBottleneckCount: 0, avgFPS: 60 } });
    }

    const baseline = baselineManager.baselines.get(screen);
    expect(baseline.history.length).toBe(5);
    expect(baseline.history[0].data.healthScore).toBe(92); // 90, 91 shifted out
    expect(baseline.history[4].data.healthScore).toBe(96);
  });

  test('calculateAverageBaseline should return averaged metrics', () => {
    const history = [
      { data: { healthScore: 90, bottleneckCount: 2, reRenderIssueCount: 4, memoryLeakCount: 0, jsBottleneckCount: 2, avgFPS: 60 } },
      { data: { healthScore: 80, bottleneckCount: 4, reRenderIssueCount: 6, memoryLeakCount: 2, jsBottleneckCount: 4, avgFPS: 50 } }
    ];

    const avg = baselineManager.calculateAverageBaseline(history);
    expect(avg.healthScore).toBe(85);
    expect(avg.bottleneckCount).toBe(3);
    expect(avg.reRenderIssueCount).toBe(5);
    expect(avg.memoryLeakCount).toBe(1);
    expect(avg.jsBottleneckCount).toBe(3);
    expect(avg.avgFPS).toBe(55);
  });

  test('detectScreen should identify Home screen signature', () => {
    const componentRenderMap = new Map([
      ['HomeScreen', [1, 2, 3]],
      ['ProductList', [1, 2]],
      ['Header', [1]]
    ]);

    const screenName = baselineManager.detectScreen(componentRenderMap);
    expect(screenName).toBe('Home');
  });

  test('detectScreen should return generic name for unknown signature', () => {
    const componentRenderMap = new Map([
      ['UnknownComp', [1, 2, 3]]
    ]);

    const screenName = baselineManager.detectScreen(componentRenderMap);
    expect(screenName).toContain('Screen(UnknownComp...)');
  });

  test('compare should return isFirstRun if no baseline exists', () => {
    const result = baselineManager.compare('NonExistent', {});
    expect(result.isFirstRun).toBe(true);
  });

  test('generateSmartComparison should detect regression', () => {
    const baselineSummary = { healthScore: 90, bottleneckCount: 0, reRenderIssueCount: 0, memoryLeakCount: 0, jsBottleneckCount: 0, avgFPS: 60 };
    const currentSummary = { healthScore: 80, bottleneckCount: 5, reRenderIssueCount: 10, memoryLeakCount: 1, jsBottleneckCount: 2, avgFPS: 50 };

    const result = baselineManager.generateSmartComparison(baselineSummary, currentSummary);

    expect(result.regressed).toBe(6); // healthScore, bottleneckCount, reRenderIssueCount, memoryLeakCount, jsBottleneckCount, avgFPS all regressed
    expect(result.changes.healthScore.status).toBe('regressed');
  });

  test('generateSmartComparison should detect improvement', () => {
    const baselineSummary = { healthScore: 70, bottleneckCount: 10, reRenderIssueCount: 20, memoryLeakCount: 2, jsBottleneckCount: 5, avgFPS: 50 };
    const currentSummary = { healthScore: 85, bottleneckCount: 2, reRenderIssueCount: 5, memoryLeakCount: 0, jsBottleneckCount: 1, avgFPS: 58 };

    const result = baselineManager.generateSmartComparison(baselineSummary, currentSummary);

    expect(result.improved).toBe(6);
    expect(result.changes.healthScore.status).toBe('improved');
  });
});
