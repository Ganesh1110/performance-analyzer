const { calculateStats } = require('../utils/stats');
const CONFIG = require('../config');

function generateTextReport(data) {
  const { 
    flashlightMeasures, 
    bottlenecks, 
    reRenderIssues, 
    memoryAnalysis,
    hierarchyIssues,
    bundleAnalysis 
  } = data;
  
  const fpsStats = calculateStats(flashlightMeasures.map(m => m.fps));
  const cpuStats = calculateStats(flashlightMeasures.map(m => m.cpuTotal));
  
  const totalFrames = flashlightMeasures.length;
  const badFrames = bottlenecks.length;
  const healthScore = Math.max(0, 100 - Math.round((badFrames / totalFrames) * 100));
  
  let report = `
╔════════════════════════════════════════════════════════════════════════════╗
║            REACT NATIVE PERFORMANCE ANALYSIS REPORT v2.0                   ║
╚════════════════════════════════════════════════════════════════════════════╝

Generated: ${new Date().toLocaleString()}
Duration: ${Math.round(flashlightMeasures[flashlightMeasures.length - 1].time)}ms
Samples: ${totalFrames} frames analyzed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 OVERALL HEALTH SCORE: ${healthScore}/100 ${getHealthEmoji(healthScore)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Performance Metrics]
  FPS Statistics:
    • Average: ${Math.round(fpsStats.avg)} FPS (target: 60)
    • Median:  ${Math.round(fpsStats.median)} FPS
    • P95:     ${Math.round(fpsStats.p95)} FPS
    • P99:     ${Math.round(fpsStats.p99)} FPS
    • Minimum: ${Math.round(fpsStats.min)} FPS
    • StdDev:  ${fpsStats.stdDev.toFixed(2)}
  
  CPU Statistics:
    • Average: ${Math.round(cpuStats.avg)}%
    • Peak:    ${Math.round(cpuStats.max)}%
    • P95:     ${Math.round(cpuStats.p95)}%

  Memory Statistics:
    • Average: ${memoryAnalysis.avgMemory} MB
    • Peak:    ${memoryAnalysis.maxMemory} MB
    • Trend:   ${memoryAnalysis.trend.toUpperCase()} ${getTrendEmoji(memoryAnalysis.trend)}

  Issues Detected:
    • ${badFrames} performance bottlenecks
    • ${reRenderIssues.length} components with excessive re-renders
    • ${hierarchyIssues.length} parent-child re-render cascades
    • ${memoryAnalysis.leaks.length} potential memory leaks
    ${bundleAnalysis ? `• ${bundleAnalysis.largeComponents.length} large components in bundle` : ''}

`;

  // BOTTLENECKS
  if (bottlenecks.length > 0) {
    report += generateBottlenecksSection(bottlenecks);
  }
  
  // RE-RENDERS
  if (reRenderIssues.length > 0) {
    report += generateReRendersSection(reRenderIssues);
  }
  
  // HIERARCHY ISSUES
  if (hierarchyIssues.length > 0) {
    report += generateHierarchySection(hierarchyIssues);
  }
  
  // MEMORY ANALYSIS
  report += generateMemorySection(memoryAnalysis);
  
  // BUNDLE ANALYSIS
  if (bundleAnalysis) {
    report += generateBundleSection(bundleAnalysis);
  }
  
  // SUMMARY
  report += generateSummarySection({
    healthScore,
    bottlenecks,
    reRenderIssues,
    hierarchyIssues,
    memoryAnalysis,
    bundleAnalysis
  });
  
  return report;
}

