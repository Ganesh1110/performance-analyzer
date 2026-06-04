const CONFIG = require('../config');
const { findMatchingCommits } = require('../utils/correlation');

function detectBottlenecks(flashlightMeasures, reactCommits) {
  console.log("🔍 Detecting performance bottlenecks...");
  
  const bottlenecks = [];
  
  flashlightMeasures.forEach((measure, index) => {
    const issues = [];
    let severity = 0;
    
    if (measure.fps < CONFIG.thresholds.fps.critical) {
      issues.push(`Critical FPS drop (${Math.round(measure.fps)} FPS)`);
      severity += 0.5;
    } else if (measure.fps < CONFIG.thresholds.fps.warning) {
      issues.push(`Low FPS (${Math.round(measure.fps)} FPS)`);
      severity += 0.3;
    }
    
    if (measure.cpuTotal > CONFIG.thresholds.cpu.critical) {
      issues.push(`Critical CPU usage (${Math.round(measure.cpuTotal)}%)`);
      severity += 0.3;
    } else if (measure.cpuTotal > CONFIG.thresholds.cpu.warning) {
      issues.push(`High CPU usage (${Math.round(measure.cpuTotal)}%)`);
      severity += 0.2;
    }
    
    if (measure.cpuRender > CONFIG.thresholds.renderThread.critical) {
      issues.push(`RenderThread overload (${Math.round(measure.cpuRender)}%)`);
      severity += 0.2;
    }
    
    if (issues.length === 0) return;
    
    // Cap severity at 1.0
    severity = Math.min(severity, 1.0);
    
    const candidates = findMatchingCommits(measure.time, reactCommits);
    
    bottlenecks.push({
      timestamp: measure.time,
      fps: Math.round(measure.fps),
      cpuTotal: Math.round(measure.cpuTotal),
      cpuRender: Math.round(measure.cpuRender),
      cpuUI: Math.round(measure.cpuUI),
      cpuJS: Math.round(measure.cpuJS),
      ram: measure.ram,
      issues,
      severity,
      candidates
    });
  });
  
  console.log(`   ✓ Detected ${bottlenecks.length} performance bottlenecks`);
  
  return bottlenecks.sort((a, b) => b.severity - a.severity);
}

module.exports = { detectBottlenecks };
