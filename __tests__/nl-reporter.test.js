const { NaturalLanguageReporter } = require('../reporters/nl-reporter');

describe('NaturalLanguageReporter', () => {
  let reporter;

  beforeEach(() => {
    reporter = new NaturalLanguageReporter();
  });

  test('generateExecutiveSummary should describe health and issues', () => {
    const analysisData = {
      summary: { healthScore: 60 },
      bottlenecks: [
        { candidates: [{ component: 'SlowComp', renderTime: 50 }] }
      ],
      reRenderIssues: [
        { component: 'RerenderComp', renderCount: 10, totalTimeSpent: 100 }
      ],
      memoryAnalysis: { leaks: [] },
      flows: []
    };

    const summary = reporter.generateExecutiveSummary(analysisData);
    
    expect(summary).toContain('significant performance issues');
    expect(summary).toContain('<SlowComp>');
    expect(summary).toContain('<RerenderComp>');
  });

  test('generateActionPlan should prioritize memory leaks', () => {
    const data = {
      memoryAnalysis: { leaks: [{}] },
      bottlenecks: [],
      reRenderIssues: [],
      flows: []
    };
    const plan = reporter.generateActionPlan(data);
    expect(plan).toContain('1. 🔴 Fix memory leaks');
  });
});
