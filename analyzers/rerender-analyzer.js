const CONFIG = require('../config');

function analyzeReRenders(componentRenderMap) {
  console.log("🔄 Analyzing component re-renders...");
  
  const reRenderIssues = [];
  
  componentRenderMap.forEach((renders, componentName) => {
    if (renders.length < 2) return;
    
    const timeSpan = renders[renders.length - 1].timestamp - renders[0].timestamp;
    const frequency = renders.length / (timeSpan / 1000);
    
    const intervals = [];
    for (let i = 1; i < renders.length; i++) {
      intervals.push(renders[i].timestamp - renders[i - 1].timestamp);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    const issues = [];
    let severity = 0;
    
    if (renders.length >= CONFIG.rerender.minCount) {
      issues.push(`Rendered ${renders.length} times in ${Math.round(timeSpan)}ms`);
      severity += 0.3;
    }
    
    if (avgInterval < CONFIG.rerender.minFrequency) {
      issues.push(`Renders every ${Math.round(avgInterval)}ms (very frequent)`);
      severity += 0.4;
    }
    
    const avgRenderTime = renders.reduce((sum, r) => sum + r.duration, 0) / renders.length;
    if (avgRenderTime > CONFIG.thresholds.renderTime.warning) {
      issues.push(`Average render time: ${avgRenderTime.toFixed(2)}ms (expensive)`);
      severity += 0.3;
    }
    
    if (issues.length > 0) {
      reRenderIssues.push({
        component: componentName,
        renderCount: renders.length,
        frequency: frequency.toFixed(2),
        avgInterval: Math.round(avgInterval),
        avgRenderTime: avgRenderTime.toFixed(2),
        totalTimeSpent: renders.reduce((sum, r) => sum + r.duration, 0).toFixed(2),
        issues,
        severity: Math.min(severity, 1.0),
        renders,
        timeline: renders.map(r => ({
          timestamp: Math.round(r.timestamp),
          duration: r.duration.toFixed(2)
        }))
      });
    }
  });
  
  const sorted = reRenderIssues.sort((a, b) => b.severity - a.severity);
  
  console.log(`   ✓ Found ${sorted.length} components with re-render issues`);
  
  return sorted;
}

module.exports = { analyzeReRenders };