function generateBottlenecksSection(bottlenecks) {
  const maxShow = Math.min(CONFIG.report.maxBottlenecks, bottlenecks.length);
  
  let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐌 SECTION 1: PERFORMANCE BOTTLENECKS (${bottlenecks.length} found)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Showing top ${maxShow} worst bottlenecks:

`;

  bottlenecks.slice(0, maxShow).forEach((b, i) => {
    const candidate = b.candidates[0];
    
    section += `
────────────────────────────────────────────────────────────────────────────
#${i + 1} @ ${b.timestamp}ms (Severity: ${(b.severity * 100).toFixed(0)}%)
────────────────────────────────────────────────────────────────────────────

[Symptoms] ${b.issues.map(issue => `\n  • ${issue}`).join('')}

[Metrics]
  • FPS: ${b.fps} | CPU: ${b.cpuTotal}% | RenderThread: ${b.cpuRender}% | JS: ${b.cpuJS}%

[Root Cause]
${candidate && candidate.component 
  ? `  ${getConfidenceEmoji(candidate.confidence)} <${candidate.component}> (${(candidate.confidence * 100).toFixed(0)}% confidence)
  → Render time: ${candidate.renderTime.toFixed(2)}ms
  → Temporal distance: ${candidate.temporalDistance}ms` 
  : `  ⚠️  No React component identified - likely native layer issue`}

${b.candidates.length > 1 
  ? `[Alternatives]\n${b.candidates.slice(1, 3).map(c => 
      `  • <${c.component}> (${(c.confidence * 100).toFixed(0)}%)`
    ).join('\n')}` 
  : ''}
`;
  });
  
  return section;
}

function generateReRendersSection(reRenderIssues) {
  const maxShow = Math.min(CONFIG.report.maxReRenderIssues, reRenderIssues.length);
  
  let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 SECTION 2: EXCESSIVE RE-RENDERS (${reRenderIssues.length} found)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  reRenderIssues.slice(0, maxShow).forEach((issue, i) => {
    section += `
────────────────────────────────────────────────────────────────────────────
#${i + 1} <${issue.component}> (Severity: ${(issue.severity * 100).toFixed(0)}%)
────────────────────────────────────────────────────────────────────────────

[Statistics]
  • Renders:     ${issue.renderCount} times
  • Frequency:   ${issue.frequency}/sec
  • Avg Time:    ${issue.avgRenderTime}ms per render
  • Total Time:  ${issue.totalTimeSpent}ms wasted

[Issues] ${issue.issues.map(i => `\n  • ${i}`).join('')}

[Fix Recommendations]
  🔴 Wrap in React.memo() to prevent unnecessary re-renders
  🔴 Check parent component - is it re-rendering unnecessarily?
  🟡 Move state closer to usage (avoid prop drilling)
  🟡 Use useCallback() for function props
`;
  });
  
  return section;
}

function generateHierarchySection(hierarchyIssues) {
  let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌳 SECTION 3: PARENT-CHILD RE-RENDER CASCADES (${hierarchyIssues.length} found)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When a parent re-renders, it often triggers unnecessary child re-renders.

`;

  hierarchyIssues.slice(0, 10).forEach((issue, i) => {
    section += `
#${i + 1} <${issue.parent}> → <${issue.child}>
  • Child renders ${issue.cascadingRenders}/${issue.totalChildRenders} times due to parent (${issue.cascadePercentage}%)
  • ${issue.recommendation}

`;
  });
  
  return section;
}

function generateMemorySection(memoryAnalysis) {
  let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💾 SECTION 4: MEMORY ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Overview]
  • Trend:   ${memoryAnalysis.trend.toUpperCase()} ${getTrendEmoji(memoryAnalysis.trend)}
  • Average: ${memoryAnalysis.avgMemory} MB
  • Peak:    ${memoryAnalysis.maxMemory} MB
  • Minimum: ${memoryAnalysis.minMemory} MB

`;

  if (memoryAnalysis.spikes.length > 0) {
    section += `
[Memory Spikes] (${memoryAnalysis.spikes.length} detected)
${memoryAnalysis.spikes.slice(0, 5).map((spike, i) => 
  `  #${i + 1} @ ${spike.timestamp}ms: ${spike.value} MB (+${spike.delta.toFixed(1)} MB) ${spike.severity === 'critical' ? '🔴' : '🟡'}`
).join('\n')}

`;
  }
  
  if (memoryAnalysis.leaks.length > 0) {
    section += `
[Potential Memory Leaks] (${memoryAnalysis.leaks.length} detected) ⚠️

`;
    
    memoryAnalysis.leaks.forEach((leak, i) => {
      section += `
Leak #${i + 1}:
  • Time Range: ${leak.timeRange.start}ms - ${leak.timeRange.end}ms
  • Memory Growth: +${leak.memoryGrowth} MB (${leak.earlyAvg} → ${leak.lateAvg} MB)
  • Suspect Components:
${leak.suspectComponents.map(c => `    → <${c.name}> (${c.renderCount} renders during leak)`).join('\n')}

  [Action Required]
    🔴 Check these components for:
       • Event listeners not being removed (useEffect cleanup)
       • Timers/intervals not cleared (clearInterval, clearTimeout)
       • Subscriptions not unsubscribed
       • Large objects held in closures
       • Circular references preventing garbage collection

