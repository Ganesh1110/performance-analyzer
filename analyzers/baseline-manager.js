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
      'HomeScreen:ProductList:Header': 'Home',
      'CheckoutScreen:PaymentForm:CartSummary': 'Checkout',
      'ProfileScreen:SettingsMenu:Avatar': 'Profile'
    };
    return screenPatterns[signature];
  }

  saveBaseline(screen, data) {
    this.baselines.set(screen, {
      timestamp: Date.now(),
      data: data.summary,
      runCount: (this.baselines.get(screen)?.runCount || 0) + 1
    });
    this.saveBaselines();
  }

  compare(screen, currentData) {
    const baseline = this.baselines.get(screen);
    if (!baseline) {
      return { isFirstRun: true, message: 'No baseline for this screen yet' };
    }

    return this.generateSmartComparison(baseline.data, currentData.summary);
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
