class FlowTracker {
  constructor() {
    // Define critical flows. Easily extensible by users.
    this.flows = {
      'app-launch': {
        start: 'AppContainer',
        end: 'HomeScreen',
        budget: { duration: 2000, fps: 58 }
      },
      'product-view': {
        start: 'ProductList',
        end: 'ProductDetail',
        budget: { duration: 300, fps: 60 }
      },
      'checkout': {
        start: 'CartScreen',
        end: 'CheckoutSuccess',
        budget: { duration: 1000, fps: 55 }
      }
    };
  }

  detectFlows(componentRenderMap, flashlightMeasures) {
    const detectedFlows = [];

    Object.entries(this.flows).forEach(([flowName, flowDef]) => {
      const startRenders = componentRenderMap.get(flowDef.start) || [];
      const endRenders = componentRenderMap.get(flowDef.end) || [];

      // Match start->end pairs by proximity
      startRenders.forEach(start => {
        const matchingEnd = endRenders.find(end => 
          end.timestamp > start.timestamp &&
          end.timestamp - start.timestamp < flowDef.budget.duration * 2
        );

        if (matchingEnd) {
          const duration = matchingEnd.timestamp - start.timestamp;
          
          // Calculate FPS within this flow window
          const flowFrames = flashlightMeasures.filter(m => m.time >= start.timestamp && m.time <= matchingEnd.timestamp);
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
