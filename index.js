#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const CONFIG = require('./config');
const { safeRequire, parseFlashlightData, parseReactDevToolsData, parseBundleStats } = require('./utils/data-parser');
const { detectBottlenecks } = require('./analyzers/bottleneck-analyzer');
const { analyzeReRenders } = require('./analyzers/rerender-analyzer');
const { analyzeMemory } = require('./analyzers/memory-analyzer');
const { buildComponentHierarchy, buildHierarchyTree } = require('./analyzers/hierarchy-analyzer');
const { analyzeBundleSize } = require('./analyzers/bundle-analyzer');
const { generateTextReport } = require('./reporters/text-reporter');
const { generateHTMLReport } = require('./reporters/html-reporter');
const { generateComparisonReport, generateComparisonTextReport } = require('./reporters/comparison-reporter');

// New Integrations
const { FlowTracker } = require('./analyzers/flow-tracker');
const { AnomalyDetector } = require('./analyzers/anomaly-detector');
const { BudgetEnforcer } = require('./analyzers/performance-budgets');
const { BaselineManager } = require('./analyzers/baseline-manager');
const { ConcurrentAnalyzer } = require('./analyzers/concurrent-analyzer');
const { PhaseAnalyzer } = require('./analyzers/phase-analyzer');
const { NetworkAnalyzer } = require('./analyzers/network-analyzer');
const { AnimationAnalyzer } = require('./analyzers/animation-analyzer');
const { SentryIntegration } = require('./analyzers/sentry-integration');
const { PerformancePredictionEngine } = require('./analyzers/prediction-engine');
const { NaturalLanguageReporter } = require('./reporters/nl-reporter');
const { CodeFixer } = require('./utils/code-fixer');

const { JSThreadAnalyzer } = require('./analyzers/js-thread-analyzer');

