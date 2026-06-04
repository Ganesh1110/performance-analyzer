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

  test('generateReport should contain failure message when budget fails', () => {
    const budgetResult = {
      passed: false,
      blockers: [{ metric: 'healthScore', actual: 70, budget: 80 }],
      violations: []
    };

    const report = budgetEnforcer.generateReport(budgetResult);
    expect(report).toContain('BUDGET VIOLATIONS DETECTED');
    expect(report).toContain('healthScore');
  });
});
