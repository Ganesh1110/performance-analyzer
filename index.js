#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const CONFIG = require('./config');
const { safeRequire, parseFlashlightData, parseReactDevToolsData, parseBundleStats } = require('./utils/data-parser');
const { detectBottlenecks } = require('./analyzers/bottleneck-analyzer');
const { analyzeReRenders } = require('./analyzers/rerender-analyzer');
const { analyzeMemory } = require('./analyzers/memory-analyzer');
const { buildComponentHierarchy, buildHierarchyTree, detectContextCascades } = require('./analyzers/hierarchy-analyzer');
const { analyzeBundleSize } = require('./analyzers/bundle-analyzer');
const { generateTextReport } = require('./reporters/text-reporter');
const { generateHTMLReport } = require('./reporters/html-reporter');
const { generateComparisonReport, generateComparisonTextReport } = require('./reporters/comparison-reporter');
const { calculateStats } = require('./utils/stats');

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
const { PerformanceRecorder } = require('./utils/recorder');

const { JSThreadAnalyzer } = require('./analyzers/js-thread-analyzer');

const { NavigationAnalyzer } = require('./analyzers/navigation-analyzer');
const { FlatListAnalyzer } = require('./analyzers/flatlist-analyzer');

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
  const args = process.argv.slice(2);
  const recordArg = args.find(a => a.startsWith('--record'));
  
  if (recordArg) {
    const bundleId = recordArg.split('=')[1];
    if (!bundleId) {
      console.error('   ❌ Error: --record requires a bundle ID. Example: --record=com.myapp');
      process.exit(1);
    }
    const recorder = new PerformanceRecorder();
    recorder.start(bundleId).then(() => {
      console.log('   ✅ Recording complete. Starting analysis...');
      runAnalysis(args);
    });
  } else {
    runAnalysis(args);
  }
}

