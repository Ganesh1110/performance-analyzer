const CONFIG = require('../config');

class FlatListAnalyzer {
  constructor() {
    this.listSignatures = ['FlatList', 'VirtualizedList', 'SectionList'];
  }

  analyze(componentRenderMap, fiberHierarchy) {
    console.log("📋 Analyzing FlatList and virtualization performance...");
    
    const listIssues = [];
    
    componentRenderMap.forEach((renders, componentName) => {
      const matchingSig = this.listSignatures.find(sig => componentName.includes(sig));
      
      if (matchingSig) {
        const avgRenderTime = renders.reduce((sum, r) => sum + r.duration, 0) / renders.length;
        
        // Check for common List issues
        const issues = [];
        let severity = 0;

        // 1. High render frequency
        if (renders.length > 20) {
          issues.push(`High render count (${renders.length}). Lists should only re-render when data or critical props change.`);
          severity += 0.3;
        }

        // 2. Expensive rendering
        if (avgRenderTime > 20) {
          issues.push(`Expensive list rendering (Avg: ${avgRenderTime.toFixed(2)}ms). Check if you're doing heavy work in renderItem.`);
          severity += 0.4;
        }

        // 3. Wasted renders (from Phase 1 data)
        const wastedRenders = renders.filter(r => {
          const reason = r.reason;
          if (!reason) return false;
          return !reason.props?.length && !reason.state?.length && !reason.context;
        }).length;

        if (wastedRenders > renders.length * 0.5) {
          issues.push(`${wastedRenders} wasted renders detected. List rendered purely because parent rendered.`);
          severity += 0.3;
        }

        if (issues.length > 0) {
          listIssues.push({
            component: componentName,
            type: matchingSig,
            renderCount: renders.length,
            avgRenderTime: avgRenderTime.toFixed(2),
            wastedRenders,
            issues,
            severity: Math.min(severity, 1.0)
          });
        }
      }
    });

    console.log(`   ✓ Identified ${listIssues.length} List-specific issues`);
    return listIssues;
  }
}

module.exports = { FlatListAnalyzer };
