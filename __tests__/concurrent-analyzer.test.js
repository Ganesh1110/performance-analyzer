const { ConcurrentAnalyzer } = require('../analyzers/concurrent-analyzer');

describe('ConcurrentAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ConcurrentAnalyzer();
  });

  test('analyzeConcurrentFeatures should detect transitions', () => {
    const reactCommits = [
      {
        timestamp: 1000,
        duration: 20,
        priorityLevel: 'Transition',
        components: [{ name: 'HeavyComponent' }],
        interruptedDuration: 5
      }
    ];

    const result = analyzer.analyzeConcurrentFeatures(reactCommits);
    
    expect(result.transitions.length).toBe(1);
    expect(result.transitions[0].components).toContain('HeavyComponent');
    expect(result.transitions[0].wasInterrupted).toBe(true);
  });

  test('analyzeConcurrentFeatures should detect interrupted renders', () => {
    const reactCommits = [
      {
        timestamp: 2000,
        duration: 10,
        interruptedDuration: 50, // More than 50% of duration
        components: [{ name: 'InterruptedComp' }]
      }
    ];

    const result = analyzer.analyzeConcurrentFeatures(reactCommits);
    
    expect(result.interruptedRenders.length).toBe(1);
    expect(result.interruptedRenders[0].efficiency).toBe("20.0"); // 10/50 * 100
  });
});
