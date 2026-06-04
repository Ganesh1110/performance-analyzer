function buildComponentHierarchy(componentRenderMap, fiberHierarchy) {
  console.log("🌳 Building component hierarchy and parent-child relationships...");
  
  const hierarchyIssues = [];
  
  // Build component tree
  const componentTree = new Map();
  
  componentRenderMap.forEach((renders, componentName) => {
    if (renders.length === 0) return;
    
    const fiberId = renders[0].fiberId;
    const node = fiberHierarchy.get(fiberId);
    
    if (node && node.parentId) {
      const parentNode = fiberHierarchy.get(node.parentId);
      
      if (parentNode) {
        const key = `${parentNode.name} → ${componentName}`;
        
        if (!componentTree.has(key)) {
          componentTree.set(key, {
            parent: parentNode.name,
            child: componentName,
            parentRenders: [],
            childRenders: []
          });
        }
        
        const relationship = componentTree.get(key);
        relationship.childRenders = renders;
        
        // Find parent renders
        if (componentRenderMap.has(parentNode.name)) {
          relationship.parentRenders = componentRenderMap.get(parentNode.name);
        }
      }
    }
  });
  
  // Analyze cascading re-renders
  componentTree.forEach((relationship, key) => {
    const { parent, child, parentRenders, childRenders } = relationship;
    
    if (parentRenders.length === 0 || childRenders.length === 0) return;
    
    // Count how many child renders are triggered by parent
    let cascadingRenders = 0;
    
    childRenders.forEach(childRender => {
      const matchingParent = parentRenders.find(parentRender => 
        Math.abs(childRender.timestamp - parentRender.timestamp) < 30
      );
      
      if (matchingParent) {
        cascadingRenders++;
      }
    });
    
    const cascadePercentage = (cascadingRenders / childRenders.length) * 100;
    
    // If more than 70% of child renders are caused by parent, it's an issue
    if (cascadePercentage > 70 && childRenders.length > 3) {
      hierarchyIssues.push({
        parent,
        child,
        totalChildRenders: childRenders.length,
        cascadingRenders,
        cascadePercentage: cascadePercentage.toFixed(1),
        severity: cascadePercentage > 90 ? 'high' : 'medium',
        recommendation: `<${child}> re-renders ${cascadingRenders} times because <${parent}> re-renders. Consider React.memo() on child.`
      });
    }
  });
  
  const sorted = hierarchyIssues.sort((a, b) => 
    b.cascadingRenders - a.cascadingRenders
  );
  
  console.log(`   ✓ Identified ${sorted.length} parent-child re-render cascades`);
  
  return sorted;
}

function buildHierarchyTree(componentRenderMap, fiberHierarchy) {
  const roots = [];
  const visited = new Set();
  
  componentRenderMap.forEach((renders, componentName) => {
    if (renders.length === 0 || visited.has(componentName)) return;
    
    const fiberId = renders[0].fiberId;
    const node = fiberHierarchy.get(fiberId);
    
    if (!node) return;
    
    // Find root
    let current = node;
    while (current.parentId && fiberHierarchy.has(current.parentId)) {
      current = fiberHierarchy.get(current.parentId);
    }
    
    // Build tree from root
    function buildNode(nodeId, depth = 0) {
      if (depth > 10) return null; // Prevent infinite recursion
      
      const node = fiberHierarchy.get(nodeId);
      if (!node) return null;
      
      visited.add(node.name);
      
      const renders = componentRenderMap.get(node.name) || [];
      
      return {
        name: node.name,
        renderCount: renders.length,
        avgRenderTime: renders.length > 0
          ? (renders.reduce((sum, r) => sum + r.duration, 0) / renders.length).toFixed(2)
          : 0,
        children: node.children
          .map(childId => buildNode(childId, depth + 1))
          .filter(Boolean)
      };
    }
    
    const tree = buildNode(current.id);
    if (tree && !roots.find(r => r.name === tree.name)) {
      roots.push(tree);
    }
  });
  
  return roots;
}

module.exports = { buildComponentHierarchy, buildHierarchyTree };
