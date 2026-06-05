const CONFIG = require('../config');

class NavigationAnalyzer {
  constructor() {
    this.screenSignatures = ['Screen', 'Navigator', 'Route', 'Tab'];
  }

  /**
   * @param {Map} componentRenderMap - component name → render array
   * @param {Array} reactCommits - parsed React DevTools commit data
   * @param {Array} flashlightMeasures - native frame metrics from Flashlight (optional)
   */
  analyze(componentRenderMap, reactCommits, flashlightMeasures = []) {
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

        // Compute real avgFPS from Flashlight frames in the transition window
        const windowStart  = mount.timestamp - 500;
        const windowEnd    = mount.timestamp + 500;
        const windowFrames = flashlightMeasures.filter(m => m.time >= windowStart && m.time <= windowEnd);
        const avgFPS = windowFrames.length > 0
          ? Math.round(windowFrames.reduce((s, m) => s + m.fps, 0) / windowFrames.length)
          : null; // null = no native frame data available in this window

        transitions.push({
          toScreen: mount.name,
          timestamp: mount.timestamp,
          commitCount: cycleCommits.length,
          totalDuration: totalDuration.toFixed(2),
          avgCommitDuration: (totalDuration / cycleCommits.length).toFixed(2),
          avgFPS,
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
