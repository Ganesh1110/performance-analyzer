const { calculateStats } = require('../utils/stats');

class AnomalyDetector {
  detectAnomalies(timeSeries, metric) {
    // Use rolling statistics
    const windowSize = 20;
    const anomalies = [];

    if (!timeSeries || timeSeries.length < windowSize) return anomalies;

    for (let i = windowSize; i < timeSeries.length; i++) {
      const window = timeSeries.slice(i - windowSize, i);
      const stats = calculateStats(window.map(w => w[metric]));
      const current = timeSeries[i][metric];

      // Z-score based anomaly detection. Fallback to 1 for stdDev to prevent Infinity
      const stdDev = stats.stdDev || 1; 
      const zScore = Math.abs((current - stats.avg) / stdDev);

      let isAnomaly = false;
      // We look for FPS drops or CPU/Mem spikes
      if (metric === 'fps' && current < stats.avg && zScore > 2.5) isAnomaly = true;
      if (metric !== 'fps' && current > stats.avg && zScore > 2.5) isAnomaly = true;

      if (isAnomaly) {
        anomalies.push({
          timestamp: timeSeries[i].time,
          metric,
          value: current,
          expected: Math.round(stats.avg),
          deviation: zScore.toFixed(2),
          severity: this.calculateSeverity(zScore),
          context: this.getContext(timeSeries, i)
        });
      }
    }

    return anomalies;
  }

  calculateSeverity(zScore) {
    if (zScore > 4) return 'critical';
    if (zScore > 3) return 'high';
    if (zScore > 2.5) return 'medium';
    return 'low';
  }

  getContext(timeSeries, index) {
    // What else was happening during this anomaly?
    const dp = timeSeries[index];
    return {
      cpuSpike: dp.cpuTotal > 70,
      memorySpike: dp.ram > 300,
      simultaneousIssues: this.findSimultaneousIssues(dp)
    };
  }

  findSimultaneousIssues(dataPoint) {
    const issues = [];
    if (dataPoint.cpuRender > 50) issues.push('GPU_BOUND');
    if (dataPoint.cpuJS > 60) issues.push('JS_HEAVY');
    if (dataPoint.cpuUI > 40) issues.push('LAYOUT_THRASHING');
    return issues;
  }
}

module.exports = { AnomalyDetector };
