const { JSThreadAnalyzer } = require('../analyzers/js-thread-analyzer');

describe('js-thread-analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new JSThreadAnalyzer();
  });

  test('should detect REACT_WORK vs BUSINESS_LOGIC spikes and group consecutive ones', () => {
    const flashlightMeasures = [
      { time: 100, cpuJS: 80 }, // spike 1, react commit nearby (100ms) -> REACT_WORK
      { time: 150, cpuJS: 85 }, // spike 2, grouped with spike 1
      { time: 2000, cpuJS: 95 } // spike 3, no react commit nearby -> BUSINESS_LOGIC
    ];

    const reactCommits = [
      { timestamp: 120, duration: 10, components: [] }
    ];

    const result = analyzer.analyze(flashlightMeasures, reactCommits);
    expect(result.length).toBe(2);

    expect(result[0].timestamp).toBe(100);
    expect(result[0].maxUsage).toBe(85);
    expect(result[0].type).toBe('React Commits');
    expect(result[0].duration).toBe(50); // 150 - 100

    expect(result[1].timestamp).toBe(2000);
    expect(result[1].maxUsage).toBe(95);
    expect(result[1].type).toBe('Non-React JS Work');
    expect(result[1].severity).toBe('critical'); // >90 is critical
  });
});
