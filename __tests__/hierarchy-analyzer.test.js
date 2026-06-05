const { buildComponentHierarchy, detectContextCascades, buildHierarchyTree } = require('../analyzers/hierarchy-analyzer');

describe('hierarchy-analyzer', () => {
  test('should detect cascading re-renders (>70% threshold)', () => {
    const componentRenderMap = new Map([
      ['Parent', [
        { timestamp: 100, duration: 5 },
        { timestamp: 200, duration: 5 },
        { timestamp: 300, duration: 5 },
        { timestamp: 400, duration: 5 }
      ]],
      ['Child', [
        { timestamp: 105, duration: 2 }, // cascade
        { timestamp: 205, duration: 2 }, // cascade
        { timestamp: 305, duration: 2 }, // cascade
        { timestamp: 500, duration: 2 }  // independent
      ]]
    ]);

    const fiberHierarchy = new Map([
      [1, { id: 1, name: 'Parent', parentId: 0, children: [2] }],
      [2, { id: 2, name: 'Child', parentId: 1, children: [] }]
    ]);

    // Add fiberId to renders
    componentRenderMap.get('Parent').forEach(r => r.fiberId = 1);
    componentRenderMap.get('Child').forEach(r => r.fiberId = 2);

    const result = buildComponentHierarchy(componentRenderMap, fiberHierarchy);
    expect(result.length).toBe(1);
    expect(result[0].parent).toBe('Parent');
    expect(result[0].child).toBe('Child');
    expect(parseFloat(result[0].cascadePercentage)).toBe(75.0); // 3 out of 4 is 75%
  });

  test('should detect context cascades (>5 components in 50ms bucket)', () => {
    const componentRenderMap = new Map();
    for (let i = 1; i <= 6; i++) {
      componentRenderMap.set(`Comp${i}`, [
        { timestamp: 100, duration: 5, reason: { context: true } }
      ]);
    }

    const result = detectContextCascades(componentRenderMap);
    expect(result.length).toBe(1);
    expect(result[0].affectedCount).toBe(6);
    expect(result[0].sources).toContain('unknown-context');
  });

  test('should build hierarchy tree and prevent infinite recursion', () => {
    const componentRenderMap = new Map([
      ['Root', [{ timestamp: 100, duration: 10 }]],
      ['Child', [{ timestamp: 100, duration: 5 }]]
    ]);
    componentRenderMap.get('Root')[0].fiberId = 1;
    componentRenderMap.get('Child')[0].fiberId = 2;

    const fiberHierarchy = new Map([
      [1, { id: 1, name: 'Root', parentId: 0, children: [2] }],
      [2, { id: 2, name: 'Child', parentId: 1, children: [1] }] // Introduces cycle
    ]);

    const result = buildHierarchyTree(componentRenderMap, fiberHierarchy);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Root');
    // Child should be filtered out when visited or depth-guarded
    expect(result[0].children.length).toBe(1);
    expect(result[0].children[0].children.length).toBe(0);
  });
});
