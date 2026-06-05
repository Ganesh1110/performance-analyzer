const CONFIG = require('../config');

class JSThreadAnalyzer {
  constructor() {
    // Threshold read from config.js — change CONFIG.thresholds.cpu.jsThreadCritical to override
    this.jsThreadThreshold = CONFIG.thresholds.cpu.jsThreadCritical || 70;
  }

  analyze(flashlightMeasures, reactCommits) {
    console.log("🧵 Analyzing JS Thread usage...");
    
    const jsBottlenecks = [];
    
    flashlightMeasures.forEach(m => {
      if (m.cpuJS > this.jsThreadThreshold) {
        // Check if React was committed during this time
        // Flashlight measures are roughly every 500ms in some configs, or more frequent.
        // We look for any commit within a small window.
        const commitDuringSpike = reactCommits.find(c => 
          Math.abs(c.timestamp - m.time) < 100 // 100ms window
        );

        jsBottlenecks.push({
          timestamp: m.time,
          jsUsage: m.cpuJS,
          type: commitDuringSpike ? 'REACT_WORK' : 'BUSINESS_LOGIC',
          details: commitDuringSpike 
            ? `Heavy React render cycle (${commitDuringSpike.duration.toFixed(2)}ms)`
            : 'Non-React JS work (JSON parsing, data transformation, or heavy business logic)',
          severity: m.cpuJS > 90 ? 'critical' : 'warning'
        });
      }
    });

    // Group consecutive spikes
    const groupedBottlenecks = this.groupConsecutiveSpikes(jsBottlenecks);

    console.log(`   ✓ Identified ${groupedBottlenecks.length} JS thread bottlenecks`);
    return groupedBottlenecks;
  }

  groupConsecutiveSpikes(spikes) {
    if (spikes.length === 0) return [];
    
    const groups = [];
    let currentGroup = {
      startTime: spikes[0].timestamp,
      endTime: spikes[0].timestamp,
      maxUsage: spikes[0].jsUsage,
      types: new Set([spikes[0].type]),
      details: spikes[0].details,
      severity: spikes[0].severity
    };

    for (let i = 1; i < spikes.length; i++) {
      const s = spikes[i];
      if (s.timestamp - currentGroup.endTime < 1000) { // 1 second threshold for "consecutive"
        currentGroup.endTime = s.timestamp;
        currentGroup.maxUsage = Math.max(currentGroup.maxUsage, s.jsUsage);
        currentGroup.types.add(s.type);
        if (s.severity === 'critical') currentGroup.severity = 'critical';
      } else {
        groups.push(this.finalizeGroup(currentGroup));
        currentGroup = {
          startTime: s.timestamp,
          endTime: s.timestamp,
          maxUsage: s.jsUsage,
          types: new Set([s.type]),
          details: s.details,
          severity: s.severity
        };
      }
    }
    groups.push(this.finalizeGroup(currentGroup));
    return groups;
  }

  finalizeGroup(group) {
    const duration = group.endTime - group.startTime;
    const type = group.types.has('BUSINESS_LOGIC') ? 'Non-React JS Work' : 'React Commits';
    return {
      timestamp: group.startTime,
      duration: Math.round(duration),
      maxUsage: Math.round(group.maxUsage),
      type,
      details: `${type} blocking JS thread for ${Math.round(duration)}ms (Peak: ${Math.round(group.maxUsage)}%)`,
      severity: group.severity
    };
  }
}

module.exports = { JSThreadAnalyzer };
