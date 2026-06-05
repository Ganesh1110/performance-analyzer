const { BudgetEnforcer } = require('../analyzers/performance-budgets');

describe('BudgetEnforcer', () => {
  let budgetEnforcer;

  beforeEach(() => {
    budgetEnforcer = new BudgetEnforcer();
  });

  test('evaluate should pass when data is within budgets', () => {
    const analysisData = {
      summary: { healthScore: 90 },
      flashlightStats: { fps: { avg: 60 } },
      bottlenecks: [],
      memoryAnalysis: { leaks: [] },
      reRenderIssues: []
    };

    const result = budgetEnforcer.evaluate(analysisData);
    expect(result.passed).toBe(true);
    expect(result.violations.length).toBe(0);
  });

  test('evaluate should catch global healthScore violation', () => {
    const analysisData = {
      summary: { healthScore: 70 },
      flashlightStats: { fps: { avg: 60 } },
      bottlenecks: [],
      memoryAnalysis: { leaks: [] },
      reRenderIssues: []
    };

    const result = budgetEnforcer.evaluate(analysisData);
    expect(result.passed).toBe(false);
    expect(result.blockers[0].metric).toBe('healthScore');
  });

  test('evaluate should catch component renderTime violation', () => {
    const analysisData = {
      summary: { healthScore: 90 },
      flashlightStats: { fps: { avg: 60 } },
      bottlenecks: [],
      memoryAnalysis: { leaks: [] },
      reRenderIssues: [
        { component: 'ProductCard', avgRenderTime: '15.5' } // budget is 8
      ]
    };

    const result = budgetEnforcer.evaluate(analysisData);
    expect(result.violations.some(v => v.type === 'COMPONENT' && v.component === 'ProductCard')).toBe(true);
  });

  test('evaluate should catch perScreen transitionDuration violation', () => {
    const analysisData = {
      summary: { healthScore: 90 },
      flashlightStats: { fps: { avg: 60 } },
      bottlenecks: [],
      memoryAnalysis: { leaks: [] },
      reRenderIssues: [],
      navigationAnalysis: [
        { toScreen: 'Home', totalDuration: '250.0' } // budget Home transitionDuration max is 200
      ]
    };

    const result = budgetEnforcer.evaluate(analysisData);
    expect(result.violations.some(v => v.type === 'SCREEN' && v.screen === 'Home' && v.metric === 'transitionDuration')).toBe(true);
  });

  test('evaluate should catch bundleSize violation', () => {
    const analysisData = {
      summary: { healthScore: 90 },
      flashlightStats: { fps: { avg: 60 } },
      bottlenecks: [],
      memoryAnalysis: { leaks: [] },
      reRenderIssues: [],
      bundleAnalysis: {
        totalSizeKB: '6000.0', // budget totalKB max is 5000
        largeComponents: [
          { component: 'ProductCard', sizeKB: '60.0' } // budget ProductCard bundleSize max is 50
        ]
      }
    };

    const result = budgetEnforcer.evaluate(analysisData);
    expect(result.violations.some(v => v.type === 'BUNDLE' && v.metric === 'totalSizeKB')).toBe(true);
    expect(result.violations.some(v => v.type === 'COMPONENT' && v.component === 'ProductCard' && v.metric === 'bundleSize')).toBe(true);
  });

  test('generateReport should contain failure message when budget fails', () => {
    const budgetResult = {
      passed: false,
      blockers: [{ metric: 'healthScore', actual: 70, budget: 80, blocker: true }],
      violations: [{ metric: 'healthScore', actual: 70, budget: 80, blocker: true }]
    };

    const report = budgetEnforcer.generateReport(budgetResult);
    expect(report).toContain('BUDGET VIOLATIONS DETECTED');
    expect(report).toContain('healthScore');
  });

  test('generateBadge should return an SVG string', () => {
    const budgetResult = { passed: true, violations: [] };
    const badge = budgetEnforcer.generateBadge(budgetResult);
    expect(badge).toContain('<svg');
    expect(badge).toContain('PASSED');
    
    const failResult = { passed: false, violations: [{}] };
    const failBadge = budgetEnforcer.generateBadge(failResult);
    expect(failBadge).toContain('FAILED');
    expect(failBadge).toContain('#ef4444'); // Red color
  });
});
