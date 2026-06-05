const fs   = require('fs');
const path = require('path');
const { calculatePercentileChange } = require('../utils/stats');
const CONFIG = require('../config');

class BaselineManager {
  constructor(storagePath) {
    this.storagePath = storagePath;
    this.baselines = new Map();
    this.loadBaselines();
  }

  loadBaselines() {
    if (fs.existsSync(this.storagePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
        Object.entries(data).forEach(([k, v]) => this.baselines.set(k, v));
      } catch (e) {
        console.warn("Could not load baselines", e);
      }
    }
  }

  saveBaselines() {
    const obj = Object.fromEntries(this.baselines);
    fs.writeFileSync(this.storagePath, JSON.stringify(obj, null, 2), 'utf8');
  }

  detectScreen(componentRenderMap) {
    const topComponents = Array.from(componentRenderMap.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 5)
      .map(([name]) => name);
    
    const signature = topComponents.sort().join(':');
    return this.getScreenName(signature) || (signature ? `Screen(${signature.substring(0,20)}...)` : 'Global_App');
  }

  getScreenName(signature) {
    // Read screen patterns from config — users add their own entries there
    const screenPatterns = CONFIG.screenPatterns || {};
    // Partial match: check if all parts of a pattern key appear in the signature
    for (const [key, name] of Object.entries(screenPatterns)) {
      if (key.split(':').every(part => signature.includes(part))) return name;
    }
    return null;
  }

  saveBaseline(screen, data) {
    const baseline = this.baselines.get(screen) || { history: [], runCount: 0, trainingData: [] };
    
    baseline.history.push({
      timestamp: Date.now(),
      data: data.summary
    });

    // Capture training data from this run's re-render issues
    if (data.reRenderIssues) {
      data.reRenderIssues.forEach(issue => {
        baseline.trainingData.push({
          componentMetrics: {
            stateVariables: Object.keys(issue.stateChangeCounts || {}).length,
            childComponents: issue.childCount || 0,
            usesContext: issue.contextChangeCount > 0 ? 1 : 0,
            hasEffects: (issue.renders || []).some(r => r.reason?.hooks?.length > 0) ? 1 : 0,
            propsCount: Object.keys(issue.propChangeCounts || {}).length
          },
          actualRenderTime: parseFloat(issue.avgRenderTime)
        });
      });
    }

    // Keep only last 5 runs and last 100 training samples
    if (baseline.history.length > 5) baseline.history.shift();
    if (baseline.trainingData.length > 100) baseline.trainingData = baseline.trainingData.slice(-100);

    baseline.runCount++;
    baseline.timestamp = Date.now();
    baseline.data = data.summary;

    this.baselines.set(screen, baseline);
    this.saveBaselines();
  }

  getTrainingData() {
    const allData = [];
    this.baselines.forEach(baseline => {
      if (baseline.trainingData) allData.push(...baseline.trainingData);
    });
    return allData;
  }

  compare(screen, currentData) {
    const baseline = this.baselines.get(screen);
    if (!baseline || !baseline.history || baseline.history.length === 0) {
      return { isFirstRun: true, message: 'No baseline for this screen yet' };
    }

    // Calculate weighted average of history
    const averageBaseline = this.calculateAverageBaseline(baseline.history);
    return this.generateSmartComparison(averageBaseline, currentData.summary);
  }

  calculateAverageBaseline(history) {
    const count = history.length;
    // Track 6 metrics (was 3)
    const avg = {
      healthScore:        0,
      bottleneckCount:    0,
      reRenderIssueCount: 0,
      memoryLeakCount:    0,
      jsBottleneckCount:  0,
      avgFPS:             0
    };

    history.forEach(run => {
      avg.healthScore        += run.data.healthScore        || 0;
      avg.bottleneckCount    += run.data.bottleneckCount    || 0;
      avg.reRenderIssueCount += run.data.reRenderIssueCount || 0;
      avg.memoryLeakCount    += run.data.memoryLeakCount    || 0;
      avg.jsBottleneckCount  += run.data.jsBottleneckCount  || 0;
      avg.avgFPS             += run.data.avgFPS             || 0;
    });

    Object.keys(avg).forEach(k => { avg[k] = Math.round(avg[k] / count); });
    return avg;
  }

  generateSmartComparison(baselineSummary, currentSummary) {
    const changes = {};
    let regressed = 0;
    let improved  = 0;

    // Metrics where a higher value is better (regression = drop, improvement = rise)
    const higherIsBetter = new Set(['healthScore', 'avgFPS']);

    ['healthScore', 'bottleneckCount', 'reRenderIssueCount',
     'memoryLeakCount', 'jsBottleneckCount', 'avgFPS'].forEach(key => {
      const base    = baselineSummary[key] || 0;
      const curr    = currentSummary[key]  || 0;
      const diff    = curr - base;
      const percent = calculatePercentileChange(base, curr);
      
      let status = 'unchanged';
      if (higherIsBetter.has(key)) {
        if (diff <= -5) status = 'regressed';
        else if (diff >= 5) status = 'improved';
      } else {
        if (diff > 0) status = 'regressed';
        else if (diff < 0) status = 'improved';
      }

      if (status === 'regressed') regressed++;
      if (status === 'improved')  improved++;

      changes[key] = { base, curr, diff, percent, status };
    });

    return { isFirstRun: false, changes, regressed, improved };
  }
}

module.exports = { BaselineManager };

