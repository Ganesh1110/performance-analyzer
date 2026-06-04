const fs = require('fs');
const path = require('path');
const { calculateStats } = require('../utils/stats');
const CONFIG = require('../config');

function generateHTMLReport(data) {
  const {
    flashlightMeasures,
    bottlenecks,
    reRenderIssues,
    memoryAnalysis,
    hierarchyIssues,
    bundleAnalysis,
    hierarchyTree
  } = data;

  const fpsData = flashlightMeasures.map(m => ({ x: m.time, y: m.fps }));
  const cpuData = flashlightMeasures.map(m => ({ x: m.time, y: m.cpuTotal }));
  const memoryData = memoryAnalysis.timeline.map(m => ({ x: m.timestamp, y: m.value }));

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Analysis Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f7fa;
      color: #2c3e50;
      line-height: 1.6;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .health-score {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    
    .score-circle {
      width: 200px;
      height: 200px;
      border-radius: 50%;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      font-weight: bold;
      background: conic-gradient(
        ${CONFIG.report.chartColors.good} 0%,
        ${CONFIG.report.chartColors.good} var(--score-percent),
        #e0e0e0 var(--score-percent),
        #e0e0e0 100%
      );
    }
    
    .score-inner {
      width: 170px;
      height: 170px;
      background: white;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    
    .metric-card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .metric-title {
      font-size: 0.875rem;
      color: #718096;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }
    
    .metric-value {
      font-size: 2rem;
      font-weight: bold;
      color: #2d3748;
    }
    
    .chart-container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin: 2rem 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .chart-wrapper {
      position: relative;
      height: 300px;
    }
    
    .section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      margin: 2rem 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .section-title {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
      color: #2d3748;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 0.5rem;
    }
    
    .issue-card {
      border-left: 4px solid #f56565;
      padding: 1rem;
      margin: 1rem 0;
      background: #fff5f5;
      border-radius: 4px;
    }
    
    .issue-card.warning {
      border-left-color: #ed8936;
      background: #fffaf0;
    }
    
    .issue-card.info {
      border-left-color: #4299e1;
      background: #ebf8ff;
    }
    
    .component-tree {
      font-family: 'Courier New', monospace;
      background: #f7fafc;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    
    .tree-node {
      margin: 0.25rem 0;
      padding-left: 1rem;
    }
    
    .tree-node.has-children {
      cursor: pointer;
    }
    
    .tree-node.has-children:hover {
      background: #edf2f7;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    
    th {
      background: #f7fafc;
      font-weight: 600;
      color: #4a5568;
    }
    
    tr:hover {
      background: #f7fafc;
    }
    
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    
    .badge.critical { background: #fed7d7; color: #c53030; }
    .badge.warning { background: #feebc8; color: #c05621; }
    .badge.good { background: #c6f6d5; color: #22543d; }
    
    .tabs {
      display: flex;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 1.5rem;
    }
    
    .tab {
      padding: 0.75rem 1.5rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
    }
    
    .tab:hover {
      background: #f7fafc;
    }
    
    .tab.active {
      border-bottom-color: #667eea;
      color: #667eea;
      font-weight: 600;
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="container">
      <h1>🚀 React Native Performance Analysis Report</h1>
      <p>Generated: ${new Date().toLocaleString()}</p>
    </div>
  </div>

  <div class="container">
    ${generateExecutiveSummaryHTML(data)}
    ${generateHealthScoreHTML(data)}
    ${generateMetricGridHTML(data)}
    ${generateChartsHTML(data)}
    ${generateIssueTabsHTML(data)}
  </div>

  <script>
    ${generateChartScripts(fpsData, cpuData, memoryData, bottlenecks)}
    ${generateTabScript()}
    ${generateTreeScript()}
  </script>
</body>
</html>
  `;

  return html;
}

function generateExecutiveSummaryHTML(data) {
  if (!data.executiveSummary) return '';
  return `
    <div class="section" style="border-left: 8px solid #667eea;">
      <h3 class="section-title">📝 Executive Summary</h3>
      <div style="font-size: 1.1rem; color: #4a5568;">
        ${data.executiveSummary.replace(/\n/g, '<br>')}
      </div>
    </div>
  `;
}

function generateHealthScoreHTML(data) {
  const { flashlightMeasures, bottlenecks } = data;
  const healthScore = Math.max(0, 100 - Math.round((bottlenecks.length / flashlightMeasures.length) * 100));
  
  const scoreColor = healthScore >= 80 
    ? CONFIG.report.chartColors.good 
    : healthScore >= 60 
    ? CONFIG.report.chartColors.warning 
    : CONFIG.report.chartColors.critical;

  return `
    <div class="health-score">
      <div class="score-circle" style="--score-percent: ${healthScore}%; background: conic-gradient(${scoreColor} 0%, ${scoreColor} ${healthScore}%, #e0e0e0 ${healthScore}%, #e0e0e0 100%);">
        <div class="score-inner">
          <div class="metric-value">${healthScore}</div>
          <div class="metric-title">Health Score</div>
        </div>
      </div>
      <p style="color: #718096; margin-top: 1rem;">
        ${healthScore >= 90 ? '✅ Excellent Performance' : 
          healthScore >= 80 ? '✅ Good Performance' :
          healthScore >= 60 ? '⚠️ Needs Improvement' :
          '❌ Critical Issues Detected'}
      </p>
    </div>
  `;
}

function generateMetricGridHTML(data) {
  const { flashlightMeasures, bottlenecks, reRenderIssues, memoryAnalysis, hierarchyIssues } = data;
  const fpsStats = calculateStats(flashlightMeasures.map(m => m.fps));
  const cpuStats = calculateStats(flashlightMeasures.map(m => m.cpuTotal));

  return `
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-title">Average FPS</div>
        <div class="metric-value">${Math.round(fpsStats.avg)}</div>
        <div style="color: ${fpsStats.avg >= 55 ? CONFIG.report.chartColors.good : CONFIG.report.chartColors.critical}; margin-top: 0.5rem;">
          Target: 60 FPS
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-title">Frame Drops</div>
        <div class="metric-value">${bottlenecks.length}</div>
        <div style="color: #718096; margin-top: 0.5rem;">
          ${((bottlenecks.length / flashlightMeasures.length) * 100).toFixed(1)}% of frames
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-title">Re-render Issues</div>
        <div class="metric-value">${reRenderIssues.length}</div>
        <div style="color: #718096; margin-top: 0.5rem;">
          Components rendering excessively
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-title">Memory Trend</div>
        <div class="metric-value">${memoryAnalysis.trend === 'increasing' ? '📈' : memoryAnalysis.trend === 'decreasing' ? '📉' : '➡️'}</div>
        <div style="color: ${memoryAnalysis.trend === 'increasing' ? CONFIG.report.chartColors.warning : CONFIG.report.chartColors.good}; margin-top: 0.5rem;">
          ${memoryAnalysis.avgMemory} MB avg
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-title">CPU Usage (P95)</div>
        <div class="metric-value">${Math.round(cpuStats.p95)}%</div>
        <div style="color: ${cpuStats.p95 > 70 ? CONFIG.report.chartColors.critical : CONFIG.report.chartColors.good}; margin-top: 0.5rem;">
          Avg: ${Math.round(cpuStats.avg)}%
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-title">Parent-Child Cascades</div>
        <div class="metric-value">${hierarchyIssues.length}</div>
        <div style="color: #718096; margin-top: 0.5rem;">
          Unnecessary re-render chains
        </div>
      </div>
    </div>
  `;
}

function generateChartsHTML(data) {
  return `
    <div class="chart-container">
      <h3 class="section-title">📊 Performance Timeline</h3>
      <div class="tabs">
        <div class="tab active" onclick="switchChart('fps')">FPS</div>
        <div class="tab" onclick="switchChart('cpu')">CPU Usage</div>
        <div class="tab" onclick="switchChart('memory')">Memory</div>
      </div>
      <div class="chart-wrapper">
        <canvas id="performanceChart"></canvas>
      </div>
    </div>
  `;
}

function generateIssueTabsHTML(data) {
  const { bottlenecks, reRenderIssues, hierarchyIssues, memoryAnalysis, bundleAnalysis, hierarchyTree, flows = [], anomalies = [] } = data;

  return `
    <div class="section">
      <div class="tabs">
        <div class="tab active" onclick="switchTab('bottlenecks')">
          🐌 Bottlenecks (${bottlenecks.length})
        </div>
        <div class="tab" onclick="switchTab('rerenders')">
          🔄 Re-renders (${reRenderIssues.length})
        </div>
        <div class="tab" onclick="switchTab('hierarchy')">
          🌳 Component Tree (${hierarchyIssues.length})
        </div>
        <div class="tab" onclick="switchTab('memory')">
          💾 Memory (${memoryAnalysis.leaks.length} leaks)
        </div>
        <div class="tab" onclick="switchTab('flows')">
          🌊 Flows (${flows.length})
        </div>
        <div class="tab" onclick="switchTab('anomalies')">
          🚨 Anomalies (${anomalies.length})
        </div>
        <div class="tab" onclick="switchTab('concurrent')">
          ⚛️ Concurrent (${data.concurrentAnalysis.transitions.length + data.concurrentAnalysis.interruptedRenders.length})
        </div>
        <div class="tab" onclick="switchTab('phases')">
          🔄 Phases
        </div>
        <div class="tab" onclick="switchTab('animations')">
          🎬 Animations (${data.animations.length})
        </div>
        <div class="tab" onclick="switchTab('prediction')">
          🔮 Prediction
        </div>
        <div class="tab" onclick="switchTab('fixes')">
          🛠️ Automated Fixes (${data.automatedFixes.length})
        </div>
        ${bundleAnalysis ? `
        <div class="tab" onclick="switchTab('bundle')">
          📦 Bundle Size
        </div>
        ` : ''}
      </div>

      <div id="bottlenecks" class="tab-content active">
        ${generateBottlenecksTableHTML(bottlenecks)}
      </div>

      <div id="rerenders" class="tab-content">
        ${generateReRendersTableHTML(reRenderIssues)}
      </div>

      <div id="hierarchy" class="tab-content">
        ${generateHierarchyHTML(hierarchyIssues, hierarchyTree)}
      </div>

      <div id="memory" class="tab-content">
        ${generateMemoryHTML(memoryAnalysis)}
      </div>

      <div id="flows" class="tab-content">
        ${generateFlowsHTML(flows)}
      </div>

      <div id="anomalies" class="tab-content">
        ${generateAnomaliesHTML(anomalies)}
      </div>

      <div id="concurrent" class="tab-content">
        ${generateConcurrentHTML(data.concurrentAnalysis)}
      </div>

      <div id="phases" class="tab-content">
        ${generatePhasesHTML(data.phaseAnalysis)}
      </div>

      <div id="animations" class="tab-content">
        ${generateAnimationsHTML(data.animations)}
      </div>

      <div id="prediction" class="tab-content">
        ${generatePredictionHTML(data.prediction)}
      </div>

      <div id="fixes" class="tab-content">
        ${generateFixesHTML(data.automatedFixes)}
      </div>

      ${bundleAnalysis ? `
      <div id="bundle" class="tab-content">
        ${generateBundleHTML(bundleAnalysis)}
      </div>
      ` : ''}
    </div>
  `;
}

function generatePredictionHTML(prediction) {
  if (!prediction) return '<p style="padding: 2rem; text-align: center; color: #718096;">ℹ️ Prediction engine data not available.</p>';

  return `
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-title">Predicted Render Time</div>
        <div class="metric-value">${prediction.predictedRenderTime}</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Risk Level</div>
        <div class="metric-value" style="color: ${prediction.risk === 'HIGH' ? CONFIG.report.chartColors.critical : prediction.risk === 'MEDIUM' ? CONFIG.report.chartColors.warning : CONFIG.report.chartColors.good}">
          ${prediction.risk}
        </div>
      </div>
    </div>
    
    <h4 style="margin: 1.5rem 0 1rem;">Predicted Optimization Needs</h4>
    ${prediction.suggestions.map(s => `
      <div class="issue-card ${s.priority === 'HIGH' ? 'critical' : 'warning'}">
        <strong>${s.type}</strong> [Priority: ${s.priority}]
        <p>${s.message}</p>
      </div>
    `).join('') || '<p>✅ No major risks predicted for this component structure.</p>'}
  `;
}

function generateFixesHTML(fixes) {
  if (!fixes || fixes.length === 0) return '<p style="padding: 2rem; text-align: center; color: #718096;">✅ No automated fixes suggested at this time.</p>';

  const allSuggestions = fixes.flatMap(f => f.suggestions);
  if (allSuggestions.length === 0) return '<p style="padding: 2rem; text-align: center; color: #718096;">✅ No automated fixes suggested at this time.</p>';

  return `
    <p style="margin-bottom: 1rem;">Recommended code changes to improve performance:</p>
    <table>
      <thead>
        <tr><th>Component</th><th>Type</th><th>Description</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${fixes.map(f => f.suggestions.map(s => `
          <tr>
            <td><strong>&lt;${f.component}&gt;</strong></td>
            <td><span class="badge ${s.type === 'ADD_MEMO' ? 'critical' : 'warning'}">${s.type}</span></td>
            <td>${s.description}</td>
            <td><button style="padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid #ccc; cursor: not-allowed;" disabled title="Direct patching not available in this version">Apply Patch</button></td>
          </tr>
        `).join('')).join('')}
      </tbody>
    </table>
  `;
}

function generateAnimationsHTML(animations) {
  if (!animations || animations.length === 0) return '<p style="padding: 2rem; text-align: center; color: #718096;">✅ No animations detected.</p>';

  return `
    <table>
      <thead>
        <tr><th>Component</th><th>Duration</th><th>Avg FPS</th><th>Dropped Frames</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${animations.map(a => `
          <tr>
            <td><strong>${a.component}</strong></td>
            <td>${a.duration}ms</td>
            <td>${a.avgFPS}</td>
            <td>${a.droppedFrames}</td>
            <td><span class="badge ${a.smooth ? 'good' : 'warning'}">${a.smooth ? 'Smooth' : 'Janky'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function generateConcurrentHTML(analysis) {
  let html = '<h4>⚛️ Concurrent React Analysis</h4>';
  
  if (analysis.transitions.length > 0) {
    html += '<h5 style="margin-top: 1rem;">Transitions</h5>';
    html += `
      <table>
        <thead>
          <tr><th>Time</th><th>Duration</th><th>Components</th><th>Interrupted</th></tr>
        </thead>
        <tbody>
          ${analysis.transitions.map(t => `
            <tr>
              <td>${t.timestamp}ms</td>
              <td>${t.duration}ms</td>
              <td>${t.components.join(', ')}</td>
              <td>${t.wasInterrupted ? '⚠️ Yes' : 'No'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (analysis.interruptedRenders.length > 0) {
    html += '<h5 style="margin-top: 1rem;">Interrupted Renders</h5>';
    html += `
      <table>
        <thead>
          <tr><th>Time</th><th>Actual</th><th>Interrupted</th><th>Efficiency</th></tr>
        </thead>
        <tbody>
          ${analysis.interruptedRenders.map(r => `
            <tr>
              <td>${r.timestamp}ms</td>
              <td>${r.actualDuration}ms</td>
              <td>${r.interruptedDuration}ms</td>
              <td>${r.efficiency}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (analysis.transitions.length === 0 && analysis.interruptedRenders.length === 0) {
    html += '<p style="padding: 2rem; text-align: center; color: #718096;">ℹ️ No concurrent features (transitions/suspense) detected in this trace.</p>';
  }

  return html;
}

function generatePhasesHTML(phases) {
  const expensivePhases = phases.filter(p => p.renderPhase.expensive || p.commitPhase.expensive);
  
  if (expensivePhases.length === 0) return '<p style="padding: 2rem; text-align: center; color: #718096;">✅ All render phases are within healthy thresholds.</p>';

  return `
    <p style="margin-bottom: 1rem;">Showing ${expensivePhases.length} heavy render cycles:</p>
    <table>
      <thead>
        <tr><th>Time</th><th>Total</th><th>Render Phase</th><th>Commit Phase</th><th>Recommendation</th></tr>
      </thead>
      <tbody>
        ${expensivePhases.slice(0, 20).map(p => `
          <tr>
            <td>${p.timestamp}ms</td>
            <td>${p.totalDuration}ms</td>
            <td style="color: ${p.renderPhase.expensive ? CONFIG.report.chartColors.critical : 'inherit'}">${p.renderPhase.duration}ms (${p.renderPhase.percentage}%)</td>
            <td style="color: ${p.commitPhase.expensive ? CONFIG.report.chartColors.critical : 'inherit'}">${p.commitPhase.duration}ms (${p.commitPhase.percentage}%)</td>
            <td><small>${p.recommendation}</small></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function generateFlowsHTML(flows) {
  if (!flows || flows.length === 0) return '<p style="padding: 2rem; text-align: center; color: #718096;">ℹ️ No configured user flows detected in this trace.</p>';
  
  return `
    <table>
      <thead>
        <tr><th>Flow</th><th>Duration</th><th>Budget</th><th>Avg FPS</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${flows.map(f => `
          <tr>
            <td><strong>${f.name}</strong></td>
            <td>${f.duration}ms</td>
            <td>< ${f.budget.duration}ms</td>
            <td>${f.avgFPS} (target: ${f.budget.fps})</td>
            <td><span class="badge ${f.passed ? 'good' : 'critical'}">${f.passed ? '✅ PASSED' : '❌ FAILED'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function generateAnomaliesHTML(anomalies) {
  if (!anomalies || anomalies.length === 0) return '<p style="padding: 2rem; text-align: center; color: #718096;">✅ No statistical anomalies detected.</p>';

  return `
    <table>
      <thead>
        <tr><th>Time</th><th>Metric</th><th>Value</th><th>Expected</th><th>Deviation (Z-Score)</th><th>Severity</th></tr>
      </thead>
      <tbody>
        ${anomalies.slice(0, 20).map(a => `
          <tr>
            <td>${a.timestamp}ms</td>
            <td><strong>${a.metric.toUpperCase()}</strong></td>
            <td>${Math.round(a.value)}</td>
            <td>~${a.expected}</td>
            <td>${a.deviation}σ</td>
            <td><span class="badge ${a.severity === 'critical' ? 'critical' : a.severity === 'high' ? 'warning' : 'info'}">${a.severity.toUpperCase()}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function generateBottlenecksTableHTML(bottlenecks) {
  if (bottlenecks.length === 0) {
    return '<p style="padding: 2rem; text-align: center; color: #718096;">✅ No performance bottlenecks detected!</p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>FPS</th>
          <th>CPU</th>
          <th>Component</th>
          <th>Network</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        ${bottlenecks.slice(0, 20).map(b => {
          const candidate = b.candidates[0];
          const severityClass = b.severity > 0.7 ? 'critical' : b.severity > 0.4 ? 'warning' : 'good';
          const networkInfo = b.networkActivity 
            ? `<span title="${b.networkActivity.details?.join('\n') || ''}">${b.networkActivity.concurrentCount} reqs ${b.networkActivity.likelyBlocked ? '⚠️' : ''}</span>`
            : '-';
          
          return `
            <tr>
              <td>${b.timestamp}ms</td>
              <td>${b.fps} FPS</td>
              <td>${b.cpuTotal}%</td>
              <td>${candidate && candidate.component ? `<${candidate.component}>` : '<em>Native layer</em>'}</td>
              <td>${networkInfo}</td>
              <td><span class="badge ${severityClass}">${(b.severity * 100).toFixed(0)}%</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function generateReRendersTableHTML(reRenderIssues) {
  if (reRenderIssues.length === 0) {
    return '<p style="padding: 2rem; text-align: center; color: #718096;">✅ No excessive re-renders detected!</p>';
  }

  return `
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Render Count</th>
          <th>Frequency</th>
          <th>Avg Render Time</th>
          <th>Total Time Wasted</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        ${reRenderIssues.slice(0, 20).map(issue => {
          const severityClass = issue.severity > 0.7 ? 'critical' : issue.severity > 0.4 ? 'warning' : 'good';
          
          return `
            <tr>
              <td><strong>&lt;${issue.component}&gt;</strong></td>
              <td>${issue.renderCount}</td>
              <td>${issue.frequency}/sec</td>
              <td>${issue.avgRenderTime}ms</td>
              <td>${issue.totalTimeSpent}ms</td>
              <td><span class="badge ${severityClass}">${(issue.severity * 100).toFixed(0)}%</span></td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function generateHierarchyHTML(hierarchyIssues, hierarchyTree) {
  let html = '<h4 style="margin-bottom: 1rem;">Parent-Child Re-render Cascades</h4>';

  if (hierarchyIssues.length === 0) {
    html += '<p style="color: #718096;">✅ No cascading re-render issues detected!</p>';
  } else {
    hierarchyIssues.slice(0, 10).forEach(issue => {
      const severityClass = issue.severity === 'high' ? 'critical' : 'warning';
      html += `
        <div class="issue-card ${severityClass}">
          <strong>&lt;${issue.parent}&gt; → &lt;${issue.child}&gt;</strong>
          <p style="margin: 0.5rem 0;">
            Child renders <strong>${issue.cascadingRenders}/${issue.totalChildRenders}</strong> times due to parent 
            (<strong>${issue.cascadePercentage}%</strong> cascade rate)
          </p>
          <p style="color: #718096; font-size: 0.875rem;">
            💡 ${issue.recommendation}
          </p>
        </div>
      `;
    });
  }

  html += '<h4 style="margin: 2rem 0 1rem;">Component Hierarchy Tree</h4>';
  html += '<div class="component-tree">';
  
  if (hierarchyTree && hierarchyTree.length > 0) {
    hierarchyTree.forEach(root => {
      html += renderTreeNode(root, 0);
    });
  } else {
    html += '<p style="color: #718096;">No hierarchy data available</p>';
  }
  
  html += '</div>';

  return html;
}

function renderTreeNode(node, depth) {
  const indent = '  '.repeat(depth);
  const hasChildren = node.children && node.children.length > 0;
  const nodeClass = hasChildren ? 'has-children' : '';
  
  let html = `<div class="tree-node ${nodeClass}" style="padding-left: ${depth * 1.5}rem;">`;
  html += `${indent}${hasChildren ? '▼' : '•'} <strong>&lt;${node.name}&gt;</strong> `;
  html += `<span style="color: #718096;">(${node.renderCount} renders, avg ${node.avgRenderTime}ms)</span>`;
  html += '</div>';
  
  if (hasChildren) {
    node.children.forEach(child => {
      html += renderTreeNode(child, depth + 1);
    });
  }
  
  return html;
}

function generateMemoryHTML(memoryAnalysis) {
  let html = `
    <div class="metric-grid" style="margin-bottom: 2rem;">
      <div class="metric-card">
        <div class="metric-title">Trend</div>
        <div class="metric-value">${memoryAnalysis.trend === 'increasing' ? '📈' : memoryAnalysis.trend === 'decreasing' ? '📉' : '➡️'}</div>
        <div style="color: #718096; margin-top: 0.5rem;">${memoryAnalysis.trend}</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Average Memory</div>
        <div class="metric-value">${memoryAnalysis.avgMemory}</div>
        <div style="color: #718096; margin-top: 0.5rem;">MB</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Peak Memory</div>
        <div class="metric-value">${memoryAnalysis.maxMemory}</div>
        <div style="color: #718096; margin-top: 0.5rem;">MB</div>
      </div>
    </div>
  `;

  if (memoryAnalysis.leaks.length > 0) {
    html += '<h4>⚠️ Potential Memory Leaks Detected</h4>';
    
    memoryAnalysis.leaks.forEach((leak, i) => {
      html += `
        <div class="issue-card critical" style="margin: 1rem 0;">
          <strong>Leak #${i + 1}</strong>: +${leak.memoryGrowth} MB growth
          <p style="margin: 0.5rem 0;">
            Time Range: ${leak.timeRange.start}ms - ${leak.timeRange.end}ms<br>
            Memory: ${leak.earlyAvg} MB → ${leak.lateAvg} MB
          </p>
          <div style="margin-top: 0.5rem;">
            <strong>Suspect Components:</strong>
            <ul style="margin: 0.5rem 0; padding-left: 2rem;">
              ${leak.suspectComponents.map(c => 
                `<li>&lt;${c.name}&gt; (${c.renderCount} renders during leak)</li>`
              ).join('')}
            </ul>
          </div>
          <div style="background: #fff; padding: 0.75rem; margin-top: 0.5rem; border-radius: 4px;">
            <strong>Action Required:</strong>
            <ul style="margin: 0.5rem 0; padding-left: 2rem; color: #718096;">
              <li>Check useEffect cleanup functions</li>
              <li>Clear intervals/timeouts on unmount</li>
              <li>Unsubscribe from event listeners</li>
              <li>Review closure references to large objects</li>
            </ul>
          </div>
        </div>
      `;
    });
  } else {
    html += '<p style="color: #48bb78; font-weight: 600;">✅ No memory leaks detected!</p>';
  }

  return html;
}

function generateBundleHTML(bundleAnalysis) {
  let html = `
    <div class="metric-grid" style="margin-bottom: 2rem;">
      <div class="metric-card">
        <div class="metric-title">Total Bundle Size</div>
        <div class="metric-value">${bundleAnalysis.totalSizeKB}</div>
        <div style="color: #718096; margin-top: 0.5rem;">KB</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Large Components</div>
        <div class="metric-value">${bundleAnalysis.largeComponents.length}</div>
        <div style="color: #718096; margin-top: 0.5rem;">Candidates for code-splitting</div>
      </div>
      <div class="metric-card">
        <div class="metric-title">Size-Performance Correlation</div>
        <div class="metric-value">${bundleAnalysis.correlationCoefficient.toFixed(2)}</div>
        <div style="color: ${bundleAnalysis.correlationCoefficient > 0.5 ? CONFIG.report.chartColors.warning : CONFIG.report.chartColors.good}; margin-top: 0.5rem;">
          ${bundleAnalysis.correlationCoefficient > 0.5 ? 'Strong correlation' : 'Weak correlation'}
        </div>
      </div>
    </div>
  `;

  if (bundleAnalysis.largeComponents.length > 0) {
    html += `
      <h4 style="margin-bottom: 1rem;">Large Components</h4>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Size (KB)</th>
            <th>Render Count</th>
            <th>Avg Render Time</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>
          ${bundleAnalysis.largeComponents.slice(0, 15).map(c => `
            <tr>
              <td><strong>&lt;${c.component}&gt;</strong></td>
              <td>${c.sizeKB} KB</td>
              <td>${c.renderCount}</td>
              <td>${c.avgRenderTime}ms</td>
              <td><span class="badge ${c.severity}">${c.severity}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="issue-card info" style="margin-top: 1.5rem;">
        <strong>💡 Recommendations:</strong>
        <ul style="margin: 0.5rem 0; padding-left: 2rem;">
          <li>Use React.lazy() and Suspense for large components</li>
          <li>Consider code-splitting routes</li>
          <li>Review dependencies - remove unused imports</li>
          <li>Use dynamic imports for heavy third-party libraries</li>
        </ul>
      </div>
    `;
  }

  return html;
}

function generateChartScripts(fpsData, cpuData, memoryData, bottlenecks) {
  return `
    let performanceChart;
    const chartData = {
      fps: ${JSON.stringify(fpsData)},
      cpu: ${JSON.stringify(cpuData)},
      memory: ${JSON.stringify(memoryData)},
      bottlenecks: ${JSON.stringify(bottlenecks.map(b => ({ x: b.timestamp, y: b.fps })))}
    };

    function createChart(type) {
      const ctx = document.getElementById('performanceChart').getContext('2d');
      
      if (performanceChart) {
        performanceChart.destroy();
      }

      const config = {
        fps: {
          label: 'FPS',
          data: chartData.fps,
          borderColor: '${CONFIG.report.chartColors.fps}',
          yLabel: 'Frames Per Second'
        },
        cpu: {
          label: 'CPU Usage',
          data: chartData.cpu,
          borderColor: '${CONFIG.report.chartColors.cpu}',
          yLabel: 'CPU %'
        },
        memory: {
          label: 'Memory Usage',
          data: chartData.memory,
          borderColor: '${CONFIG.report.chartColors.memory}',
          yLabel: 'Memory (MB)'
        }
      };

      const selectedConfig = config[type];

      performanceChart = new Chart(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: selectedConfig.label,
              data: selectedConfig.data,
              borderColor: selectedConfig.borderColor,
              backgroundColor: selectedConfig.borderColor + '20',
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
              tension: 0.4
            },
            ...(type === 'fps' ? [{
              label: 'Frame Drops',
              data: chartData.bottlenecks,
              borderColor: '${CONFIG.report.chartColors.critical}',
              backgroundColor: '${CONFIG.report.chartColors.critical}',
              pointRadius: 5,
              pointHoverRadius: 7,
              showLine: false
            }] : [])
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: 'Time (ms)'
              }
            },
            y: {
              title: {
                display: true,
                text: selectedConfig.yLabel
              },
              beginAtZero: type !== 'fps'
            }
          }
        }
      });
    }

    createChart('fps');

    function switchChart(type) {
      document.querySelectorAll('.chart-container .tab').forEach(tab => {
        tab.classList.remove('active');
      });
      event.target.classList.add('active');
      createChart(type);
    }
  `;
}

function generateTabScript() {
  return `
    function switchTab(tabName) {
      document.querySelectorAll('.section .tab').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      event.target.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    }
  `;
}

function generateTreeScript() {
  return `
    document.addEventListener('click', function(e) {
      if (e.target.closest('.tree-node.has-children')) {
        const node = e.target.closest('.tree-node');
        node.classList.toggle('collapsed');
      }
    });
  `;
}

module.exports = { generateHTMLReport };
