const fs = require("fs");
const path = require("path");
const { calculateStats } = require("../utils/stats");
const CONFIG = require("../config");

function generateHTMLReport(data) {
  const {
    flashlightMeasures,
    bottlenecks,
    reRenderIssues,
    memoryAnalysis,
    hierarchyIssues,
    bundleAnalysis,
    hierarchyTree,
    flows = [],
    anomalies = [],
    concurrentAnalysis,
    phaseAnalysis = [],
    animations = [],
    prediction,
    automatedFixes = [],
    executiveSummary = "",
  } = data;

  const fpsData = flashlightMeasures.map((m) => ({ x: m.time, y: m.fps }));
  const cpuData = flashlightMeasures.map((m) => ({ x: m.time, y: m.cpuTotal }));
  const memoryData = memoryAnalysis.timeline.map((m) => ({
    x: m.timestamp,
    y: m.value,
  }));

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Analysis Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <style>
    :root {
      --primary: #667eea;
      --primary-dark: #5568d3;
      --secondary: #764ba2;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --info: #3b82f6;
      --bg-primary: #0f172a;
      --bg-secondary: #1e293b;
      --bg-tertiary: #334155;
      --text-primary: #f1f5f9;
      --text-secondary: #cbd5e1;
      --text-muted: #94a3b8;
      --border: #334155;
      --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
      --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
      --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    [data-theme="light"] {
      --bg-primary: #ffffff;
      --bg-secondary: #f8fafc;
      --bg-tertiary: #f1f5f9;
      --text-primary: #0f172a;
      --text-secondary: #475569;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      transition: var(--transition);
      overflow-x: hidden;
    }

    /* Animated Background */
    .animated-bg {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      opacity: 0.03;
    }

    .animated-bg::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(102, 126, 234, 0.1) 1px, transparent 1px);
      background-size: 50px 50px;
      animation: moveBackground 20s linear infinite;
    }

    @keyframes moveBackground {
      0% { transform: translate(0, 0); }
      100% { transform: translate(50px, 50px); }
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      padding: 3rem 2rem;
      position: relative;
      overflow: hidden;
      box-shadow: var(--shadow-lg);
    }

    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 40%;
      height: 200%;
      background: rgba(255, 255, 255, 0.1);
      transform: rotate(-15deg);
      animation: shimmer 3s ease-in-out infinite;
    }

    @keyframes shimmer {
      0%, 100% { opacity: 0.1; }
      50% { opacity: 0.2; }
    }

    .header-content {
      max-width: 1400px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }

    .header h1 {
      font-size: 2.5rem;
      font-weight: 800;
      color: white;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .header-icon {
      animation: bounce 2s ease-in-out infinite;
    }

    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }

    .header-meta {
      color: rgba(255, 255, 255, 0.9);
      display: flex;
      gap: 2rem;
      flex-wrap: wrap;
      align-items: center;
    }

    .theme-toggle {
      position: fixed;
      top: 2rem;
      right: 2rem;
      z-index: 1000;
      background: #f8fafc;
      color: #0f172a;
      border: 2px solid var(--border);
      border-radius: 50px;
      padding: 0.75rem 1.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      box-shadow: var(--shadow);
      transition: var(--transition);
    }

    [data-theme="light"] .theme-toggle {
      background: #1e293b;
      color: #f8fafc;
    }

    .theme-toggle:hover {
      transform: scale(1.05);
      box-shadow: var(--shadow-lg);
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    /* Health Score - Animated Circle */
    .health-score {
      background: var(--bg-secondary);
      border-radius: 20px;
      padding: 3rem;
      margin: 2rem 0;
      box-shadow: var(--shadow-lg);
      text-align: center;
      position: relative;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .health-score::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: conic-gradient(from 0deg, transparent, var(--primary), transparent);
      animation: rotate 4s linear infinite;
      opacity: 0.1;
    }

    @keyframes rotate {
      100% { transform: rotate(360deg); }
    }

    .score-container {
      position: relative;
      z-index: 1;
    }

    .score-circle {
      width: 250px;
      height: 250px;
      margin: 0 auto 2rem;
      position: relative;
    }

    .score-circle svg {
      transform: rotate(-90deg);
    }

    .score-circle-bg {
      fill: none;
      stroke: var(--border);
      stroke-width: 12;
    }

    .score-circle-progress {
      fill: none;
      stroke: url(#scoreGradient);
      stroke-width: 12;
      stroke-linecap: round;
      stroke-dasharray: 628;
      stroke-dashoffset: 628;
      animation: fillCircle 2s ease-out forwards;
      filter: drop-shadow(0 0 10px rgba(102, 126, 234, 0.5));
    }

    @keyframes fillCircle {
      to { stroke-dashoffset: var(--dash-offset); }
    }

    .score-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
    }

    .score-value {
      font-size: 4rem;
      font-weight: 900;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      animation: countUp 2s ease-out;
    }

    @keyframes countUp {
      from { opacity: 0; transform: scale(0.5); }
      to { opacity: 1; transform: scale(1); }
    }

    .score-label {
      font-size: 0.875rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 0.5rem;
    }

    .score-status {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1rem;
    }

    /* Metric Cards - Glassmorphism */
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }

    .metric-card {
      background: var(--bg-secondary);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      padding: 2rem;
      border-radius: 16px;
      box-shadow: var(--shadow);
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }

    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      transform: scaleX(0);
      transition: var(--transition);
    }

    .metric-card:hover {
      transform: translateY(-8px);
      box-shadow: var(--shadow-lg);
    }

    .metric-card:hover::before {
      transform: scaleX(1);
    }

    .metric-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }

    .metric-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .metric-title {
      font-size: 0.875rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }

    .metric-value {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1;
      margin: 0.5rem 0;
    }

    .metric-change {
      font-size: 0.875rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .metric-change.positive { color: var(--success); }
    .metric-change.negative { color: var(--danger); }
    .metric-change.neutral { color: var(--text-muted); }

    /* Charts - Enhanced */
    .chart-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      padding: 2rem;
      border-radius: 20px;
      margin: 2rem 0;
      box-shadow: var(--shadow-lg);
    }

    .chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .section-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .chart-controls {
      display: flex;
      gap: 0.5rem;
    }

    .chart-btn {
      padding: 0.75rem 1.5rem;
      border: 2px solid var(--border);
      background: transparent;
      color: var(--text-secondary);
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: var(--transition);
      font-size: 0.875rem;
    }

    .chart-btn:hover {
      border-color: var(--primary);
      color: var(--primary);
      transform: translateY(-2px);
    }

    .chart-btn.active {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .chart-wrapper {
      position: relative;
      height: 400px;
      margin-top: 1.5rem;
    }

    /* Tabs - Modern Pills */
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      padding: 0.5rem;
      background: var(--bg-tertiary);
      border-radius: 16px;
      border: 1px solid var(--border);
    }

    .tab {
      padding: 1rem 1.5rem;
      cursor: pointer;
      border-radius: 12px;
      transition: var(--transition);
      font-weight: 600;
      font-size: 0.875rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      position: relative;
      overflow: hidden;
    }

    .tab::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      opacity: 0;
      transition: var(--transition);
      z-index: -1;
    }

    .tab:hover {
      color: var(--text-primary);
      background: var(--bg-secondary);
    }

    .tab.active {
      color: white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }

    .tab.active::before {
      opacity: 1;
    }

    .tab-badge {
      background: rgba(255, 255, 255, 0.2);
      padding: 0.25rem 0.5rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .tab.active .tab-badge {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Tables - Modern Design */
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin: 1.5rem 0;
    }

    thead {
      background: var(--bg-tertiary);
    }

    th {
      padding: 1rem 1.5rem;
      text-align: left;
      font-weight: 700;
      color: var(--text-secondary);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 1px;
      border-bottom: 2px solid var(--border);
    }

    th:first-child {
      border-radius: 12px 0 0 0;
    }

    th:last-child {
      border-radius: 0 12px 0 0;
    }

    tbody tr {
      background: var(--bg-secondary);
      transition: var(--transition);
      border-bottom: 1px solid var(--border);
    }

    tbody tr:hover {
      background: var(--bg-tertiary);
      transform: scale(1.01);
    }

    td {
      padding: 1.25rem 1.5rem;
      color: var(--text-primary);
    }

    /* Badges - Animated */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 50px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }

    .badge.critical {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
    }

    .badge.warning {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }

    .badge.good {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .badge.info {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
    }

    /* Issue Cards - Enhanced */
    .issue-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-left: 4px solid var(--danger);
      padding: 1.5rem;
      margin: 1rem 0;
      border-radius: 12px;
      transition: var(--transition);
      position: relative;
      overflow: hidden;
    }

    .issue-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
      background: linear-gradient(180deg, var(--danger), transparent);
    }

    .issue-card:hover {
      transform: translateX(8px);
      box-shadow: var(--shadow-lg);
    }

    .issue-card.warning {
      border-left-color: var(--warning);
    }

    .issue-card.warning::before {
      background: linear-gradient(180deg, var(--warning), transparent);
    }

    .issue-card.info {
      border-left-color: var(--info);
    }

    .issue-card.info::before {
      background: linear-gradient(180deg, var(--info), transparent);
    }

    /* Component Tree - Interactive */
    .component-tree {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      background: var(--bg-tertiary);
      padding: 1.5rem;
      border-radius: 12px;
      overflow-x: auto;
      border: 1px solid var(--border);
      max-height: 600px;
      overflow-y: auto;
    }

    .tree-node {
      padding: 0.5rem;
      margin: 0.25rem 0;
      border-radius: 8px;
      transition: var(--transition);
      cursor: default;
    }

    .tree-node:hover {
      background: var(--bg-secondary);
    }

    .tree-node.has-children {
      cursor: pointer;
      position: relative;
    }

    .tree-node.has-children::before {
      content: '▸';
      position: absolute;
      left: -1rem;
      transition: var(--transition);
    }

    .tree-node.has-children.expanded::before {
      content: '▾';
      color: var(--primary);
    }

    .tree-node.collapsed > .tree-children {
      display: none;
    }

    /* Loading Animation */
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Tooltip */
    .tooltip {
      position: relative;
      cursor: help;
    }

    .tooltip::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%) translateY(-8px);
      padding: 0.5rem 1rem;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 0.875rem;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: var(--transition);
      box-shadow: var(--shadow-lg);
    }

    .tooltip:hover::after {
      opacity: 1;
      transform: translateX(-50%) translateY(-4px);
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
      color: var(--text-muted);
    }

    .empty-state-icon {
      font-size: 4rem;
      margin-bottom: 1rem;
      opacity: 0.5;
    }

    .empty-state-text {
      font-size: 1.125rem;
      font-weight: 600;
    }

    /* Progress Bar */
    .progress-bar {
      width: 100%;
      height: 8px;
      background: var(--border);
      border-radius: 4px;
      overflow: hidden;
      margin: 1rem 0;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--secondary));
      border-radius: 4px;
      transition: width 1s ease-out;
      box-shadow: 0 0 10px rgba(102, 126, 234, 0.5);
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-secondary);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border);
      border-radius: 6px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--primary);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.75rem;
      }

      .metric-grid {
        grid-template-columns: 1fr;
      }

      .tabs {
        flex-direction: column;
      }

      .chart-wrapper {
        height: 300px;
      }

      .theme-toggle {
        top: 1rem;
        right: 1rem;
      }
    }

    /* Print Styles */
    @media print {
      .theme-toggle,
      .chart-controls {
        display: none;
      }

      .chart-wrapper {
        height: 300px;
      }

      body {
        background: white;
        color: black;
      }
    }

    /* Executive Summary */
    .executive-summary {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
      border: 2px solid var(--primary);
      border-radius: 20px;
      padding: 2rem;
      margin: 2rem 0;
      position: relative;
      overflow: hidden;
    }

    .executive-summary::before {
      content: '💼';
      position: absolute;
      top: -20px;
      right: -20px;
      font-size: 8rem;
      opacity: 0.1;
    }

    .executive-summary h3 {
      color: var(--primary);
      margin-bottom: 1rem;
      font-size: 1.5rem;
    }

    .executive-summary p {
      font-size: 1.1rem;
      line-height: 1.8;
      color: var(--text-secondary);
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
  <div class="animated-bg"></div>
  
  <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
    <i class="fas fa-sun" id="theme-icon"></i>
    <span id="theme-text">Light Mode</span>
  </button>

  <div class="header">
    <div class="header-content">
      <h1>
        <span class="header-icon">🚀</span>
        React Native Performance Analysis
      </h1>
      <div class="header-meta">
        <span><i class="far fa-calendar"></i> ${new Date().toLocaleDateString()}</span>
        <span><i class="far fa-clock"></i> ${new Date().toLocaleTimeString()}</span>
        <span><i class="fas fa-chart-line"></i> ${flashlightMeasures.length} samples analyzed</span>
      </div>
    </div>
  </div>

  <div class="container">
    ${generateExecutiveSummaryHTML(data)}
    ${generateHealthScoreHTML(data)}
    ${generateMetricGridHTML(data)}
    ${generateHeatmapHTML(reRenderIssues)}
    ${generateChartsHTML(data)}
    ${generateIssueTabsHTML(data)}
  </div>

  <script>
    // Theme Toggle
    let currentTheme = 'dark';
    
    function toggleTheme() {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', currentTheme);
      
      const icon = document.getElementById('theme-icon');
      const text = document.getElementById('theme-text');
      
      if (currentTheme === 'light') {
        icon.className = 'fas fa-moon';
        text.textContent = 'Dark Mode';
      } else {
        icon.className = 'fas fa-sun';
        text.textContent = 'Light Mode';
      }
      
      // Recreate chart with new theme
      if (window.performanceChart) {
        const currentType = window.currentChartType || 'fps';
        createChart(currentType);
      }
    }

    // Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    // Intersection Observer for animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, observerOptions);

    document.querySelectorAll('.metric-card, .issue-card, .chart-container').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
      observer.observe(el);
    });

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
  if (!data.executiveSummary) return "";

  return `
    <div class="executive-summary">
      <h3><i class="fas fa-file-alt"></i> Executive Summary</h3>
      <p>${data.executiveSummary.replace(/\n/g, "<br>")}</p>
    </div>
  `;
}

