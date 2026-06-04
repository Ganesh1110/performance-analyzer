const CONFIG = require('../config');

class NavigationAnalyzer {
  constructor() {
    this.screenSignatures = ['Screen', 'Navigator', 'Route', 'Tab'];
  }

  analyze(componentRenderMap, reactCommits) {
    console.log("🚦 Analyzing navigation transitions...");
    
    const transitions = [];
    const screenMounts = [];

    // 1. Detect Screen Mounts
    componentRenderMap.forEach((renders, componentName) => {
      const isScreen = this.screenSignatures.some(sig => componentName.includes(sig));
      if (!isScreen) return;

      renders.forEach(render => {
        if (render.reason && render.reason.isFirstMount) {
          screenMounts.push({
            name: componentName,
            timestamp: render.timestamp,
            duration: render.duration
          });
        }
      });
    });

    // 2. Correlate Mounts with Commit Spikes
    screenMounts.sort((a, b) => a.timestamp - b.timestamp).forEach(mount => {
      // Find the "navigation cycle" - commits within 500ms of the mount
      const cycleCommits = reactCommits.filter(c => 
        Math.abs(c.timestamp - mount.timestamp) < 500
      );

      if (cycleCommits.length > 0) {
        const totalDuration = cycleCommits.reduce((sum, c) => sum + c.duration, 0);
        const avgFPS = cycleCommits.length > 0 ? (60 * (cycleCommits.length / (totalDuration / 16.6))).toFixed(1) : 60; // Simplified FPS estimation

        transitions.push({
          toScreen: mount.name,
          timestamp: mount.timestamp,
          commitCount: cycleCommits.length,
          totalDuration: totalDuration.toFixed(2),
          avgCommitDuration: (totalDuration / cycleCommits.length).toFixed(2),
          severity: totalDuration > 100 ? 'critical' : totalDuration > 50 ? 'warning' : 'good',
          impact: totalDuration > 100 ? 'Heavy transition - may cause visible lag' : 'Normal transition'
        });
      }
    });

    console.log(`   ✓ Identified ${transitions.length} screen transitions`);
    return transitions;
  }
}

module.exports = { NavigationAnalyzer };
