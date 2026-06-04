const CONFIG = require('../config');
const { detectTrend } = require('../utils/stats');

function analyzeMemory(flashlightMeasures, componentRenderMap) {
  console.log("💾 Analyzing memory usage and potential leaks...");
  
  // Build memory timeline
  const memoryTimeline = flashlightMeasures.map(m => ({
    timestamp: m.time,
    value: m.ram,
    delta: 0
  }));
  
  // Calculate deltas
  for (let i = 1; i < memoryTimeline.length; i++) {
    memoryTimeline[i].delta = memoryTimeline[i].value - memoryTimeline[i - 1].value;
  }
  
  const memoryValues = memoryTimeline.map(m => m.value);
  const trend = detectTrend(memoryValues);
  
  // Detect memory spikes
  const spikes = [];
  const avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
  const threshold = CONFIG.thresholds.memory.warning;
  
  memoryTimeline.forEach((point, index) => {
    if (point.value > threshold || point.delta > 20) { // 20MB sudden increase
      spikes.push({
        timestamp: point.timestamp,
        value: point.value,
        delta: point.delta,
        severity: point.value > CONFIG.thresholds.memory.critical ? 'critical' : 'warning'
      });
    }
  });
  
  // Detect potential memory leaks
  const leaks = [];
  const windowSize = Math.min(50, Math.floor(memoryTimeline.length / 4));
  
  for (let i = windowSize; i < memoryTimeline.length - windowSize; i += windowSize) {
    const earlyWindow = memoryTimeline.slice(i - windowSize, i);
    const lateWindow = memoryTimeline.slice(i, i + windowSize);
    
    const earlyAvg = earlyWindow.reduce((sum, m) => sum + m.value, 0) / windowSize;
    const lateAvg = lateWindow.reduce((sum, m) => sum + m.value, 0) / windowSize;
    
    const growth = lateAvg - earlyAvg;
    
    if (growth > CONFIG.thresholds.memory.leakThreshold) {
      // Try to correlate with component activity
      const activeComponents = new Map();
      
      componentRenderMap.forEach((renders, componentName) => {
        const rendersInWindow = renders.filter(r => 
          r.timestamp >= earlyWindow[0].timestamp && 
          r.timestamp <= lateWindow[lateWindow.length - 1].timestamp
        );
        
        if (rendersInWindow.length > 0) {
          activeComponents.set(componentName, rendersInWindow.length);
        }
      });
      
      const suspectComponents = Array.from(activeComponents.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, renderCount: count }));
      
      leaks.push({
        timeRange: {
          start: Math.round(earlyWindow[0].timestamp),
          end: Math.round(lateWindow[lateWindow.length - 1].timestamp)
        },
        memoryGrowth: Math.round(growth),
        earlyAvg: Math.round(earlyAvg),
        lateAvg: Math.round(lateAvg),
        suspectComponents
      });
    }
  }
  
  console.log(`   ✓ Memory trend: ${trend}`);
  console.log(`   ✓ Found ${spikes.length} memory spikes`);
  console.log(`   ✓ Detected ${leaks.length} potential memory leaks`);
  
  return {
    timeline: memoryTimeline,
    trend,
    avgMemory: Math.round(avgMemory),
    maxMemory: Math.max(...memoryValues),
    minMemory: Math.min(...memoryValues),
    spikes,
    leaks
  };
}

module.exports = { analyzeMemory };