function generateHealthScoreHTML(data) {
  const { flashlightMeasures, bottlenecks } = data;
  const healthScore = Math.max(
    0,
    100 - Math.round((bottlenecks.length / flashlightMeasures.length) * 100),
  );

  const scoreColor =
    healthScore >= 80 ? "#10b981" : healthScore >= 60 ? "#f59e0b" : "#ef4444";
  const statusText =
    healthScore >= 90
      ? "✅ Excellent Performance"
      : healthScore >= 80
        ? "✅ Good Performance"
        : healthScore >= 60
          ? "⚠️ Needs Improvement"
          : "❌ Critical Issues Detected";

  const circumference = 2 * Math.PI * 100;
  const dashOffset = circumference - (healthScore / 100) * circumference;

  return `
    <div class="health-score">
      <div class="score-container">
        <div class="score-circle">
          <svg width="250" height="250" viewBox="0 0 220 220">
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:${scoreColor};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${scoreColor};stop-opacity:0.6" />
              </linearGradient>
            </defs>
            <circle class="score-circle-bg" cx="110" cy="110" r="100"/>
            <circle class="score-circle-progress" cx="110" cy="110" r="100" 
                    style="--dash-offset: ${dashOffset}"/>
          </svg>
          <div class="score-text">
            <div class="score-value" data-target="${healthScore}">0</div>
            <div class="score-label">Health Score</div>
          </div>
        </div>
        <div class="score-status" style="color: ${scoreColor}">
          ${statusText}
        </div>
      </div>
    </div>

    <script>
      // Animated counter
      (function() {
        const scoreElement = document.querySelector('.score-value');
        const target = parseInt(scoreElement.getAttribute('data-target'));
        let current = 0;
        const increment = target / 100;
        const duration = 2000;
        const stepTime = duration / 100;

        const counter = setInterval(() => {
          current += increment;
          if (current >= target) {
            scoreElement.textContent = target;
            clearInterval(counter);
          } else {
            scoreElement.textContent = Math.floor(current);
          }
        }, stepTime);
      })();
    </script>
  `;
}

