// nl-reporter.js
class NaturalLanguageReporter {
  generateExecutiveSummary(analysisData) {
    const { summary, bottlenecks, reRenderIssues, memoryAnalysis, flows } = analysisData;
    const healthScore = summary.healthScore;

    let nl = '';

    // Opening
    if (healthScore >= 90) {
      nl += '🎉 Your app is performing excellently. ';
    } else if (healthScore >= 70) {
      nl += '👍 Your app performance is acceptable, but there\'s room for improvement. ';
    } else {
      nl += '⚠️ Your app has significant performance issues that need immediate attention. ';
    }

    // Main issues
    if (bottlenecks.length > 0) {
      const topBottleneck = bottlenecks[0];
      const component = topBottleneck.candidates[0]?.component;
      
      nl += `We detected ${bottlenecks.length} frame drops, `;
      
      if (component) {
        nl += `primarily caused by the <${component}> component which takes ${topBottleneck.candidates[0].renderTime.toFixed(1)}ms to render. `;
        nl += `You should wrap this component in React.memo() or optimize its render logic. `;
      } else {
        nl += `but they appear to be caused by native-layer operations like image loading or network requests. `;
      }
    }

    // Re-renders
    if (reRenderIssues.length > 0) {
      const topRerenderer = reRenderIssues[0];
      nl += `Additionally, <${topRerenderer.component}> is re-rendering ${topRerenderer.renderCount} times, wasting ${topRerenderer.totalTimeSpent}ms. `;
      nl += `This is a clear candidate for memoization. `;
    }

    // Memory
    if (memoryAnalysis.leaks.length > 0) {
      nl += `⚠️ Critical: We detected ${memoryAnalysis.leaks.length} potential memory leak(s). `;
      const topLeak = memoryAnalysis.leaks[0];
      nl += `Memory grew by ${topLeak.memoryGrowth}MB during the session, likely caused by `;
      nl += topLeak.suspectComponents.map(c => `<${c.name}>`).join(' or ') + '. ';
      nl += `Check for uncleaned useEffect hooks or event listeners. `;
    }

    // User Flows
    const failedFlows = flows ? flows.filter(f => !f.passed) : [];
    if (failedFlows.length > 0) {
      nl += `❌ Critical user flows are failing: ${failedFlows.map(f => f.name).join(', ')}. `;
      nl += `The "${failedFlows[0].name}" flow took ${failedFlows[0].duration}ms (budget: ${failedFlows[0].budget.duration}ms). `;
    }

    // Action plan
    nl += '\n\n**Immediate Actions:**\n';
    nl += this.generateActionPlan(analysisData);

    return nl;
  }

  generateActionPlan(data) {
    const actions = [];

    if (data.memoryAnalysis.leaks.length > 0) {
      actions.push('1. 🔴 Fix memory leaks (highest priority - affects app stability)');
    }

    if (data.bottlenecks.length > 5) {
      actions.push('2. 🔴 Optimize top 3 bottleneck components');
    }

    if (data.reRenderIssues.length > 0) {
      actions.push('3. 🟡 Add React.memo() to frequently re-rendering components');
    }

    const failedFlows = data.flows ? data.flows.filter(f => !f.passed) : [];
    if (failedFlows.length > 0) {
      actions.push(`4. 🔴 Improve "${failedFlows[0].name}" flow duration`);
    }

    return actions.join('\n');
  }
}

module.exports = { NaturalLanguageReporter };
