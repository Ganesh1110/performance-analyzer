const fs = require('fs');

const defaultBudgets = {
  global: {
    healthScore: { min: 80, blocker: true },
    avgFPS: { min: 58, blocker: true },
    maxBottlenecks: { max: 5, blocker: false },
    memoryLeaks: { max: 0, blocker: true }
  },
  bundleSize: {
    totalKB: { max: 5000, blocker: false }
  },
  perScreen: {
    'Home': {
      transitionDuration: { max: 200, blocker: false },
      reRenders: { max: 3, blocker: false }
    }
  },
  perComponent: {
    'ProductCard': {
      renderTime: { max: 8, blocker: false },
      bundleSize: { max: 50, blocker: false } // KB
    }
  }
};

class BudgetEnforcer {
  constructor(budgets = defaultBudgets) {
    this.budgets = budgets;
  }

  /**
   * Load budgets from a JSON file (e.g. .performance-budget.json).
   * Falls back to defaults if the file doesn't exist or can't be parsed.
   */
  static loadFromFile(budgetPath) {
    if (fs.existsSync(budgetPath)) {
      try {
        const custom = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
        // Deep-merge: custom overrides defaults at the top-level key level
        return new BudgetEnforcer({ ...defaultBudgets, ...custom });
      } catch (e) {
        console.warn(`⚠️  Could not parse budget file: ${budgetPath}. Using defaults.`);
      }
    }
    return new BudgetEnforcer();
  }

  evaluate(analysisData) {
    const violations = [];
    const blockers = [];

    // ── Global budgets ──────────────────────────────────────────────────────
    if (analysisData.summary.healthScore < this.budgets.global.healthScore.min) {
      this.addViolation(violations, blockers, {
        type: 'GLOBAL',
        metric: 'healthScore',
        actual: analysisData.summary.healthScore,
        budget: this.budgets.global.healthScore.min,
        blocker: this.budgets.global.healthScore.blocker
      });
    }

    const avgFPS = analysisData.flashlightStats.fps.avg;
    if (avgFPS < this.budgets.global.avgFPS.min) {
      this.addViolation(violations, blockers, {
        type: 'GLOBAL',
        metric: 'avgFPS',
        actual: Math.round(avgFPS),
        budget: this.budgets.global.avgFPS.min,
        blocker: this.budgets.global.avgFPS.blocker
      });
    }

    if (analysisData.bottlenecks.length > this.budgets.global.maxBottlenecks.max) {
      this.addViolation(violations, blockers, {
        type: 'GLOBAL',
        metric: 'bottlenecks',
        actual: analysisData.bottlenecks.length,
        budget: this.budgets.global.maxBottlenecks.max,
        blocker: this.budgets.global.maxBottlenecks.blocker
      });
    }

    if (analysisData.memoryAnalysis.leaks.length > this.budgets.global.memoryLeaks.max) {
      this.addViolation(violations, blockers, {
        type: 'GLOBAL',
        metric: 'memoryLeaks',
        actual: analysisData.memoryAnalysis.leaks.length,
        budget: this.budgets.global.memoryLeaks.max,
        blocker: this.budgets.global.memoryLeaks.blocker
      });
    }

    // ── Per-component budgets ───────────────────────────────────────────────
    analysisData.reRenderIssues.forEach(issue => {
      const componentBudget = this.budgets.perComponent[issue.component];
      if (componentBudget && componentBudget.renderTime) {
        const renderTime = parseFloat(issue.avgRenderTime);
        if (renderTime > componentBudget.renderTime.max) {
          this.addViolation(violations, blockers, {
            type: 'COMPONENT',
            component: issue.component,
            metric: 'renderTime',
            actual: renderTime,
            budget: componentBudget.renderTime.max,
            blocker: componentBudget.renderTime.blocker
          });
        }
      }
    });

    // ── Per-screen budgets ──────────────────────────────────────────────────
    if (this.budgets.perScreen && analysisData.navigationAnalysis) {
      analysisData.navigationAnalysis.forEach(transition => {
        const screenBudget = this.budgets.perScreen[transition.toScreen];
        if (!screenBudget) return;

        if (screenBudget.transitionDuration) {
          const actual = parseFloat(transition.totalDuration);
          if (actual > screenBudget.transitionDuration.max) {
            this.addViolation(violations, blockers, {
              type: 'SCREEN',
              screen: transition.toScreen,
              metric: 'transitionDuration',
              actual,
              budget: screenBudget.transitionDuration.max,
              blocker: screenBudget.transitionDuration.blocker
            });
          }
        }

        if (screenBudget.reRenders && analysisData.hierarchyIssues) {
          // Count re-render issues for components that are children of this screen
          const screenIssues = analysisData.reRenderIssues.filter(i =>
            analysisData.hierarchyIssues.some(h => h.child === i.component)
          );
          if (screenIssues.length > screenBudget.reRenders.max) {
            this.addViolation(violations, blockers, {
              type: 'SCREEN',
              screen: transition.toScreen,
              metric: 'reRenders',
              actual: screenIssues.length,
              budget: screenBudget.reRenders.max,
              blocker: screenBudget.reRenders.blocker
            });
          }
        }
      });
    }

    // ── Bundle size budgets ─────────────────────────────────────────────────
    if (this.budgets.bundleSize && analysisData.bundleAnalysis) {
      const totalKB = parseFloat(analysisData.bundleAnalysis.totalSizeKB);
      if (this.budgets.bundleSize.totalKB && totalKB > this.budgets.bundleSize.totalKB.max) {
        this.addViolation(violations, blockers, {
          type: 'BUNDLE',
          metric: 'totalSizeKB',
          actual: totalKB,
          budget: this.budgets.bundleSize.totalKB.max,
          blocker: this.budgets.bundleSize.totalKB.blocker
        });
      }
      // Per-component bundle size
      (analysisData.bundleAnalysis.largeComponents || []).forEach(comp => {
        const compBudget = this.budgets.perComponent[comp.component];
        if (compBudget && compBudget.bundleSize && parseFloat(comp.sizeKB) > compBudget.bundleSize.max) {
          this.addViolation(violations, blockers, {
            type: 'COMPONENT',
            component: comp.component,
            metric: 'bundleSize',
            actual: parseFloat(comp.sizeKB),
            budget: compBudget.bundleSize.max,
            blocker: compBudget.bundleSize.blocker
          });
        }
      });
    }

    return {
      passed: blockers.length === 0,
      violations,
      blockers,
      exitCode: blockers.length > 0 ? 1 : 0
    };
  }

