const { FlowTracker } = require('../analyzers/flow-tracker');

describe('FlowTracker', () => {
  let flowTracker;

  beforeEach(() => {
    flowTracker = new FlowTracker();
  });

  test('detectFlows should identify a successful flow', () => {
    const componentRenderMap = new Map([
      ['AppContainer', [{ timestamp: 100 }]],
      ['HomeScreen', [{ timestamp: 500 }]]
    ]);
    const flashlightMeasures = [
      { time: 100, fps: 60 },
      { time: 300, fps: 60 },
      { time: 500, fps: 60 }
    ];

    const flows = flowTracker.detectFlows(componentRenderMap, flashlightMeasures);
    
    expect(flows.length).toBe(1);
    expect(flows[0].name).toBe('app-launch');
    expect(flows[0].duration).toBe(400);
    expect(flows[0].passed).toBe(true);
  });

  test('detectFlows should fail if duration exceeds budget', () => {
    const componentRenderMap = new Map([
      ['AppContainer', [{ timestamp: 100 }]],
      ['HomeScreen', [{ timestamp: 2500 }]] // budget is 2000
    ]);
    const flashlightMeasures = [];

    const flows = flowTracker.detectFlows(componentRenderMap, flashlightMeasures);
    
    expect(flows[0].passed).toBe(false);
  });

  test('detectFlows should handle missing start or end components', () => {
    const componentRenderMap = new Map([
      ['AppContainer', [{ timestamp: 100 }]]
      // HomeScreen missing
    ]);
    
    const flows = flowTracker.detectFlows(componentRenderMap, []);
    expect(flows.length).toBe(0);
  });
});
