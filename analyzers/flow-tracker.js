const CONFIG = require('../config');

class FlowTracker {
  constructor() {
    // Flows are loaded from config.js — edit the 'flows' key there to add/remove/change flows
    this.flows = CONFIG.flows || {};
  }

  detectFlows(componentRenderMap, flashlightMeasures) {
    const detectedFlows = [];

    Object.entries(this.flows).forEach(([flowName, flowDef]) => {
      const startRenders = componentRenderMap.get(flowDef.start) || [];
      const endRenders   = componentRenderMap.get(flowDef.end)   || [];
      const usedEndTimestamps = new Set(); // Prevent one end-render from matching multiple starts

      // Match start→end pairs by proximity
      startRenders.forEach(start => {
        const matchingEnd = endRenders.find(end =>
          end.timestamp > start.timestamp &&
          end.timestamp - start.timestamp < flowDef.budget.duration * 2 &&
          !usedEndTimestamps.has(end.timestamp) // deduplication
        );

        if (matchingEnd) {
          usedEndTimestamps.add(matchingEnd.timestamp);
          const duration = matchingEnd.timestamp - start.timestamp;
          
          // Calculate FPS within this flow window
          const flowFrames = flashlightMeasures.filter(m =>
            m.time >= start.timestamp && m.time <= matchingEnd.timestamp
          );
          const avgFPS = flowFrames.length > 0 
            ? flowFrames.reduce((sum, m) => sum + m.fps, 0) / flowFrames.length 
            : 60; // default if no native frames found in tight window

          const passed = duration <= flowDef.budget.duration && avgFPS >= flowDef.budget.fps;

          detectedFlows.push({
            name: flowName,
            startTime: Math.round(start.timestamp),
            endTime: Math.round(matchingEnd.timestamp),
            duration: Math.round(duration),
            avgFPS: Math.round(avgFPS),
            budget: flowDef.budget,
            passed
          });
        }
      });
    });

    return detectedFlows;
  }
}

module.exports = { FlowTracker };
