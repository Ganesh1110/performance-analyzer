const { analyzeReRenders } = require('../analyzers/rerender-analyzer');

describe('rerender-analyzer', () => {
  test('should detect wasted renders when no state, props, hooks, or context changes', () => {
    const componentRenderMap = new Map([
      ['MyComp', [
        { timestamp: 1000, duration: 5, reason: { isFirstMount: true } },
        { timestamp: 1200, duration: 4, reason: { isFirstMount: false, props: [], state: [], context: false, hooks: [] } },
        { timestamp: 1400, duration: 6, reason: { isFirstMount: false, props: [], state: [], context: false, hooks: [] } }
      ]]
    ]);

    const result = analyzeReRenders(componentRenderMap);
    expect(result.length).toBe(1);
    expect(result[0].wastedRenders).toBe(2);
    expect(result[0].primaryCause).toBe('Parent Re-render (Wasted)');
  });

  test('should detect context change attribution', () => {
    const componentRenderMap = new Map([
      ['MyComp', [
        { timestamp: 1000, duration: 5, reason: { isFirstMount: true } },
        { timestamp: 1200, duration: 4, reason: { isFirstMount: false, context: true } },
        { timestamp: 1400, duration: 6, reason: { isFirstMount: false, context: ['ThemeContext'] } }
      ]]
    ]);

    const result = analyzeReRenders(componentRenderMap);
    expect(result.length).toBe(1);
    expect(result[0].contextChangeCount).toBe(2);
    expect(result[0].primaryCause).toBe('Context Update');
  });

  test('should detect unstableProps using the 60% threshold', () => {
    const componentRenderMap = new Map([
      ['MyComp', [
        { timestamp: 1000, duration: 5, reason: { isFirstMount: true } },
        { timestamp: 1100, duration: 4, reason: { isFirstMount: false, props: ['unstableProp', 'anotherProp'] } },
        { timestamp: 1200, duration: 6, reason: { isFirstMount: false, props: ['unstableProp'] } }
      ]]
    ]);

    const result = analyzeReRenders(componentRenderMap);
    expect(result.length).toBe(1);
    // unstableProp is present in 2 out of 3 total renders (66.6% > 60%)
    // anotherProp is present in 1 out of 3 total renders (33.3% < 60%)
    expect(result[0].unstableProps).toContain('unstableProp');
    expect(result[0].unstableProps).not.toContain('anotherProp');
  });
});
