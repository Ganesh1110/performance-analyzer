const { PerformancePredictionEngine } = require('../analyzers/prediction-engine');

describe('PerformancePredictionEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new PerformancePredictionEngine();
  });

  test('predictRenderTime should calculate based on weights', () => {
    const metrics = {
      stateVariables: 2, // 2 * 10 = 20
      childComponents: 5 // 5 * 2 = 10
    };
    // Base 1.0 + 20 + 10 = 31.0
    const predicted = engine.predictRenderTime(metrics);
    expect(predicted).toBe(31.0);
  });

  test('suggestOptimizations should identify high risk components', () => {
    const metrics = {
      stateVariables: 10,
      childComponents: 20
    };
    const result = engine.suggestOptimizations(metrics);
    
    expect(result.risk).toBe('HIGH');
    expect(result.suggestions.some(s => s.type === 'VIRTUALIZATION')).toBe(true);
    expect(result.suggestions.some(s => s.type === 'STATE_SPLITTING')).toBe(true);
  });
});
