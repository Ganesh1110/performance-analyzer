const fs = require('fs');

const defaultBudgets = {
  global: {
    healthScore: { min: 80, blocker: true },
    avgFPS: { min: 58, blocker: true },
    maxBottlenecks: { max: 5, blocker: false },
    memoryLeaks: { max: 0, blocker: true }
  },
  perScreen: {
    'Home': {
      renderTime: { max: 16.67, blocker: false },
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

  evaluate(analysisData) {
    const violations = [];
    const blockers = [];

    // Check global budgets
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

    // Check per-component budgets
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
        const componentPrefix = blocker.component ? `<${blocker.component}> ` : '';
        report += `- 🔴 **${componentPrefix}${blocker.metric}**: ${blocker.actual} (budget: ${blocker.budget})\n`;
      });

      report += '\n⛔ **This run/PR cannot be merged until blocking issues are resolved.**\n';
    }

    return report;
  }
}

module.exports = { BudgetEnforcer };
