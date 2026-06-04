class AnimationAnalyzer {
  detectAnimations(componentRenderMap, flashlightMeasures) {
    const animations = [];

    componentRenderMap.forEach((renders, componentName) => {
      const animationPeriods = this.findAnimationPeriods(renders);
      
      animationPeriods.forEach(period => {
        const frameMetrics = flashlightMeasures.filter(m =>
          m.time >= period.start && m.time <= period.end
        );

        if (frameMetrics.length === 0) return;

        const avgFPS = frameMetrics.reduce((sum, m) => sum + m.fps, 0) / frameMetrics.length;
        const droppedFrames = frameMetrics.filter(m => m.fps < 58).length;

        animations.push({
          component: componentName,
          start: Math.round(period.start),
          end: Math.round(period.end),
          duration: Math.round(period.end - period.start),
          frameCount: period.renders.length,
          avgFPS: Math.round(avgFPS),
          droppedFrames,
          smooth: avgFPS >= 58 && droppedFrames === 0,
          recommendation: this.getAnimationRecommendation(avgFPS, componentName)
        });
      });
    });

    return animations.sort((a,b) => a.avgFPS - b.avgFPS);
  }

  findAnimationPeriods(renders) {
    const periods = [];
    let currentPeriod = null;

    for (let i = 1; i < renders.length; i++) {
      const interval = renders[i].timestamp - renders[i - 1].timestamp;

      // Animation signature: renders every 16-33ms (60-30fps) for at least 5 frames
      if (interval < 35) {
        if (!currentPeriod) {
          currentPeriod = {
            start: renders[i - 1].timestamp,
            renders: [renders[i - 1]]
          };
        }
        currentPeriod.renders.push(renders[i]);
      } else {
        if (currentPeriod && currentPeriod.renders.length >= 5) {
          currentPeriod.end = currentPeriod.renders[currentPeriod.renders.length - 1].timestamp;
          periods.push(currentPeriod);
        }
        currentPeriod = null;
      }
    }

    return periods;
  }

  getAnimationRecommendation(avgFPS, component) {
    if (avgFPS < 50) {
      return `CRITICAL: Use Reanimated for ${component}. JS thread is blocking animations.`;
    }
    if (avgFPS < 57) {
      return `WARNING: Use useNativeDriver:true. Frame skips detected.`;
    }
    return 'Animation performance is smooth.';
  }
}

module.exports = { AnimationAnalyzer };
