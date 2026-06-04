const { SentryIntegration } = require('../analyzers/sentry-integration');

describe('SentryIntegration', () => {
  let sentry;

  test('exportToSentry should skip if DSN is missing', () => {
    sentry = new SentryIntegration(null);
    const result = sentry.exportToSentry({});
    expect(result).toBeUndefined();
  });

  test('exportToSentry should generate transactions and breadcrumbs', () => {
    sentry = new SentryIntegration('https://abc@sentry.io/123');
    const analysisData = {
      bottlenecks: [
        {
          timestamp: 1000,
          fps: 30,
          severity: 0.8,
          cpuTotal: 90,
          candidates: [{ component: 'SlowComp', confidence: 0.9, renderTime: 50 }]
        }
      ],
      memoryAnalysis: {
        leaks: [
          { memoryGrowth: 100, suspectComponents: [{ name: 'LeakyComp' }] }
        ]
      }
    };

    const issues = sentry.exportToSentry(analysisData);
    
    expect(issues.length).toBe(2);
    expect(issues[0].type).toBe('transaction');
    expect(issues[0].tags.component).toBe('SlowComp');
    expect(issues[1].type).toBe('breadcrumb');
    expect(issues[1].data.suspectComponents).toContain('LeakyComp');
  });
});