`;
    });
  } else {
    section += `✅ No memory leaks detected!\n`;
  }
  
  return section;
}

function generateBundleSection(bundleAnalysis) {
  let section = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 SECTION 5: BUNDLE SIZE ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Overview]
  • Total Bundle Size: ${bundleAnalysis.totalSizeKB} KB
  • Large Components:  ${bundleAnalysis.largeComponents.length}
  • Size-Performance Correlation: ${bundleAnalysis.correlationCoefficient.toFixed(2)}
    ${bundleAnalysis.correlationCoefficient > 0.5 ? '⚠️  Strong correlation - larger components are slower!' : '✅ Weak correlation'}

`;

  if (bundleAnalysis.largeComponents.length > 0) {
    section += `
[Large Components That Impact Performance]

Component                    Size      Renders  Avg Render Time  Impact
${'-'.repeat(78)}
${bundleAnalysis.largeComponents.slice(0, 10).map(c => 
  `${c.component.padEnd(25)} ${(c.sizeKB + ' KB').padEnd(10)} ${String(c.renderCount).padEnd(8)} ${(c.avgRenderTime + 'ms').padEnd(16)} ${c.severity === 'critical' ? '🔴' : '🟡'}`
).join('\n')}

[Recommendations]
  🔴 Consider code-splitting large components
  🔴 Lazy load components not needed on initial render
  🟡 Review if all dependencies are necessary
  🟡 Use React.lazy() and Suspense for heavy components
`;
  }
  
  return section;
}

function generateSummarySection(data) {
  const { healthScore, bottlenecks, reRenderIssues, hierarchyIssues, memoryAnalysis, bundleAnalysis } = data;
  
  const allIssues = [
    ...bottlenecks.map(b => ({ type: 'bottleneck', severity: b.severity, component: b.candidates[0]?.component })),
    ...reRenderIssues.map(r => ({ type: 'rerender', severity: r.severity, component: r.component })),
    ...hierarchyIssues.map(h => ({ type: 'hierarchy', severity: h.severity === 'high' ? 0.8 : 0.5, component: h.child })),
    ...memoryAnalysis.leaks.map(l => ({ type: 'memory', severity: 0.9, component: l.suspectComponents[0]?.name }))
  ].sort((a, b) => b.severity - a.severity);
  
  let summary = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SUMMARY & ACTION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  if (allIssues.length === 0) {
    summary += `
🎉 Excellent! No critical performance issues detected.

Your app is performing well. Continue monitoring as you add features.

`;
  } else {
    summary += `
Priority Issues (sorted by severity):

`;
    
    allIssues.slice(0, 10).forEach((issue, i) => {
      const icon = issue.severity > 0.7 ? '🔴' : issue.severity > 0.4 ? '🟡' : '🟢';
      const typeLabel = {
        'bottleneck': 'Frame Drop',
        'rerender': 'Re-render',
        'hierarchy': 'Cascade',
        'memory': 'Memory Leak'
      }[issue.type];
      
      summary += `${i + 1}. ${icon} [${typeLabel}] ${issue.component || 'Unknown'}\n`;
    });
    
    summary += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 RECOMMENDED ACTION PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMMEDIATE (Do First):
  1. Fix memory leaks (check useEffect cleanup functions)
  2. Add React.memo() to components with excessive re-renders
  3. Optimize top 3 bottleneck components

SHORT-TERM (This Week):
  4. Review parent-child relationships causing cascades
  5. Code-split large bundle components
  6. Re-run analysis to measure improvement

LONG-TERM (Ongoing):
  7. Set up automated performance monitoring in CI/CD
  8. Establish performance budgets (max FPS drop, render time)
  9. Regular profiling of new features before merge

`;
  }
  
  summary += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF REPORT - View HTML report for interactive charts and visualizations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return summary;
}

function getHealthEmoji(score) {
  if (score >= 90) return '✅ EXCELLENT';
  if (score >= 80) return '✅ GOOD';
  if (score >= 60) return '⚠️  NEEDS IMPROVEMENT';
  return '❌ CRITICAL';
}

function getTrendEmoji(trend) {
  if (trend === 'increasing') return '📈 (Warning: Memory growing)';
  if (trend === 'decreasing') return '📉 (Good: Memory decreasing)';
  return '➡️  (Stable)';
}

function getConfidenceEmoji(confidence) {
  if (confidence > 0.7) return '✓';
  if (confidence > 0.5) return '⚠';
  return '?';
}

module.exports = { generateTextReport };
