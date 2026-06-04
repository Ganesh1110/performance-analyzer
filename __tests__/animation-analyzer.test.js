const { AnimationAnalyzer } = require('../analyzers/animation-analyzer');

describe('AnimationAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new AnimationAnalyzer();
  });

  test('detectAnimations should identify smooth animation', () => {
    const componentRenderMap = new Map([
      ['Slider', [
        { timestamp: 100 }, { timestamp: 116 }, { timestamp: 132 }, { timestamp: 148 }, { timestamp: 164 }
      ]]
    ]);
    const flashlightMeasures = [
      { time: 100, fps: 60 }, { time: 120, fps: 60 }, { time: 140, fps: 60 }, { time: 160, fps: 60 }
    ];

    const animations = analyzer.detectAnimations(componentRenderMap, flashlightMeasures);
    
    expect(animations.length).toBe(1);
    expect(animations[0].component).toBe('Slider');
    expect(animations[0].smooth).toBe(true);
  });

  test('detectAnimations should flag janky animation', () => {
    const componentRenderMap = new Map([
      ['Slider', [
        { timestamp: 100 }, { timestamp: 116 }, { timestamp: 132 }, { timestamp: 148 }, { timestamp: 164 }
      ]]
    ]);
    const flashlightMeasures = [
      { time: 100, fps: 30 }, { time: 120, fps: 30 }
    ];

    const animations = analyzer.detectAnimations(componentRenderMap, flashlightMeasures);
    expect(animations[0].smooth).toBe(false);
    expect(animations[0].recommendation).toContain('CRITICAL');
  });
});
