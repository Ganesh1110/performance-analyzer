const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const CONFIG = require('../config');

class PerformanceRecorder {
  constructor() {
    this.flashlightProcess = null;
    this.reactProfilerProcess = null;
  }

  async start(bundleId, durationMs = 30000) {
    console.log(`\n🎙️  Starting orchestrated performance recording (${durationMs}ms)...`);
    console.log(`   📦 Target Bundle: ${bundleId}`);

    const startTime = Date.now();

    try {
      // 1. Start Flashlight (Native Metrics)
      console.log('   🔦 Launching Flashlight...');
      this.flashlightProcess = spawn('flashlight', [
        'measure',
        '--bundleId', bundleId,
        '--duration', durationMs,
        '--output', CONFIG.files.flashlight
      ]);

      this.flashlightProcess.on('error', (err) => {
        console.warn('   ⚠️  Flashlight failed to start. Ensure it is installed: npm install -g @flashlight/cli');
      });

      // 2. Start React Profiler (via CLI helper or instructions)
      console.log('   ⚛️  Activating React Profiler...');
      // Note: Real automation of React DevTools requires the app to be in profiling mode.
      // We can trigger it via a deep link or custom broadcast if the app supports it.
      this.reactProfilerProcess = spawn('npx', [
        'react-devtools-core',
        'profile',
        '--output', CONFIG.files.reactProfile
      ]);

      console.log(`\n⏳ Recording in progress... Please interact with the app now.`);
      
      return new Promise((resolve) => {
        setTimeout(() => {
          this.stop();
          resolve({
            duration: Date.now() - startTime,
            files: [CONFIG.files.flashlight, CONFIG.files.reactProfile]
          });
        }, durationMs);
      });

    } catch (e) {
      console.error('   ❌ Orchestration failed:', e.message);
      this.stop();
    }
  }

  stop() {
    if (this.flashlightProcess) {
      this.flashlightProcess.kill();
      this.flashlightProcess = null;
    }
    if (this.reactProfilerProcess) {
      this.reactProfilerProcess.kill();
      this.reactProfilerProcess = null;
    }
    console.log('   🛑 Recording stopped.');
  }

  /**
   * Task 5.2: Auto-Alignment Calibration
   * Synchronizes timestamps between Native and React traces by finding 
   * correlated "spike" events.
   */
  calibrateAlignment(flashlightMeasures, reactCommits) {
    console.log('   ⚖️  Calibrating trace alignment...');
    
    if (flashlightMeasures.length === 0 || reactCommits.length === 0) return 0;

    // Find the first major "Startup Spike" in both traces
    // Flashlight: First frame drop below 40 FPS or high CPU
    const nativeSpike = flashlightMeasures.find(m => m.fps < 40 || m.cpuTotal > 80);
    
    // React: First commit with > 50ms duration (usually hydration/initial render)
    const reactSpike = reactCommits.find(c => c.duration > 50);

    if (nativeSpike && reactSpike) {
      const offset = nativeSpike.time - reactSpike.timestamp;
      console.log(`   ✅ Alignment calibrated! Offset: ${Math.round(offset)}ms`);
      return offset;
    }

    console.log('   ℹ️  No clear anchor point found. Using 0ms offset.');
    return 0;
  }
}

module.exports = { PerformanceRecorder };
