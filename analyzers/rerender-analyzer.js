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
    
    // Attribution Analysis
    let wastedRenders = 0;
    const propChangeCounts = {};
    const stateChangeCounts = {};
    let contextChangeCount = 0;
    let parentTriggeredCount = 0;

    renders.forEach(render => {
      const { reason } = render;
      if (!reason || reason.isFirstMount) return;

      const hasPropChanges = reason.props && reason.props.length > 0;
      const hasStateChanges = reason.state && reason.state.length > 0;
      const hasContextChanges = reason.context === true || (Array.isArray(reason.context) && reason.context.length > 0);
      const hasHookChanges = reason.hooks && reason.hooks.length > 0;

      if (!hasPropChanges && !hasStateChanges && !hasContextChanges && !hasHookChanges) {
        wastedRenders++;
        parentTriggeredCount++;
      }

      if (hasPropChanges) {
        reason.props.forEach(prop => {
          propChangeCounts[prop] = (propChangeCounts[prop] || 0) + 1;
        });
      }
      if (hasStateChanges) {
        reason.state.forEach(s => {
          stateChangeCounts[s] = (stateChangeCounts[s] || 0) + 1;
        });
      }
      if (hasContextChanges) contextChangeCount++;
    });

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

    if (wastedRenders > 0) {
      const wastedPercent = ((wastedRenders / renders.length) * 100).toFixed(0);
      issues.push(`${wastedRenders} wasted renders (${wastedPercent}%) - rendered because parent rendered`);
      severity += (wastedRenders / renders.length) * 0.5;
    }

    // Identify unstable props
    const unstableProps = Object.entries(propChangeCounts)
      .filter(([prop, count]) => count > renders.length * 0.8)
      .map(([prop]) => prop);
    
    if (unstableProps.length > 0) {
      issues.push(`Unstable props detected: ${unstableProps.join(', ')} (changes in ${((Object.values(propChangeCounts)[0] / renders.length) * 100).toFixed(0)}% of renders)`);
    }
    
    if (issues.length > 0) {
      reRenderIssues.push({
        component: componentName,
        renderCount: renders.length,
        wastedRenders,
        parentTriggeredCount,
        contextChangeCount,
        propChangeCounts,
        stateChangeCounts,
        unstableProps,
        frequency: frequency.toFixed(2),
        avgInterval: Math.round(avgInterval),
        avgRenderTime: avgRenderTime.toFixed(2),
        totalTimeSpent: renders.reduce((sum, r) => sum + r.duration, 0).toFixed(2),
        issues,
        severity: Math.min(severity, 1.0),
        renders,
        timeline: renders.map(r => ({
          timestamp: Math.round(r.timestamp),
          duration: r.duration.toFixed(2),
          reason: r.reason
        }))
      });
    }
  });
  
  const sorted = reRenderIssues.sort((a, b) => b.severity - a.severity);
  
  console.log(`   ✓ Found ${sorted.length} components with re-render issues`);
  
  return sorted;
}

module.exports = { analyzeReRenders };
