const { PhaseAnalyzer } = require('../analyzers/phase-analyzer');

describe('PhaseAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new PhaseAnalyzer();
  });

  test('analyzeRenderPhases should break down render and commit time', () => {
    const reactCommits = [
      {
        timestamp: 1000,
        duration: 20,
        effectDuration: 5
      }
    ];

    const result = analyzer.analyzeRenderPhases(reactCommits);
    
    expect(result[0].renderPhase.duration).toBe("15.00");
    expect(result[0].commitPhase.duration).toBe("5.00");
    expect(result[0].renderPhase.expensive).toBe(true); // > 10ms
  });

  test('getPhaseRecommendation should identify slow effects', () => {
    const recommendation = analyzer.getPhaseRecommendation(5, 10);
    expect(recommendation).toContain('Commit phase (Effects) slow');
  });
});
