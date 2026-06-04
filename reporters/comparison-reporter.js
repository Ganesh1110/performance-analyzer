const { calculateStats, calculatePercentileChange } = require('../utils/stats');

function generateComparisonReport(baseline, current) {
  console.log("🔄 Generating comparison report...");

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      improved: 0,
      regressed: 0,
      unchanged: 0
    },
    metrics: {},
    regressions: [],
    improvements: []
  };

  // Compare FPS
  const fpsComparison = compareMetric(
    baseline.flashlightStats.fps,
    current.flashlightStats.fps,
    'fps',
    'higher'
  );
  report.metrics.fps = fpsComparison;
  
  // Compare CPU
  const cpuComparison = compareMetric(
    baseline.flashlightStats.cpu,
    current.flashlightStats.cpu,
    'cpu',
    'lower'
  );
  report.metrics.cpu = cpuComparison;

  // Compare bottlenecks
  report.metrics.bottlenecks = {
    baseline: baseline.bottleneckCount,
    current: current.bottleneckCount,
    change: current.bottleneckCount - baseline.bottleneckCount,
    percentChange: calculatePercentileChange(baseline.bottleneckCount, current.bottleneckCount),
    status: current.bottleneckCount < baseline.bottleneckCount ? 'improved' : 
            current.bottleneckCount > baseline.bottleneckCount ? 'regressed' : 'unchanged'
  };

  // Compare re-renders
  report.metrics.reRenders = {
    baseline: baseline.reRenderIssueCount,
    current: current.reRenderIssueCount,
    change: current.reRenderIssueCount - baseline.reRenderIssueCount,
    percentChange: calculatePercentileChange(baseline.reRenderIssueCount, current.reRenderIssueCount),
    status: current.reRenderIssueCount < baseline.reRenderIssueCount ? 'improved' : 
            current.reRenderIssueCount > baseline.reRenderIssueCount ? 'regressed' : 'unchanged'
  };

  // Count improvements and regressions
  Object.values(report.metrics).forEach(metric => {
    if (metric.status === 'improved') report.summary.improved++;
    else if (metric.status === 'regressed') report.summary.regressed++;
    else report.summary.unchanged++;
  });

  // Identify specific regressions
  if (report.metrics.bottlenecks.status === 'regressed') {
    report.regressions.push({
      metric: 'Frame Drops',
      baseline: baseline.bottleneckCount,
      current: current.bottleneckCount,
      change: `+${report.metrics.bottlenecks.change}`,
      severity: 'high'
    });
  }

  if (report.metrics.fps.status === 'regressed' && Math.abs(report.metrics.fps.percentChange) > 5) {
    report.regressions.push({
      metric: 'Average FPS',
      baseline: Math.round(baseline.flashlightStats.fps.avg),
      current: Math.round(current.flashlightStats.fps.avg),
      change: `${report.metrics.fps.percentChange.toFixed(1)}%`,
      severity: 'high'
    });
  }

  return report;
}

function compareMetric(baseline, current, metricName, betterDirection) {
  const baselineAvg = baseline.avg;
  const currentAvg = current.avg;
  const change = currentAvg - baselineAvg;
  const percentChange = calculatePercentileChange(baselineAvg, currentAvg);

  let status = 'unchanged';
  if (Math.abs(percentChange) > 2) { // 2% threshold
    if (betterDirection === 'higher') {
      status = change > 0 ? 'improved' : 'regressed';
    } else {
      status = change < 0 ? 'improved' : 'regressed';
    }
  }

  return {
    baseline: {
      avg: baselineAvg,
      p95: baseline.p95,
      p99: baseline.p99
    },
    current: {
      avg: currentAvg,
      p95: current.p95,
      p99: current.p99
    },
    change,
    percentChange,
    status
  };
}

function generateComparisonTextReport(comparisonData) {
  let report = `
╔════════════════════════════════════════════════════════════════════════════╗
║              PERFORMANCE COMPARISON REPORT (Baseline vs Current)           ║
╚════════════════════════════════════════════════════════════════════════════╝

Generated: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Improved Metrics:  ${comparisonData.summary.improved} ✅
Regressed Metrics: ${comparisonData.summary.regressed} ❌
Unchanged Metrics: ${comparisonData.summary.unchanged} ➡️

${comparisonData.summary.regressed > 0 ? '⚠️  PERFORMANCE REGRESSION DETECTED' : '✅ NO REGRESSIONS DETECTED'}

`;

  if (comparisonData.regressions.length > 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ REGRESSIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    comparisonData.regressions.forEach(reg => {
      report += `🔴 ${reg.metric}: ${reg.baseline} → ${reg.current} (${reg.change})\n`;
    });
  }

  report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 DETAILED METRICS COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Metric              Baseline    Current     Change      Status
${'-'.repeat(78)}
`;

  Object.entries(comparisonData.metrics).forEach(([metricName, data]) => {
    const statusIcon = data.status === 'improved' ? '✅' : data.status === 'regressed' ? '❌' : '➡️';
    
    if (typeof data.baseline === 'object') {
      report += `${metricName.padEnd(20)} ${Math.round(data.baseline.avg).toString().padEnd(12)} ${Math.round(data.current.avg).toString().padEnd(12)} ${data.percentChange.toFixed(1)}%`.padEnd(12) + `${statusIcon}\n`;
    } else {
      report += `${metricName.padEnd(20)} ${data.baseline.toString().padEnd(12)} ${data.current.toString().padEnd(12)} ${data.change > 0 ? '+' : ''}${data.change}`.padEnd(12) + `${statusIcon}\n`;
    }
  });

  report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  return report;
}

module.exports = { generateComparisonReport, generateComparisonTextReport };