function generateMetricGridHTML(data) {
  const {
    flashlightMeasures,
    bottlenecks,
    reRenderIssues,
    memoryAnalysis,
    hierarchyIssues,
  } = data;
  const fpsStats = calculateStats(flashlightMeasures.map((m) => m.fps));
  const cpuStats = calculateStats(flashlightMeasures.map((m) => m.cpuTotal));

  const metrics = [
    {
      icon: "fa-tachometer-alt",
      title: "Average FPS",
      value: Math.round(fpsStats.avg),
      target: "Target: 60 FPS",
      status: fpsStats.avg >= 55 ? "good" : "critical",
      change: fpsStats.avg >= 55 ? "positive" : "negative",
    },
    {
      icon: "fa-exclamation-triangle",
      title: "Frame Drops",
      value: bottlenecks.length,
      target: `${((bottlenecks.length / flashlightMeasures.length) * 100).toFixed(1)}% of frames`,
      status: bottlenecks.length < 10 ? "good" : "critical",
      change: "neutral",
    },
    {
      icon: "fa-sync",
      title: "Re-render Issues",
      value: reRenderIssues.length,
      target: "Components rendering excessively",
      status: reRenderIssues.length < 5 ? "good" : "warning",
      change: "neutral",
    },
    {
      icon: "fa-memory",
      title: "Memory Trend",
      value:
        memoryAnalysis.trend === "increasing"
          ? "📈"
          : memoryAnalysis.trend === "decreasing"
            ? "📉"
            : "➡️",
      target: `${memoryAnalysis.avgMemory} MB avg`,
      status: memoryAnalysis.trend === "increasing" ? "warning" : "good",
      change: memoryAnalysis.trend === "increasing" ? "negative" : "positive",
    },
    {
      icon: "fa-microchip",
      title: "CPU Usage (P95)",
      value: `${Math.round(cpuStats.p95)}%`,
      target: `Avg: ${Math.round(cpuStats.avg)}%`,
      status: cpuStats.p95 > 70 ? "critical" : "good",
      change: cpuStats.p95 > 70 ? "negative" : "positive",
    },
    {
      icon: "fa-project-diagram",
      title: "Parent-Child Cascades",
      value: hierarchyIssues.length,
      target: "Unnecessary re-render chains",
      status: hierarchyIssues.length < 3 ? "good" : "warning",
      change: "neutral",
    },
    {
      icon: "fa-route",
      title: "Heavy Transitions",
      value: (data.navigationAnalysis || []).filter(n => n.severity !== 'good').length,
      target: "Slow screen changes",
      status: (data.navigationAnalysis || []).some(n => n.severity === 'critical') ? "critical" : "good",
      change: "neutral",
    },
    {
      icon: "fa-list-ul",
      title: "List Issues",
      value: (data.flatListAnalysis || []).length,
      target: "FlatList optimizations",
      status: (data.flatListAnalysis || []).length > 2 ? "warning" : "good",
      change: "neutral",
    },
  ];

  return `
    <div class="metric-grid">
      ${metrics
        .map(
          (metric, index) => `
        <div class="metric-card" style="animation-delay: ${index * 0.1}s">
          <div class="metric-header">
            <div class="metric-icon">
              <i class="fas ${metric.icon}"></i>
            </div>
          </div>
          <div class="metric-title">${metric.title}</div>
          <div class="metric-value">${metric.value}</div>
          <div class="metric-change ${metric.change}">
            <i class="fas ${metric.change === "positive" ? "fa-arrow-up" : metric.change === "negative" ? "fa-arrow-down" : "fa-minus"}"></i>
            ${metric.target}
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function generateChartsHTML(data) {
  return `
    <div class="chart-container">
      <div class="chart-header">
        <h3 class="section-title">
          <i class="fas fa-chart-area"></i>
          Performance Timeline
        </h3>
        <div class="chart-controls">
          <button class="chart-btn active" onclick="switchChart('fps')">
            <i class="fas fa-tachometer-alt"></i> FPS
          </button>
          <button class="chart-btn" onclick="switchChart('cpu')">
            <i class="fas fa-microchip"></i> CPU
          </button>
          <button class="chart-btn" onclick="switchChart('memory')">
            <i class="fas fa-memory"></i> Memory
          </button>
        </div>
      </div>
      <div class="chart-wrapper">
        <canvas id="performanceChart"></canvas>
      </div>
    </div>
  `;
}

function generateIssueTabsHTML(data) {
  const {
    bottlenecks,
    reRenderIssues,
    hierarchyIssues,
    memoryAnalysis,
    bundleAnalysis,
    hierarchyTree,
    flows = [],
    anomalies = [],
    concurrentAnalysis,
    phaseAnalysis = [],
    animations = [],
    prediction,
    automatedFixes = [],
  } = data;

  const tabs = [
    {
      id: "bottlenecks",
      icon: "fa-exclamation-triangle",
      label: "Bottlenecks",
      count: bottlenecks.length,
    },
    {
      id: "rerenders",
      icon: "fa-sync",
      label: "Re-renders",
      count: reRenderIssues.length,
    },
    {
      id: "hierarchy",
      icon: "fa-sitemap",
      label: "Component Tree",
      count: (data.hierarchyTree || []).length,
    },
    {
      id: "memory",
      icon: "fa-memory",
      label: "Memory",
      count: memoryAnalysis.leaks.length,
    },
    { id: "flows", icon: "fa-stream", label: "Flows", count: flows.length },
    {
      id: "anomalies",
      icon: "fa-circle-exclamation",
      label: "Anomalies",
      count: anomalies.length,
    },
    {
      id: "concurrent",
      icon: "fa-atom",
      label: "Concurrent",
      count:
        (concurrentAnalysis?.transitions?.length || 0) +
        (concurrentAnalysis?.interruptedRenders?.length || 0),
    },
    {
      id: "phases",
      icon: "fa-hourglass-half",
      label: "Phases",
      count: phaseAnalysis.length,
    },
    {
      id: "animations",
      icon: "fa-play-circle",
      label: "Animations",
      count: animations.length,
    },
    {
      id: "navigation",
      icon: "fa-route",
      label: "Navigation",
      count: (data.navigationAnalysis || []).length,
    },
    {
      id: "lists",
      icon: "fa-list-ul",
      label: "Lists",
      count: (data.flatListAnalysis || []).length,
    },
    {
      id: "jsThread",
      icon: "fa-microchip",
      label: "JS Thread",
      count: (data.jsBottlenecks || []).length,
    },
    {
      id: "prediction",
      icon: "fa-brain",
      label: "Prediction",
      count: prediction?.length || 0,
    },
    {
      id: "fixes",
      icon: "fa-magic",
      label: "Fixes",
      count: automatedFixes.length,
    },
  ];

  if (bundleAnalysis) {
    tabs.push({
      id: "bundle",
      icon: "fa-box",
      label: "Bundle Size",
      count: bundleAnalysis.largeComponents?.length || 0,
    });
  }

  return `
    <div class="section">
      <div class="tabs">
        ${tabs
          .map(
            (tab, index) => `
          <div class="tab ${index === 0 ? "active" : ""}" onclick="switchTab('${tab.id}')">
            <i class="fas ${tab.icon}"></i>
            ${tab.label}
            <span class="tab-badge">${tab.count}</span>
          </div>
        `,
          )
          .join("")}
      </div>

      <div id="bottlenecks" class="tab-content active">
        ${generateBottlenecksTableHTML(bottlenecks)}
      </div>

      <div id="rerenders" class="tab-content">
        ${generateCommitAnalysisHTML(data.commits)}
        ${generateReRendersTableHTML(reRenderIssues)}
      </div>

      <div id="hierarchy" class="tab-content">
        ${generateHierarchyHTML(hierarchyIssues, hierarchyTree, data.contextCascades)}
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
        ${generateConcurrentHTML(concurrentAnalysis)}
      </div>

      <div id="phases" class="tab-content">
        ${generatePhasesHTML(phaseAnalysis)}
      </div>

      <div id="animations" class="tab-content">
        ${generateAnimationsHTML(animations)}
      </div>

      <div id="navigation" class="tab-content">
        ${generateNavigationHTML(data.navigationAnalysis)}
      </div>

      <div id="lists" class="tab-content">
        ${generateListsHTML(data.flatListAnalysis)}
      </div>

      <div id="jsThread" class="tab-content">
        ${generateJSThreadHTML(data.jsBottlenecks)}
      </div>

      <div id="prediction" class="tab-content">
        ${generatePredictionHTML(prediction)}
      </div>

      <div id="fixes" class="tab-content">
        ${generateFixesHTML(automatedFixes)}
      </div>

      ${
        bundleAnalysis
          ? `
      <div id="bundle" class="tab-content">
        ${generateBundleHTML(bundleAnalysis)}
      </div>
      `
          : ""
      }
    </div>
  `;
}

function generateBottlenecksTableHTML(bottlenecks) {
  if (bottlenecks.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No performance bottlenecks detected!</div>
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr>
          <th><i class="far fa-clock"></i> Time</th>
          <th><i class="fas fa-tachometer-alt"></i> FPS</th>
          <th><i class="fas fa-microchip"></i> CPU</th>
          <th><i class="fas fa-code"></i> Component</th>
          <th><i class="fas fa-signal"></i> Confidence</th>
          <th><i class="fas fa-exclamation-circle"></i> Severity</th>
        </tr>
      </thead>
      <tbody>
        ${bottlenecks
          .slice(0, 20)
          .map((b) => {
            const candidate = b.candidates ? b.candidates[0] : null;
            const severityClass =
              b.severity > 0.7
                ? "critical"
                : b.severity > 0.4
                  ? "warning"
                  : "good";

            return `
            <tr>
              <td>${b.timestamp}ms</td>
              <td><strong>${b.fps}</strong> FPS</td>
              <td>${b.cpuTotal}%</td>
              <td>${candidate && candidate.component ? `<code>&lt;${candidate.component}&gt;</code>` : "<em>Native layer</em>"}</td>
              <td>${
                candidate && candidate.confidence
                  ? `
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${candidate.confidence * 100}%"></div>
                </div>
                ${(candidate.confidence * 100).toFixed(0)}%
              `
                  : "N/A"
              }</td>
              <td><span class="badge ${severityClass}">${(b.severity * 100).toFixed(0)}%</span></td>
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function generateReRendersTableHTML(reRenderIssues) {
  if (reRenderIssues.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No excessive re-renders detected!</div>
      </div>
    `;
  }

  return `
    <h4 style="margin: 3rem 0 1rem;"><i class="fas fa-sync"></i> Excessive Re-renders (Quantitative Analysis)</h4>
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Renders (Wasted)</th>
          <th>Primary Cause</th>
          <th>Confidence</th>
          <th>Avg Time</th>
          <th>Total Time</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        ${reRenderIssues.slice(0, 25).map((issue) => {
          const severityClass =
            issue.severity > 0.7 ? "critical" : issue.severity > 0.4 ? "warning" : "good";
          const wastedPercent = (
            (issue.wastedRenders / issue.renderCount) *
            100
          ).toFixed(0);

          return `
            <tr>
              <td>
                <strong><code>&lt;${issue.component}&gt;</code></strong>
                ${
                  issue.unstableProps && issue.unstableProps.length > 0
                    ? `<br><small style="color: var(--danger)">⚠️ Unstable: ${issue.unstableProps.slice(0, 2).join(", ")}</small>`
                    : ""
                }
              </td>
              <td>
                ${issue.renderCount} 
                <span class="badge ${issue.wastedRenders > 0 ? "warning" : "good"}" style="font-size: 0.6rem; padding: 0.1rem 0.4rem; text-transform: none;">
                  ${wastedPercent}% wasted
                </span>
              </td>
              <td><span class="badge info" style="text-transform: none; font-weight: 500;">${issue.primaryCause || "Mixed"}</span></td>
              <td>
                <div class="progress-bar" style="height: 8px; width: 60px; display: inline-block; margin-right: 5px;">
                  <div class="progress-fill" style="width: ${issue.confidence || 0}%"></div>
                </div>
                <small>${issue.confidence || 0}%</small>
              </td>
              <td>${issue.avgRenderTime}ms</td>
              <td><strong>${issue.totalTimeSpent}ms</strong></td>
              <td><span class="badge ${severityClass}">${(issue.severity * 100).toFixed(0)}%</span></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function generateHeatmapHTML(reRenderIssues) {
  const topByTime = [...reRenderIssues]
    .sort((a, b) => b.totalTimeSpent - a.totalTimeSpent)
    .slice(0, 5);
  const totalTime = reRenderIssues.reduce(
    (sum, i) => sum + parseFloat(i.totalTimeSpent),
    0,
  );

  return `
    <div class="chart-container" style="margin-top: 2rem;">
      <h3 class="section-title"><i class="fas fa-fire"></i> Component Cost Heatmap (Top Contributors)</h3>
      <div style="margin-top: 1.5rem;">
        ${topByTime
          .map((issue) => {
            const percent = ((issue.totalTimeSpent / totalTime) * 100).toFixed(1);
            return `
            <div style="margin-bottom: 1rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span><code>&lt;${issue.component}&gt;</code></span>
                <span>${issue.totalTimeSpent}ms (${percent}%)</span>
              </div>
              <div class="progress-bar" style="height: 12px;">
                <div class="progress-fill" style="width: ${percent}%;"></div>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function generateCommitAnalysisHTML(commits = []) {
  const worstCommits = [...commits]
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  return `
    <h4 style="margin: 2rem 0 1rem;"><i class="fas fa-layer-group"></i> Worst Commits (Longest Render Cycles)</h4>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Duration</th>
          <th>Triggered By</th>
          <th>Main Contributors</th>
        </tr>
      </thead>
      <tbody>
        ${worstCommits
          .map((c) => {
            const mainContributors = c.components
              .sort((a, b) => b.duration - a.duration)
              .slice(0, 3)
              .map((comp) => `<code>&lt;${comp.name}&gt;</code>`)
              .join(", ");

            const updaters =
              c.updaters && c.updaters.length > 0
                ? c.updaters.map((u) => u.name).join(", ")
                : "Unknown";

            return `
            <tr>
              <td>${Math.round(c.timestamp)}ms</td>
              <td><strong style="color: ${c.duration > 16 ? "var(--danger)" : "var(--text-primary)"}">${c.duration.toFixed(2)}ms</strong></td>
              <td><small>${updaters}</small></td>
              <td><small>${mainContributors}</small></td>
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function generateHierarchyHTML(hierarchyIssues, hierarchyTree, contextCascades = []) {
  let html =
    '<h4 style="margin-bottom: 1.5rem;"><i class="fas fa-project-diagram"></i> Parent-Child Re-render Cascades</h4>';

  if (hierarchyIssues.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No cascading re-render issues detected!</div>
      </div>
    `;
  } else {
    hierarchyIssues.slice(0, 10).forEach((issue) => {
      const severityClass = issue.severity === "high" ? "critical" : "warning";
      html += `
        <div class="issue-card ${severityClass}">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <div>
              <strong style="font-size: 1.125rem;">
                <code>&lt;${issue.parent}&gt;</code> → <code>&lt;${issue.child}&gt;</code>
              </strong>
            </div>
            <span class="badge ${severityClass}">${issue.cascadePercentage}% cascade rate</span>
          </div>
          <p style="margin: 0.75rem 0;">
            Child renders <strong>${issue.cascadingRenders}/${issue.totalChildRenders}</strong> times due to parent re-renders
          </p>
          <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
            <strong><i class="fas fa-lightbulb"></i> Recommendation:</strong>
            <p style="margin: 0.5rem 0 0 0; color: var(--text-secondary);">${issue.recommendation}</p>
          </div>
        </div>
      `;
    });
  }

  if (contextCascades && contextCascades.length > 0) {
    html += '<h4 style="margin: 3rem 0 1.5rem;"><i class="fas fa-water"></i> Context Cascades</h4>';
    contextCascades.forEach(cascade => {
      const severityClass = cascade.severity === 'high' ? 'critical' : 'warning';
      html += `
        <div class="issue-card ${severityClass}">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <div>
              <strong style="font-size: 1.125rem;">Context Update @ ${cascade.timestamp}ms</strong>
            </div>
            <span class="badge ${severityClass}">${cascade.affectedCount} components affected</span>
          </div>
          <p style="margin: 0.75rem 0;">
            Total impact: <strong>${cascade.totalCost}ms</strong> across the tree.
          </p>
          ${cascade.sources.length > 0 ? `<p><small>Possible sources: ${cascade.sources.join(', ')}</small></p>` : ''}
          <div style="margin-top: 1rem;">
            <small style="color: var(--text-muted);">Impacted components: ${cascade.components.join(', ')}${cascade.affectedCount > 10 ? '...' : ''}</small>
          </div>
        </div>
      `;
    });
  }

  html +=
    '<h4 style="margin: 3rem 0 1.5rem;"><i class="fas fa-sitemap"></i> Component Hierarchy Tree</h4>';
  html += '<div class="component-tree">';

  if (hierarchyTree && hierarchyTree.length > 0) {
    hierarchyTree.forEach((root) => {
      html += renderTreeNode(root, 0);
    });
  } else {
    html +=
      '<div class="empty-state"><div class="empty-state-text">No hierarchy data available</div></div>';
  }

  html += "</div>";

  return html;
}

function renderTreeNode(node, depth) {
  const indent = "  ".repeat(depth);
  const hasChildren = node.children && node.children.length > 0;
  const nodeClass = hasChildren ? "has-children" : "";
  const hotPathClass = node.isHotPath ? "hot-path" : "";

  let html = `<div class="tree-node ${nodeClass} ${hotPathClass}" style="padding-left: ${depth * 2}rem; ${node.isHotPath ? "border-left: 2px solid var(--danger); background: rgba(239, 68, 68, 0.05);" : ""}" data-depth="${depth}">`;
  html += `${indent}<strong>&lt;${node.name}&gt;</strong> `;
  if (node.isHotPath) {
    html += `<span class="badge critical" style="font-size: 0.5rem; padding: 0.1rem 0.3rem;">HOT PATH</span> `;
  }
  html += `<span style="color: var(--text-muted);">(${node.renderCount} renders, total ${node.totalDuration}ms, avg ${node.avgRenderTime}ms)</span>`;

  if (hasChildren) {
    html += `<div class="tree-children">`;
    node.children.forEach((child) => {
      html += renderTreeNode(child, depth + 1);
    });
    html += `</div>`;
  }

  html += "</div>";

  return html;
}

function generateMemoryHTML(memoryAnalysis) {
  let html = `
    <div class="metric-grid" style="margin-bottom: 2rem;">
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">
            <i class="fas fa-chart-line"></i>
          </div>
        </div>
        <div class="metric-title">Trend</div>
        <div class="metric-value">${memoryAnalysis.trend === "increasing" ? "📈" : memoryAnalysis.trend === "decreasing" ? "📉" : "➡️"}</div>
        <div class="metric-change ${memoryAnalysis.trend === "increasing" ? "negative" : "positive"}">
          ${memoryAnalysis.trend.toUpperCase()}
        </div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">
            <i class="fas fa-memory"></i>
          </div>
        </div>
        <div class="metric-title">Average Memory</div>
        <div class="metric-value">${memoryAnalysis.avgMemory}</div>
        <div class="metric-change neutral">MB</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">
            <i class="fas fa-arrow-up"></i>
          </div>
        </div>
        <div class="metric-title">Peak Memory</div>
        <div class="metric-value">${memoryAnalysis.maxMemory}</div>
        <div class="metric-change neutral">MB</div>
      </div>
    </div>
  `;

  if (memoryAnalysis.leaks && memoryAnalysis.leaks.length > 0) {
    html +=
      '<h4 style="margin-bottom: 1.5rem; color: var(--danger);"><i class="fas fa-exclamation-triangle"></i> Potential Memory Leaks Detected</h4>';

    memoryAnalysis.leaks.forEach((leak, i) => {
      html += `
        <div class="issue-card critical" style="margin: 1.5rem 0;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <strong style="font-size: 1.25rem;">Leak #${i + 1}</strong>
            <span class="badge critical">+${leak.memoryGrowth} MB</span>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0;">
            <div>
              <div style="color: var(--text-muted); font-size: 0.875rem;">Time Range</div>
              <div style="font-weight: 600;">${leak.timeRange.start}ms - ${leak.timeRange.end}ms</div>
            </div>
            <div>
              <div style="color: var(--text-muted); font-size: 0.875rem;">Memory Growth</div>
              <div style="font-weight: 600;">${leak.earlyAvg} MB → ${leak.lateAvg} MB</div>
            </div>
          </div>

          <div style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: 12px; margin-top: 1rem;">
            <strong style="display: block; margin-bottom: 0.75rem;">
              <i class="fas fa-search"></i> Suspect Components:
            </strong>
            <ul style="margin: 0; padding-left: 1.5rem;">
              ${leak.suspectComponents
                .map(
                  (c) =>
                    `<li><code>&lt;${c.name}&gt;</code> <span style="color: var(--text-muted);">(${c.renderCount} renders during leak)</span></li>`,
                )
                .join("")}
            </ul>
          </div>

          <div style="background: rgba(239, 68, 68, 0.1); padding: 1.5rem; border-radius: 12px; margin-top: 1rem; border: 1px solid var(--danger);">
            <strong style="display: block; margin-bottom: 0.75rem; color: var(--danger);">
              <i class="fas fa-tools"></i> Action Required:
            </strong>
            <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary);">
              <li style="margin: 0.5rem 0;">Check useEffect cleanup functions</li>
              <li style="margin: 0.5rem 0;">Clear intervals/timeouts on unmount</li>
              <li style="margin: 0.5rem 0;">Unsubscribe from event listeners</li>
              <li style="margin: 0.5rem 0;">Review closure references to large objects</li>
            </ul>
          </div>
        </div>
      `;
    });
  } else {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text" style="color: var(--success);">No memory leaks detected!</div>
      </div>
    `;
  }

  return html;
}

function generateBundleHTML(bundleAnalysis) {
  let html = `
    <div class="metric-grid" style="margin-bottom: 2rem;">
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">
            <i class="fas fa-box"></i>
          </div>
        </div>
        <div class="metric-title">Total Bundle Size</div>
        <div class="metric-value">${bundleAnalysis.totalSizeKB}</div>
        <div class="metric-change neutral">KB</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
        </div>
        <div class="metric-title">Large Components</div>
        <div class="metric-value">${bundleAnalysis.largeComponents.length}</div>
        <div class="metric-change warning">Code-splitting candidates</div>
      </div>
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">
            <i class="fas fa-chart-line"></i>
          </div>
        </div>
        <div class="metric-title">Size-Performance Correlation</div>
        <div class="metric-value">${bundleAnalysis.correlationCoefficient.toFixed(2)}</div>
        <div class="metric-change ${bundleAnalysis.correlationCoefficient > 0.5 ? "negative" : "positive"}">
          ${bundleAnalysis.correlationCoefficient > 0.5 ? "Strong" : "Weak"} correlation
        </div>
      </div>
    </div>
  `;

  if (bundleAnalysis.largeComponents.length > 0) {
    html += `
      <h4 style="margin-bottom: 1.5rem;"><i class="fas fa-cubes"></i> Large Components</h4>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Size</th>
            <th>Renders</th>
            <th>Avg Time</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>
          ${bundleAnalysis.largeComponents
            .slice(0, 15)
            .map(
              (c) => `
            <tr>
              <td><strong><code>&lt;${c.component}&gt;</code></strong></td>
              <td><strong>${c.sizeKB} KB</strong></td>
              <td>${c.renderCount}</td>
              <td>${c.avgRenderTime}ms</td>
              <td><span class="badge ${c.severity}">${c.severity.toUpperCase()}</span></td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
      
      <div class="issue-card info" style="margin-top: 2rem;">
        <strong style="display: block; margin-bottom: 1rem; font-size: 1.125rem;">
          <i class="fas fa-lightbulb"></i> Optimization Recommendations
        </strong>
        <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary);">
          <li style="margin: 0.75rem 0;">Use React.lazy() and Suspense for large components</li>
          <li style="margin: 0.75rem 0;">Consider code-splitting routes</li>
          <li style="margin: 0.75rem 0;">Review dependencies - remove unused imports</li>
          <li style="margin: 0.75rem 0;">Use dynamic imports for heavy third-party libraries</li>
        </ul>
      </div>
    `;
  }

  return html;
}

function generateFlowsHTML(flows) {
  if (!flows || flows.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No configured user flows detected!</div>
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr><th>Flow</th><th>Duration</th><th>Budget</th><th>Avg FPS</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${flows
          .map(
            (f) => `
          <tr>
            <td><strong>${f.name}</strong></td>
            <td>${f.duration}ms</td>
            <td>&lt; ${f.budget.duration}ms</td>
            <td>${f.avgFPS} (target: ${f.budget.fps})</td>
            <td><span class="badge ${f.passed ? "good" : "critical"}">${f.passed ? "✅ PASSED" : "❌ FAILED"}</span></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function generateAnomaliesHTML(anomalies) {
  if (!anomalies || anomalies.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No statistical anomalies detected!</div>
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr><th>Time</th><th>Metric</th><th>Value</th><th>Expected</th><th>Deviation</th><th>Severity</th></tr>
      </thead>
      <tbody>
        ${anomalies
          .slice(0, 20)
          .map(
            (a) => `
          <tr>
            <td>${a.timestamp}ms</td>
            <td><strong>${a.metric.toUpperCase()}</strong></td>
            <td>${Math.round(a.value)}</td>
            <td>~${a.expected}</td>
            <td>${a.deviation}σ</td>
            <td><span class="badge ${a.severity === "critical" ? "critical" : a.severity === "high" ? "warning" : "info"}">${a.severity.toUpperCase()}</span></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function generateListsHTML(flatListAnalysis) {
  if (!flatListAnalysis || flatListAnalysis.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No Virtualized List issues detected.</div>
      </div>
    `;
  }

  return `
    <h4 style="margin-bottom: 1.5rem;"><i class="fas fa-list-ul"></i> FlatList & VirtualizedList Analysis</h4>
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Type</th>
          <th>Renders</th>
          <th>Wasted</th>
          <th>Avg Time</th>
          <th>Issues</th>
        </tr>
      </thead>
      <tbody>
        ${flatListAnalysis
          .map(
            (l) => `
          <tr>
            <td><strong><code>${l.component}</code></strong></td>
            <td><span class="badge info">${l.type}</span></td>
            <td>${l.renderCount}</td>
            <td><span class="badge ${l.wastedRenders > 0 ? "warning" : "good"}">${l.wastedRenders}</span></td>
            <td>${l.avgRenderTime}ms</td>
            <td>
              <ul style="margin: 0; padding-left: 1rem; font-size: 0.8rem;">
                ${l.issues.map((i) => `<li>${i}</li>`).join("")}
              </ul>
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
    
    <div class="issue-card info" style="margin-top: 2rem;">
      <strong style="display: block; margin-bottom: 1rem; font-size: 1.125rem;">
        <i class="fas fa-lightbulb"></i> FlatList Best Practices
      </strong>
      <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary);">
        <li style="margin: 0.75rem 0;">Use <code>getItemLayout</code> if all items have the same height to avoid dynamic measurement.</li>
        <li style="margin: 0.75rem 0;">Ensure <code>keyExtractor</code> returns stable, unique keys (avoid using index).</li>
        <li style="margin: 0.75rem 0;">Wrap <code>renderItem</code> components in <code>React.memo()</code>.</li>
        <li style="margin: 0.75rem 0;">Avoid anonymous functions in <code>renderItem</code>, <code>keyExtractor</code>, or <code>ListHeaderComponent</code>.</li>
        <li style="margin: 0.75rem 0;">Adjust <code>windowSize</code> and <code>initialNumToRender</code> for large datasets.</li>
      </ul>
    </div>
  `;
}

function generateNavigationHTML(navigationAnalysis) {
  if (!navigationAnalysis || navigationAnalysis.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">🚦</div>
        <div class="empty-state-text">No screen transitions detected in this trace.</div>
      </div>
    `;
  }

  return `
    <h4 style="margin-bottom: 1.5rem;"><i class="fas fa-route"></i> Screen Transition Analysis</h4>
    <table>
      <thead>
        <tr>
          <th>To Screen</th>
          <th>Time</th>
          <th>Commits</th>
          <th>Total Duration</th>
          <th>Avg Commit</th>
          <th>Impact</th>
        </tr>
      </thead>
      <tbody>
        ${navigationAnalysis
          .map(
            (n) => `
          <tr>
            <td><strong><code>${n.toScreen}</code></strong></td>
            <td>${n.timestamp}ms</td>
            <td>${n.commitCount}</td>
            <td><strong style="color: ${n.severity === "critical" ? "var(--danger)" : n.severity === "warning" ? "var(--warning)" : "inherit"}">${n.totalDuration}ms</strong></td>
            <td>${n.avgCommitDuration}ms</td>
            <td><span class="badge ${n.severity === "critical" ? "critical" : n.severity === "warning" ? "warning" : "good"}">${n.impact}</span></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function generateConcurrentHTML(analysis) {
  if (
    !analysis ||
    ((!analysis.transitions || analysis.transitions.length === 0) &&
      (!analysis.interruptedRenders ||
        analysis.interruptedRenders.length === 0))
  ) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">ℹ️</div>
        <div class="empty-state-text">No concurrent features detected in this trace.</div>
      </div>
    `;
  }

  let html = '<h4><i class="fas fa-atom"></i> Concurrent React Analysis</h4>';

  if (analysis.transitions && analysis.transitions.length > 0) {
    html +=
      '<h5 style="margin-top: 1.5rem; margin-bottom: 1rem;">Transitions</h5>';
    html += `
      <table>
        <thead>
          <tr><th>Time</th><th>Duration</th><th>Components</th><th>Interrupted</th></tr>
        </thead>
        <tbody>
          ${analysis.transitions
            .map(
              (t) => `
            <tr>
              <td>${t.timestamp}ms</td>
              <td>${t.duration}ms</td>
              <td>${t.components.join(", ")}</td>
              <td>${t.wasInterrupted ? '<span class="badge warning">⚠️ Yes</span>' : "No"}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  if (analysis.interruptedRenders && analysis.interruptedRenders.length > 0) {
    html +=
      '<h5 style="margin-top: 2rem; margin-bottom: 1rem;">Interrupted Renders</h5>';
    html += `
      <table>
        <thead>
          <tr><th>Time</th><th>Actual</th><th>Interrupted</th><th>Efficiency</th></tr>
        </thead>
        <tbody>
          ${analysis.interruptedRenders
            .map(
              (r) => `
            <tr>
              <td>${r.timestamp}ms</td>
              <td>${r.actualDuration}ms</td>
              <td>${r.interruptedDuration}ms</td>
              <td>${r.efficiency}%</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  return html;
}

function generatePhasesHTML(phases) {
  const expensivePhases = phases.filter(
    (p) => p.renderPhase.expensive || p.commitPhase.expensive,
  );

  if (expensivePhases.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">All render phases are within healthy thresholds.</div>
      </div>
    `;
  }

  return `
    <p style="margin-bottom: 1.5rem;">Showing ${expensivePhases.length} heavy render cycles:</p>
    <table>
      <thead>
        <tr><th>Time</th><th>Total</th><th>Render Phase</th><th>Commit Phase</th><th>Recommendation</th></tr>
      </thead>
      <tbody>
        ${expensivePhases
          .slice(0, 20)
          .map(
            (p) => `
          <tr>
            <td>${p.timestamp}ms</td>
            <td>${p.totalDuration}ms</td>
            <td style="color: ${p.renderPhase.expensive ? "var(--danger)" : "inherit"}">${p.renderPhase.duration}ms (${p.renderPhase.percentage}%)</td>
            <td style="color: ${p.commitPhase.expensive ? "var(--danger)" : "inherit"}">${p.commitPhase.duration}ms (${p.commitPhase.percentage}%)</td>
            <td><small>${p.recommendation}</small></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function generateAnimationsHTML(animations) {
  if (!animations || animations.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No animations detected.</div>
      </div>
    `;
  }

  return `
    <table>
      <thead>
        <tr><th>Component</th><th>Duration</th><th>Avg FPS</th><th>Dropped Frames</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${animations
          .map(
            (a) => `
          <tr>
            <td><strong>${a.component}</strong></td>
            <td>${a.duration}ms</td>
            <td>${a.avgFPS}</td>
            <td>${a.droppedFrames}</td>
            <td><span class="badge ${a.smooth ? "good" : "warning"}">${a.smooth ? "Smooth" : "Janky"}</span></td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function generatePredictionHTML(prediction) {
  const predictionArray = Array.isArray(prediction) ? prediction : (prediction ? [prediction] : []);
  if (predictionArray.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">ℹ️</div>
        <div class="empty-state-text">Prediction engine data not available.</div>
      </div>
    `;
  }

  return predictionArray.map(p => {
    const compHeader = p.component ? `<h3 style="margin-top: 2rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;"><i class="fas fa-cube"></i> &lt;${p.component}&gt;</h3>` : '';
    const renderTime = String(p.predictedRenderTime).endsWith('ms') ? p.predictedRenderTime : p.predictedRenderTime + 'ms';
    const riskColor = p.risk === "HIGH" ? "var(--danger)" : p.risk === "MEDIUM" ? "var(--warning)" : "var(--success)";
    
    const suggestionsHTML = (p.suggestions || [])
      .map(
        (s) => `
        <div class="issue-card ${s.priority === "HIGH" ? "critical" : "warning"}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <strong>${s.type}</strong>
              <span class="badge ${s.priority === "HIGH" ? "critical" : "warning"}">Priority: ${s.priority}</span>
          </div>
          <p>${s.message}</p>
        </div>
      `,
      )
      .join("") ||
      (p.isStatic 
        ? "<p>✅ This appears to be a static component with minimal performance overhead.</p>"
        : "<p>✅ No major risks predicted for this component structure.</p>");

    return `
      ${compHeader}
      <div class="metric-grid">
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon"><i class="fas fa-clock"></i></div>
          </div>
          <div class="metric-title">Predicted Render Time</div>
          <div class="metric-value">${renderTime}</div>
          <div class="metric-change neutral">Based on complexity</div>
        </div>
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon"><i class="fas fa-brain"></i></div>
          </div>
          <div class="metric-title">Complexity Score</div>
          <div class="metric-value">${p.complexityScore}</div>
          <div class="metric-change neutral">Weighted sum of inputs</div>
        </div>
        <div class="metric-card">
          <div class="metric-header">
            <div class="metric-icon"><i class="fas fa-shield-alt"></i></div>
          </div>
          <div class="metric-title">Risk Level</div>
          <div class="metric-value" style="color: ${riskColor}">
            ${p.risk}
          </div>
        </div>
      </div>
      
      <h4 style="margin: 1rem 0 1.5rem;"><i class="fas fa-lightbulb"></i> Predicted Optimization Needs</h4>
      ${suggestionsHTML}
    `;
  }).join('<hr style="margin: 3rem 0; border: 0; border-top: 2px dashed var(--border);" />');
}

function generateFixesHTML(fixes) {
  if (!fixes || fixes.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No automated fixes suggested at this time.</div>
      </div>
    `;
  }

  const allSuggestions = fixes.flatMap((f) => f.suggestions);
  if (allSuggestions.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No automated fixes suggested at this time.</div>
      </div>
    `;
  }

  return `
    <p style="margin-bottom: 1.5rem;">Recommended code changes to improve performance:</p>
    <table>
      <thead>
        <tr><th>Component</th><th>Type</th><th>Description</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${fixes
          .map((f) =>
            f.suggestions
              .map(
                (s) => `
          <tr>
            <td><strong><code>&lt;${f.component}&gt;</code></strong></td>
            <td><span class="badge ${s.type === "ADD_MEMO" ? "critical" : "warning"}">${s.type}</span></td>
            <td>${s.description}</td>
            <td><button class="badge info" style="border: none; cursor: not-allowed; opacity: 0.6;" title="Direct patching not available in this version">Apply Patch</button></td>
          </tr>
        `,
              )
              .join(""),
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function generateChartScripts(fpsData, cpuData, memoryData, bottlenecks) {
  return `
    let performanceChart;
    window.currentChartType = 'fps';
    
    const chartData = {
      fps: ${JSON.stringify(fpsData)},
      cpu: ${JSON.stringify(cpuData)},
      memory: ${JSON.stringify(memoryData)},
      bottlenecks: ${JSON.stringify(bottlenecks.map((b) => ({ x: b.timestamp, y: b.fps })))}
    };

    function getChartColors() {
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      return {
        text: isDark ? '#f1f5f9' : '#0f172a',
        grid: isDark ? '#334155' : '#e2e8f0',
        fps: '#10b981',
        cpu: '#f59e0b',
        memory: '#3b82f6',
        critical: '#ef4444'
      };
    }

    function createChart(type) {
      window.currentChartType = type;
      const ctx = document.getElementById('performanceChart').getContext('2d');
      const colors = getChartColors();
      
      if (performanceChart) {
        performanceChart.destroy();
      }

      const config = {
        fps: {
          label: 'FPS',
          data: chartData.fps,
          borderColor: colors.fps,
          backgroundColor: colors.fps + '20',
          yLabel: 'Frames Per Second',
          yMax: 70
        },
        cpu: {
          label: 'CPU Usage',
          data: chartData.cpu,
          borderColor: colors.cpu,
          backgroundColor: colors.cpu + '20',
          yLabel: 'CPU %',
          yMax: 100
        },
        memory: {
          label: 'Memory Usage',
          data: chartData.memory,
          borderColor: colors.memory,
          backgroundColor: colors.memory + '20',
          yLabel: 'Memory (MB)',
          yMax: Math.max(...chartData.memory.map(d => d.y), 10) * 1.2
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
              backgroundColor: selectedConfig.backgroundColor,
              borderWidth: 3,
              pointRadius: 0,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.4
            },
            ...(type === 'fps' ? [{
              label: 'Frame Drops',
              data: chartData.bottlenecks,
              borderColor: colors.critical,
              backgroundColor: colors.critical,
              pointRadius: 6,
              pointHoverRadius: 8,
              pointStyle: 'triangle',
              showLine: false
            }] : [])
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              labels: {
                color: colors.text,
                usePointStyle: true,
                padding: 20,
                font: {
                  size: 13,
                  weight: 600
                }
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: selectedConfig.borderColor,
              borderWidth: 2,
              padding: 12,
              displayColors: true,
              callbacks: {
                label: function(context) {
                  let label = context.dataset.label || '';
                  if (label) {
                    label += ': ';
                  }
                  label += type === 'memory' ? context.parsed.y + ' MB' :
                           type === 'cpu' ? context.parsed.y + '%' :
                           Math.round(context.parsed.y) + ' FPS';
                  return label;
                }
              }
            }
          },
          scales: {
            x: {
              type: 'linear',
              title: {
                display: true,
                text: 'Time (ms)',
                color: colors.text,
                font: {
                  size: 14,
                  weight: 600
                }
              },
              grid: {
                color: colors.grid,
                drawBorder: false
              },
              ticks: {
                color: colors.text
              }
            },
            y: {
              title: {
                display: true,
                text: selectedConfig.yLabel,
                color: colors.text,
                font: {
                  size: 14,
                  weight: 600
                }
              },
              beginAtZero: type !== 'fps',
              max: selectedConfig.yMax,
              grid: {
                color: colors.grid,
                drawBorder: false
              },
              ticks: {
                color: colors.text
              }
            }
          }
        }
      });
    }

    createChart('fps');

    window.switchChart = function(type) {
      document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');
      createChart(type);
    }
  `;
}

function generateTabScript() {
  return `
    window.switchTab = function(tabName) {
      document.querySelectorAll('.section .tab').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      
      const targetTab = Array.from(document.querySelectorAll('.section .tab')).find(t => t.onclick.toString().includes(tabName));
      if (targetTab) targetTab.classList.add('active');
      
      const content = document.getElementById(tabName);
      if (content) content.classList.add('active');
    }
  `;
}

function generateTreeScript() {
  return `
    document.addEventListener('click', function(e) {
      const node = e.target.closest('.tree-node.has-children');
      if (node) {
        node.classList.toggle('expanded');
        node.classList.toggle('collapsed');
      }
    });

    // Initialize all tree nodes as expanded
    document.querySelectorAll('.tree-node.has-children').forEach(node => {
      node.classList.add('expanded');
    });
  `;
}

function generateJSThreadHTML(jsBottlenecks) {
  if (!jsBottlenecks || jsBottlenecks.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">No JS thread bottlenecks detected!</div>
      </div>
    `;
  }

  return `
    <h4 style="margin: 3rem 0 1rem;"><i class="fas fa-microchip"></i> JS Thread Bottlenecks</h4>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Duration</th>
          <th>Peak Usage</th>
          <th>Type</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${jsBottlenecks.map(b => `
          <tr>
            <td>${Math.round(b.timestamp)}ms</td>
            <td>${b.duration}ms</td>
            <td><strong style="color: ${b.maxUsage > 90 ? 'var(--danger)' : 'var(--warning)'}">${b.maxUsage}%</strong></td>
            <td><span class="badge ${b.type.includes('React') ? 'info' : 'critical'}">${b.type}</span></td>
            <td><small>${b.details}</small></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="issue-card info" style="margin-top: 2rem;">
      <strong><i class="fas fa-lightbulb"></i> Optimization Tips:</strong>
      <ul style="margin: 1rem 0 0 1.5rem;">
        <li>Use <code>InteractionManager.runAfterInteractions</code> for heavy logic</li>
        <li>Offload heavy computation to Native Modules or Web Workers</li>
        <li>Optimize large <code>JSON.parse</code> calls (e.g. by chunking)</li>
        <li>Review expensive Redux selectors or large object clones</li>
      </ul>
    </div>
  `;
}

module.exports = { generateHTMLReport };