function openReport(filePath) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${command} ${filePath}`, (error) => {
    if (error) {
      console.log(`   ℹ️  Note: Could not open report automatically. You can open it manually at: ${filePath}`);
    } else {
      console.log(`   🚀 Opening report in your browser...`);
    }
  });
}

function main() {
  console.clear();
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║   React Native Performance Analyzer v2.0 - Full Suite        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const args = process.argv.slice(2);
  const isComparisonMode = args.includes('--compare');
  const enforceBudgets = args.includes('--enforce-budgets');
  const updateBaseline = args.includes('--update-baseline');

  // Load data files
  const flashlightData = safeRequire(CONFIG.files.flashlight, "Flashlight metrics");
  const reactDevToolsData = safeRequire(CONFIG.files.reactProfile, "React DevTools profiler");
  const bundleData = safeRequire(CONFIG.files.bundleStats, "Bundle statistics", true);
  const networkData = safeRequire("./network-log.json", "Network log", true); // Try to load if exists

  // Parse data
  console.log("\n📦 Loading and parsing data...\n");
  const flashlightMeasures = parseFlashlightData(flashlightData);
  const { commits: reactCommits, componentRenderMap, fiberHierarchy } = parseReactDevToolsData(reactDevToolsData);
  const bundleAnalysis = bundleData ? parseBundleStats(bundleData) : null;

  // Alignment check
  if (flashlightMeasures.length > 0 && reactCommits.length > 0) {
    const nativeStart = flashlightMeasures[0].time;
    const nativeEnd = flashlightMeasures[flashlightMeasures.length - 1].time;
    const reactStart = reactCommits[0].timestamp;
    const reactEnd = reactCommits[reactCommits.length - 1].timestamp;

    console.log(`\n🕒 Time Alignment Check:`);
    console.log(`   • Native Trace: ${Math.round(nativeStart)}ms to ${Math.round(nativeEnd)}ms (Duration: ${Math.round(nativeEnd - nativeStart)}ms)`);
    console.log(`   • React Trace:  ${Math.round(reactStart)}ms to ${Math.round(reactEnd)}ms (Duration: ${Math.round(reactEnd - reactStart)}ms)`);

    const overlapStart = Math.max(nativeStart, reactStart);
    const overlapEnd = Math.min(nativeEnd, reactEnd);
    
    if (overlapStart > overlapEnd) {
      console.warn(`   ⚠️  WARNING: No temporal overlap between native and React traces! Correlation will fail.`);
      console.warn(`      Ensure you start both recordings at roughly the same time.`);
    } else {
      console.log(`   ✅ Traces overlap for ${Math.round(overlapEnd - overlapStart)}ms`);
    }
  }

  // Run all analyses
  console.log("\n🔍 Running comprehensive analysis...\n");
  
  const bottlenecks = detectBottlenecks(flashlightMeasures, reactCommits);
  const reRenderIssues = analyzeReRenders(componentRenderMap);
  const memoryAnalysis = analyzeMemory(flashlightMeasures, componentRenderMap);
  const hierarchyIssues = buildComponentHierarchy(componentRenderMap, fiberHierarchy);
  const hierarchyTree = buildHierarchyTree(componentRenderMap, fiberHierarchy);
  
  if (bundleAnalysis) {
    const bundleSizeAnalysis = analyzeBundleSize(bundleAnalysis, componentRenderMap);
    bundleAnalysis.analysis = bundleSizeAnalysis;
  }

  // Tier 1 Flow & Anomaly Tracking
  const flowTracker = new FlowTracker();
  const flows = flowTracker.detectFlows(componentRenderMap, flashlightMeasures);
  
  const anomalyDetector = new AnomalyDetector();
  const fpsAnomalies = anomalyDetector.detectAnomalies(flashlightMeasures, 'fps');
  const cpuAnomalies = anomalyDetector.detectAnomalies(flashlightMeasures, 'cpuTotal');
  const memoryAnomalies = anomalyDetector.detectAnomalies(flashlightMeasures, 'ram');
  const anomalies = [...fpsAnomalies, ...cpuAnomalies, ...memoryAnomalies].sort((a,b) => a.timestamp - b.timestamp);

  // Tier 2 Advanced Analyzers
  const concurrentAnalyzer = new ConcurrentAnalyzer();
  const concurrentAnalysis = concurrentAnalyzer.analyzeConcurrentFeatures(reactCommits);

  const phaseAnalyzer = new PhaseAnalyzer();
  const phaseAnalysis = phaseAnalyzer.analyzeRenderPhases(reactCommits);

  const networkAnalyzer = new NetworkAnalyzer();
  if (networkData) networkAnalyzer.parseNetworkLog(networkData);
  const correlatedBottlenecks = networkAnalyzer.correlateWithBottlenecks(bottlenecks);

  const animationAnalyzer = new AnimationAnalyzer();
  const animations = animationAnalyzer.detectAnimations(componentRenderMap, flashlightMeasures);

  const jsThreadAnalyzer = new JSThreadAnalyzer();
  const jsBottlenecks = jsThreadAnalyzer.analyze(flashlightMeasures, reactCommits);

  const analysisData = {
    summary: {
      totalFrames: flashlightMeasures.length,
      bottleneckCount: bottlenecks.length,
      reRenderIssueCount: reRenderIssues.length,
      hierarchyIssueCount: hierarchyIssues.length,
      memoryLeakCount: memoryAnalysis.leaks.length,
      jsBottleneckCount: jsBottlenecks.length,
      healthScore: Math.max(0, 100 - Math.round((bottlenecks.length / flashlightMeasures.length) * 100))
    },
    flashlightMeasures,
    bottlenecks: correlatedBottlenecks,
    reRenderIssues,
    memoryAnalysis,
    hierarchyIssues,
    hierarchyTree,
    bundleAnalysis: bundleAnalysis?.analysis,
    flows,
    anomalies,
    concurrentAnalysis,
    phaseAnalysis,
    animations,
    commits: reactCommits,
    jsBottlenecks
  };

  // Tier 3 & 4: Predictive & Integration
  const predictionEngine = new PerformancePredictionEngine();
  // In a real scenario, we'd load historical reports here
  const prediction = predictionEngine.suggestOptimizations({
    linesOfCode: 250,
    dependencies: 12,
    stateVariables: 6,
    childComponents: 15,
    usesContext: true,
    hasEffects: true
  });

  const nlReporter = new NaturalLanguageReporter();
  const executiveSummary = nlReporter.generateExecutiveSummary(analysisData);

  const sentry = new SentryIntegration(process.env.SENTRY_DSN);
  const sentryIssues = sentry.exportToSentry(analysisData);

  const codeFixer = new CodeFixer();
  const automatedFixes = codeFixer.suggestFixes(reRenderIssues);

  // Add new data to analysisData for reports
  analysisData.prediction = prediction;
  analysisData.executiveSummary = executiveSummary;
  analysisData.automatedFixes = automatedFixes;

  // Generate reports
  console.log("\n📝 Generating reports...\n");

  const textReport = generateTextReport(analysisData);
  fs.writeFileSync(path.join(__dirname, "performance_report.txt"), textReport, "utf-8");
  console.log("   ✓ Text report generated");

  const htmlReport = generateHTMLReport(analysisData);
  fs.writeFileSync(path.join(__dirname, "performance_report.html"), htmlReport, "utf-8");
  console.log("   ✓ HTML report generated");

  // Save JSON for programmatic access and baseline comparison
  const { calculateStats } = require('./utils/stats');
  const jsonReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFrames: flashlightMeasures.length,
      bottleneckCount: bottlenecks.length,
      reRenderIssueCount: reRenderIssues.length,
      hierarchyIssueCount: hierarchyIssues.length,
      memoryLeakCount: memoryAnalysis.leaks.length,
      healthScore: Math.max(0, 100 - Math.round((bottlenecks.length / flashlightMeasures.length) * 100))
    },
    flashlightStats: {
      fps: calculateStats(flashlightMeasures.map(m => m.fps)),
      cpu: calculateStats(flashlightMeasures.map(m => m.cpuTotal))
    },
    bottlenecks: correlatedBottlenecks,
    reRenderIssues,
    hierarchyIssues,
    memoryAnalysis,
    bundleAnalysis: bundleAnalysis?.analysis,
    flows,
    anomalies,
    concurrentAnalysis,
    phaseAnalysis,
    animations,
    prediction,
    executiveSummary,
    automatedFixes
  };

  fs.writeFileSync(
    path.join(__dirname, "performance_report.json"),
    JSON.stringify(jsonReport, null, 2),
    "utf-8"
  );
  console.log("   ✓ JSON report generated");

  // Smart Baseline Management
  const baselineManager = new BaselineManager(path.join(__dirname, 'smart-baselines.json'));
  const detectedScreen = baselineManager.detectScreen(componentRenderMap);
  console.log(`\n📱 Detected Screen/Flow: ${detectedScreen}`);

  if (updateBaseline) {
    baselineManager.saveBaseline(detectedScreen, jsonReport);
    console.log(`   ✓ Saved new baseline for screen: ${detectedScreen}`);
  }

  // Comparison mode
  if (isComparisonMode) {
    const comparison = baselineManager.compare(detectedScreen, jsonReport);
    
    if (comparison.isFirstRun) {
      console.log(`   ℹ️  No existing baseline for ${detectedScreen}. Run with --update-baseline first.`);
    } else {
      console.log(`\n🔄 Comparison vs Baseline (${detectedScreen}):`);
      console.log(`   • Health Score: ${comparison.changes.healthScore.base} → ${comparison.changes.healthScore.curr} (${comparison.changes.healthScore.status})`);
      console.log(`   • Bottlenecks:  ${comparison.changes.bottleneckCount.base} → ${comparison.changes.bottleneckCount.curr} (${comparison.changes.bottleneckCount.status})`);
      
      if (comparison.regressed > 0) {
        console.log(`   ⚠️  WARNING: Performance regressions detected on this screen!`);
      } else {
        console.log(`   ✅ No regressions on this screen!`);
      }
    }
  }

  // Budgets Enforcement
  if (enforceBudgets) {
    console.log("\n⚖️  Enforcing Performance Budgets...");
    const budgetEnforcer = new BudgetEnforcer();
    const budgetResult = budgetEnforcer.evaluate(jsonReport);
    const budgetReport = budgetEnforcer.generateReport(budgetResult);
    fs.writeFileSync(path.join(__dirname, "budget-report.md"), budgetReport, "utf-8");
    console.log("   ✓ Budget report generated (budget-report.md)");
    
    if (!budgetResult.passed) {
      console.log(`   ❌ Failed: ${budgetResult.blockers.length} blocking violations detected.`);
      process.exitCode = 1;
    } else {
      console.log(`   ✅ Passed all performance budgets.`);
    }
  }

  // Print summary
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ ANALYSIS COMPLETE                        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");
  
  console.log(`📊 Results:`);
  console.log(`   • Health Score: ${jsonReport.summary.healthScore}/100`);
  console.log(`   • Bottlenecks: ${bottlenecks.length}`);
  console.log(`   • Re-render Issues: ${reRenderIssues.length}`);
  console.log(`   • Memory Leaks: ${memoryAnalysis.leaks.length}`);
  console.log(`   • Hierarchy Issues: ${hierarchyIssues.length}`);
  console.log(`   • User Flows tracked: ${flows.length} (${flows.filter(f => !f.passed).length} failed)`);
  console.log(`   • Anomalies detected: ${anomalies.length}\n`);
  
  console.log(`📄 Reports generated:`);
  console.log(`   • performance_report.txt (detailed text report)`);
  console.log(`   • performance_report.html (interactive charts)`);
  console.log(`   • performance_report.json (programmatic access)\n`);
  
  console.log(`💡 Next steps:`);
  console.log(`   1. Review high-severity issues in the automatically opened browser`);
  console.log(`   2. Run 'npm run serve' if you need to re-share the report at http://localhost:3000\n`);
  
  if (jsonReport.summary.healthScore < 70) {
    console.log(`⚠️  Health score below 70 - immediate action recommended!\n`);
  }

  // Automatically open the report
  openReport(path.join(__dirname, "performance_report.html"));
}

// Run the analyzer
try {
  main();
} catch (error) {
  console.error("\n❌ Fatal error:", error.message);
  console.error(error.stack);
  process.exit(1);
}
