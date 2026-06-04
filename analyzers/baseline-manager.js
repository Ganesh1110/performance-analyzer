const fs = require('fs');
const path = require('path');
const { calculatePercentileChange } = require('../utils/stats');

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
    const screenPatterns = {
      'Header:HomeScreen:ProductList': 'Home',
      'CartSummary:CheckoutScreen:PaymentForm': 'Checkout',
      'Avatar:ProfileScreen:SettingsMenu': 'Profile'
    };
    return screenPatterns[signature];
  }

  saveBaseline(screen, data) {
    const baseline = this.baselines.get(screen) || { history: [], runCount: 0 };
    
    baseline.history.push({
      timestamp: Date.now(),
      data: data.summary
    });

    // Keep only last 5 runs
    if (baseline.history.length > 5) {
      baseline.history.shift();
    }

    baseline.runCount++;
    baseline.timestamp = Date.now();
    baseline.data = data.summary; // Latest data for quick access

    this.baselines.set(screen, baseline);
    this.saveBaselines();
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
    const avg = {
      healthScore: 0,
      bottleneckCount: 0,
      reRenderIssueCount: 0
    };

    history.forEach(run => {
      avg.healthScore += run.data.healthScore || 0;
      avg.bottleneckCount += run.data.bottleneckCount || 0;
      avg.reRenderIssueCount += run.data.reRenderIssueCount || 0;
    });

    avg.healthScore = Math.round(avg.healthScore / count);
    avg.bottleneckCount = Math.round(avg.bottleneckCount / count);
    avg.reRenderIssueCount = Math.round(avg.reRenderIssueCount / count);

    return avg;
  }

  generateSmartComparison(baselineSummary, currentSummary) {
    const changes = {};
    let regressed = 0;
    let improved = 0;

    ['healthScore', 'bottleneckCount', 'reRenderIssueCount'].forEach(key => {
      const base = baselineSummary[key] || 0;
      const curr = currentSummary[key] || 0;
      const diff = curr - base;
      const percent = calculatePercentileChange(base, curr);
      
      let status = 'unchanged';
      if (key === 'healthScore') {
        if (diff <= -5) status = 'regressed';
        else if (diff >= 5) status = 'improved';
      } else {
        if (diff > 0) status = 'regressed';
        else if (diff < 0) status = 'improved';
      }

      if (status === 'regressed') regressed++;
      if (status === 'improved') improved++;

      changes[key] = { base, curr, diff, percent, status };
    });

    return { isFirstRun: false, changes, regressed, improved };
  }
}

module.exports = { BaselineManager };
