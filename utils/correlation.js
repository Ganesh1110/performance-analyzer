const CONFIG = require('../config');

function findMatchingCommits(frameTime, reactCommits) {
  const { pipelineDelay, searchWindowMs, minConfidence } = CONFIG.correlation;
  
  const targetTime = frameTime - pipelineDelay;
  
  const candidateCommits = reactCommits.filter(commit => {
    const distance = Math.abs(commit.timestamp - targetTime);
    return distance <= searchWindowMs;
  });
  
  if (candidateCommits.length === 0) {
    return [{
      component: null,
      confidence: 0,
      reason: "No React commits found in time window",
      recommendation: "Issue may be native-only (image loading, native module, etc.)"
    }];
  }
  
  const scored = candidateCommits.flatMap(commit => {
    return commit.components.map(comp => {
      const temporalDistance = Math.abs(commit.timestamp - targetTime);
      const proximityScore = Math.exp(-temporalDistance / 20);
      const costScore = Math.min(comp.duration / CONFIG.thresholds.renderTime.critical, 1);
      const confidence = (proximityScore * 0.6 + costScore * 0.4);
      
      return {
        component: comp.name,
        confidence,
        renderTime: comp.duration,
        commitTime: commit.timestamp,
        temporalDistance: Math.round(temporalDistance),
        details: `Rendered in ${comp.duration.toFixed(2)}ms, ${temporalDistance.toFixed(0)}ms before frame issue`
      };
    });
  });
  
  return scored
    .filter(s => s.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

function correlateMemoryWithComponents(memoryData, componentRenderMap) {
  const correlations = [];
  
  componentRenderMap.forEach((renders, componentName) => {
    const componentMemoryImpact = memoryData.filter(m => {
      return renders.some(r => 
        Math.abs(r.timestamp - m.timestamp) < 100
      );
    });
    
    if (componentMemoryImpact.length > 0) {
      const avgMemoryDelta = componentMemoryImpact.reduce((sum, m) => 
        sum + (m.delta || 0), 0
      ) / componentMemoryImpact.length;
      
      if (Math.abs(avgMemoryDelta) > 5) { // 5MB threshold
        correlations.push({
          component: componentName,
          avgMemoryDelta,
          occurrences: componentMemoryImpact.length
        });
      }
    }
  });
  
  return correlations.sort((a, b) => 
    Math.abs(b.avgMemoryDelta) - Math.abs(a.avgMemoryDelta)
  );
}

module.exports = {
  findMatchingCommits,
  correlateMemoryWithComponents
};
