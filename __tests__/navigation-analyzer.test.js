const { NavigationAnalyzer } = require('../analyzers/navigation-analyzer');

describe('navigation-analyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new NavigationAnalyzer();
  });

  test('should detect transitions and use real Flashlight avgFPS', () => {
    const componentRenderMap = new Map([
      ['HomeScreen', [
        { timestamp: 1000, duration: 20, reason: { isFirstMount: true } }
      ]]
    ]);

    const reactCommits = [
      { timestamp: 900, duration: 40 },
      { timestamp: 1100, duration: 30 }
    ];

    const flashlightMeasures = [
      { time: 600, fps: 50 },
      { time: 800, fps: 55 },
      { time: 1000, fps: 58 },
      { time: 1200, fps: 60 }
    ];

    const result = analyzer.analyze(componentRenderMap, reactCommits, flashlightMeasures);
    expect(result.length).toBe(1);
    expect(result[0].toScreen).toBe('HomeScreen');
    expect(result[0].commitCount).toBe(2);
    expect(parseFloat(result[0].totalDuration)).toBe(70.0); // 40 + 30
    expect(result[0].avgFPS).toBe(56); // avg of measures in [500, 1500] (600, 800, 1000, 1200) -> (50+55+58+60)/4 = 55.75 -> round to 56
    expect(result[0].severity).toBe('warning'); // >50ms is warning
  });
});