function runAnalysis(args) {
  console.clear();
  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║   React Native Performance Analyzer v2.0 - Full Suite        ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  const isComparisonMode = args.includes('--compare');
  const enforceBudgets   = args.includes('--enforce-budgets');
  const updateBaseline   = args.includes('--update-baseline');
  const applyFixes       = args.includes('--fix');

  // CLI-overridable correlation settings (P3.2)
  const searchWindowArg  = args.find(a => a.startsWith('--search-window='));
  if (searchWindowArg)  CONFIG.correlation.searchWindowMs = parseInt(searchWindowArg.split('=')[1]);
  const pipelineDelayArg = args.find(a => a.startsWith('--pipeline-delay='));
  if (pipelineDelayArg) CONFIG.correlation.pipelineDelay  = parseInt(pipelineDelayArg.split('=')[1]);

  // Load data files
  const flashlightData = safeRequire(CONFIG.files.flashlight, "Flashlight metrics");
  const reactDevToolsData = safeRequire(CONFIG.files.reactProfile, "React DevTools profiler");
  const bundleData = safeRequire(CONFIG.files.bundleStats, "Bundle statistics", true);
  const networkData = safeRequire("./network-log.json", "Network log", true); // Try to load if exists

  // Parse data
  console.log("\n📦 Loading and parsing data...\n");
  const flashlightMeasures = parseFlashlightData(flashlightData);
  const { commits: reactCommits, componentRenderMap, fiberHierarchy, fiberIDToSourceMap } = parseReactDevToolsData(reactDevToolsData);
  const bundleAnalysis = bundleData ? parseBundleStats(bundleData) : null;

  // Alignment check & Calibration (P5.2)
  if (flashlightMeasures.length > 0 && reactCommits.length > 0) {
    const recorder = new PerformanceRecorder();
    const offset = recorder.calibrateAlignment(flashlightMeasures, reactCommits);
    
    // Apply calibration offset to react commits
    if (offset !== 0) {
      reactCommits.forEach(c => {
        c.timestamp += offset;
        c.components.forEach(comp => comp.timestamp += offset);
      });
      console.log(`   🕒 Applied ${Math.round(offset)}ms calibration offset to React trace.`);
    }

    const nativeStart = flashlightMeasures[0].time;
    const nativeEnd = flashlightMeasures[flashlightMeasures.length - 1].time;
    const reactStart = reactCommits[0].timestamp;
    const reactEnd = reactCommits[reactCommits.length - 1].timestamp;

    console.log(`\n🕒 Time Alignment:`);
    console.log(`   • Native Trace: ${Math.round(nativeStart)}ms to ${Math.round(nativeEnd)}ms`);
    console.log(`   • React Trace:  ${Math.round(reactStart)}ms to ${Math.round(reactEnd)}ms`);

    const overlapStart = Math.max(nativeStart, reactStart);
    const overlapEnd = Math.min(nativeEnd, reactEnd);
    
    if (overlapStart > overlapEnd) {
      console.warn(`   ⚠️  WARNING: No temporal overlap! Correlation will fail.`);
    } else {
      console.log(`   ✅ Traces overlap for ${Math.round(overlapEnd - overlapStart)}ms`);
    }
  }

  // Run all analyses
  console.log("\n🔍 Running comprehensive analysis...\n");
  
  // Smart Baseline Management - moved up to provide training data
  const baselineManager = new BaselineManager(path.join(__dirname, 'smart-baselines.json'));
  const detectedScreen = baselineManager.detectScreen(componentRenderMap);

  const bottlenecks = detectBottlenecks(flashlightMeasures, reactCommits);
  const reRenderIssues = analyzeReRenders(componentRenderMap);
  const memoryAnalysis = analyzeMemory(flashlightMeasures, componentRenderMap);
  const hierarchyIssues = buildComponentHierarchy(componentRenderMap, fiberHierarchy);
  const contextCascades = detectContextCascades(componentRenderMap);
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

  const navigationAnalyzer = new NavigationAnalyzer();
  // P0.2: pass flashlightMeasures for real FPS data in transition windows
  const navigationAnalysis = navigationAnalyzer.analyze(componentRenderMap, reactCommits, flashlightMeasures);

  const flatListAnalyzer = new FlatListAnalyzer();
  const flatListAnalysis = flatListAnalyzer.analyze(componentRenderMap, fiberHierarchy);

  const analysisData = {
    summary: {
      totalFrames: flashlightMeasures.length,
      bottleneckCount: bottlenecks.length,
      reRenderIssueCount: reRenderIssues.length,
      hierarchyIssueCount: hierarchyIssues.length,
      contextCascadeCount: contextCascades.length,
      memoryLeakCount: memoryAnalysis.leaks.length,
      jsBottleneckCount: jsBottlenecks.length,
      navigationIssueCount: navigationAnalysis.filter(n => n.severity !== 'good').length,
      flatListIssueCount: flatListAnalysis.length,
      healthScore: Math.max(0, 100 - Math.round((bottlenecks.length / flashlightMeasures.length) * 100))
    },
    flashlightMeasures,
    bottlenecks: correlatedBottlenecks,
    reRenderIssues,
    memoryAnalysis,
    hierarchyIssues,
    contextCascades,
    hierarchyTree,
    bundleAnalysis: bundleAnalysis?.analysis,
    flows,
    anomalies,
    concurrentAnalysis,
    phaseAnalysis,
    animations,
    commits: reactCommits,
    jsBottlenecks,
    navigationAnalysis,
    flatListAnalysis
  };

  // Tier 3 & 4: Predictive & Integration
  const predictionEngine = new PerformancePredictionEngine();
  
  // Train model with historical data if available
  const trainingData = baselineManager.getTrainingData();
  if (trainingData.length > 0) {
    predictionEngine.trainModel(trainingData);
  }

  // P2.1: Wire prediction engine to real component data from re-render analysis
  // Sort by "complexity" to get more interesting predictions first
  const complexIssues = [...reRenderIssues].sort((a, b) => {
    const scoreA = Object.keys(a.stateChangeCounts || {}).length + (a.contextChangeCount > 0 ? 5 : 0);
    const scoreB = Object.keys(b.stateChangeCounts || {}).length + (b.contextChangeCount > 0 ? 5 : 0);
    return scoreB - scoreA;
  });

  const predictions = complexIssues.slice(0, 15).map(issue => {
    const hasContext  = issue.contextChangeCount > 0;
    const childCount  = (hierarchyIssues || []).filter(h => h.parent === issue.component).length;
    return {
      component: issue.component,
      ...predictionEngine.suggestOptimizations({
        stateVariables:  Object.keys(issue.stateChangeCounts || {}).length,
        childComponents: childCount,
        usesContext:     hasContext,
        hasEffects:      issue.renders?.some(r => r.reason?.hooks?.length > 0) || false,
        propsCount:      Object.keys(issue.propChangeCounts || {}).length,
        linesOfCode:     0,
        dependencies:    0
      })
    };
  });
  const prediction = predictions;

  const nlReporter = new NaturalLanguageReporter();
  const executiveSummary = nlReporter.generateExecutiveSummary(analysisData);

  const sentry = new SentryIntegration(process.env.SENTRY_DSN);
  const sentryIssues = sentry.exportToSentry(analysisData);

  const codeFixer = new CodeFixer();
  const automatedFixes = codeFixer.suggestFixes(reRenderIssues);

  // P2.5: Add network summary to analysis data
  analysisData.networkSummary = networkAnalyzer.getSummary();
  analysisData.prediction     = prediction;
  analysisData.executiveSummary = executiveSummary;
  analysisData.automatedFixes   = automatedFixes;

  // Generate reports
  console.log("\n📝 Generating reports...\n");

  const textReport = generateTextReport(analysisData);
  fs.writeFileSync(path.join(__dirname, "performance_report.txt"), textReport, "utf-8");
  console.log("   ✓ Text report generated");

  const htmlReport = generateHTMLReport(analysisData);
  fs.writeFileSync(path.join(__dirname, "performance_report.html"), htmlReport, "utf-8");
  console.log("   ✓ HTML report generated");

  // Resolve component paths from both bundle analysis and React source info
  const resolvedComponentPaths = { ...(bundleAnalysis?.analysis?.componentPaths || {}) };
  componentRenderMap.forEach((renders, name) => {
    if (!resolvedComponentPaths[name] && renders[0].source && renders[0].source.fileName) {
      resolvedComponentPaths[name] = renders[0].source.fileName;
    }
  });

  const jsonReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalFrames:          flashlightMeasures.length,
      bottleneckCount:      bottlenecks.length,
      reRenderIssueCount:   reRenderIssues.length,
      hierarchyIssueCount:  hierarchyIssues.length,
      memoryLeakCount:      memoryAnalysis.leaks.length,
      jsBottleneckCount:    jsBottlenecks.length,     // P1.3
      avgFPS:               Math.round(calculateStats(flashlightMeasures.map(m => m.fps)).avg), // P1.3
      healthScore:          Math.max(0, 100 - Math.round((bottlenecks.length / flashlightMeasures.length) * 100))
    },
    componentPaths: resolvedComponentPaths, // Use resolved paths
    flashlightStats: {
      fps: calculateStats(flashlightMeasures.map(m => m.fps)),
      cpu: calculateStats(flashlightMeasures.map(m => m.cpuTotal))
    },
    bottlenecks: correlatedBottlenecks,
    reRenderIssues,
    hierarchyIssues,
    contextCascades,
    memoryAnalysis,
    bundleAnalysis: bundleAnalysis?.analysis,
    flows,
    anomalies,
    concurrentAnalysis,
    phaseAnalysis,
    animations,
    navigationAnalysis,
    flatListAnalysis,
    networkSummary: networkAnalyzer.getSummary(), // P2.5
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

      // P1.4: Actually write the comparison report
      const comparisonData = generateComparisonReport(
        {
          flashlightStats: jsonReport.flashlightStats,
          bottleneckCount:    comparison.changes.bottleneckCount.base,
          reRenderIssueCount: comparison.changes.reRenderIssueCount?.base
        },
        jsonReport.summary
      );
      const compText = generateComparisonTextReport(comparisonData);
      fs.writeFileSync(path.join(__dirname, 'comparison-report.txt'), compText, 'utf-8');
      console.log('   ✓ Comparison report generated (comparison-report.txt)');

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
    // P1.1: load from .performance-budget.json if present, else use defaults
    const budgetEnforcer = BudgetEnforcer.loadFromFile(path.join(__dirname, '.performance-budget.json'));
    const budgetResult   = budgetEnforcer.evaluate(jsonReport);
    const budgetReport   = budgetEnforcer.generateReport(budgetResult);
    fs.writeFileSync(path.join(__dirname, "budget-report.md"), budgetReport, "utf-8");
    console.log("   ✓ Budget report generated (budget-report.md)");

    const badgeSvg = budgetEnforcer.generateBadge(budgetResult);
    fs.writeFileSync(path.join(__dirname, "performance-badge.svg"), badgeSvg, "utf-8");
    console.log("   ✓ Performance badge generated (performance-badge.svg)");
    
    if (!budgetResult.passed) {
      console.log(`   ❌ Failed: ${budgetResult.blockers.length} blocking violations detected.`);
      process.exitCode = 1;
    } else {
      console.log(`   ✅ Passed all performance budgets.`);
    }
  }

  // P2.3: Apply automated code fixes if --fix flag is set
  if (applyFixes && automatedFixes.length > 0) {
    console.log('\n🔧 Applying automated fixes...');
    const componentFilePaths = jsonReport.componentPaths || {};
    automatedFixes.forEach(({ component, suggestions }) => {
      const filePath = componentFilePaths[component];
      if (!filePath) {
        console.log(`   ⚠️  No file path for <${component}> — skipping (provide bundle-stats.json for file paths)`);
        return;
      }
      const memoSuggestion = suggestions.find(s => s.type === 'ADD_MEMO');
      if (memoSuggestion) {
        const result = codeFixer.applyMemoFix(component, filePath);
        if (result.success) {
          fs.writeFileSync(filePath, result.code, 'utf8');
          console.log(`   ✅ Applied React.memo() to <${component}>`);
        } else {
          console.log(`   ❌ Could not fix <${component}> (memo): ${result.error}`);
        }
      }

      const callbackSuggestion = suggestions.find(s => s.type === 'USE_CALLBACK');
      if (callbackSuggestion) {
        // Extract prop names from the description or use a better way to pass data
        const propNames = reRenderIssues.find(i => i.component === component)?.unstableProps.filter(p => /^on[A-Z]/.test(p)) || [];
        if (propNames.length > 0) {
          const result = codeFixer.applyUseCallbackFix(component, filePath, propNames);
          if (result.success) {
            fs.writeFileSync(filePath, result.code, 'utf8');
            console.log(`   ✅ Applied useCallback() for [${propNames.join(', ')}] in <${component}>`);
          } else {
            console.log(`   ❌ Could not fix <${component}> (useCallback): ${result.error}`);
          }
        }
      }

      const memoHookSuggestion = suggestions.find(s => s.type === 'USE_MEMO_HOOK');
      if (memoHookSuggestion) {
        const result = codeFixer.applyUseMemoFix(component, filePath);
        if (result.success) {
          fs.writeFileSync(filePath, result.code, 'utf8');
          console.log(`   ✅ Applied useMemo() to <${component}>`);
        } else {
          console.log(`   ❌ Could not fix <${component}> (useMemo): ${result.error}`);
        }
      }
    });
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
  const args = process.argv.slice(2);
  const watchMode = args.includes('--watch');

  if (watchMode) {
    console.log("👀 Watch mode active. Initializing...");
    main();

    const filesToWatch = [CONFIG.files.flashlight, CONFIG.files.reactProfile];
    filesToWatch.forEach(file => {
      if (fs.existsSync(file)) {
        fs.watchFile(file, { interval: 1000 }, (curr, prev) => {
          if (curr.mtime > prev.mtime) {
            console.log(`\n🔄 Data file ${path.basename(file)} changed. Re-running analysis...`);
            runAnalysis(args);
          }
        });
      }
    });
  } else {
    main();
  }
} catch (error) {
  console.error("\n❌ Fatal error:", error.message);
  console.error(error.stack);
  process.exit(1);
}