  addViolation(violations, blockers, violation) {
    violations.push(violation);
    if (violation.blocker) blockers.push(violation);
  }

  generateReport(budgetResult) {
    let report = '## 📊 Performance Budget Report\n\n';
    
    if (budgetResult.passed) {
      report += '✅ **ALL BUDGETS PASSED**\n\n';
    } else {
      report += '❌ **BUDGET VIOLATIONS DETECTED**\n\n';
      report += `### Blocking Issues (${budgetResult.blockers.length})\n\n`;
      
      budgetResult.blockers.forEach(blocker => {
        const prefix = blocker.screen
          ? `[${blocker.screen}] `
          : blocker.component ? `<${blocker.component}> ` : '';
        report += `- 🔴 **${prefix}${blocker.metric}**: ${blocker.actual} (budget: ${blocker.budget})\n`;
      });

      if (budgetResult.violations.length > budgetResult.blockers.length) {
        const warnings = budgetResult.violations.filter(v => !v.blocker);
        report += `\n### Warnings (${warnings.length})\n\n`;
        warnings.forEach(w => {
          const prefix = w.screen ? `[${w.screen}] ` : w.component ? `<${w.component}> ` : '';
          report += `- 🟡 **${prefix}${w.metric}**: ${w.actual} (budget: ${w.budget})\n`;
        });
      }

      report += '\n⛔ **This run/PR cannot be merged until blocking issues are resolved.**\n';
    }

    return report;
  }

  generateBadge(budgetResult) {
    const color = budgetResult.passed ? '#10b981' : '#ef4444';
    const status = budgetResult.passed ? 'PASSED' : 'FAILED';
    const violations = budgetResult.violations.length;

    return `
<svg width="180" height="20" xmlns="http://www.w3.org/2000/svg">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="180" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <path fill="#555" d="M0 0h120v20H0z"/>
    <path fill="${color}" d="M120 0h60v20H120z"/>
    <path fill="url(#b)" d="M0 0h180v20H0z"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="60" y="15" fill="#010101" fill-opacity=".3">Performance Budget</text>
    <text x="60" y="14">Performance Budget</text>
    <text x="150" y="15" fill="#010101" fill-opacity=".3">${status}</text>
    <text x="150" y="14">${status}</text>
  </g>
</svg>`.trim();
  }
}

module.exports = { BudgetEnforcer };

