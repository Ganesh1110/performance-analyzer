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

  // Load data files
  const flashlightData = safeRequire(CONFIG.files.flashlight, "Flashlight metrics");
  const reactDevToolsData = safeRequire(CONFIG.files.reactProfile, "React DevTools profiler");
  const bundleData = safeRequire(CONFIG.files.bundleStats, "Bundle statistics", true);

  // Parse data
  console.log("\n📦 Loading and parsing data...\n");
  const flashlightMeasures = parseFlashlightData(flashlightData);
  const { commits: reactCommits, componentRenderMap, fiberHierarchy } = parseReactDevToolsData(reactDevToolsData);
  const bundleAnalysis = bundleData ? parseBundleStats(bundleData) : null;

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

  const analysisData = {
    flashlightMeasures,
    bottlenecks,
    reRenderIssues,
    memoryAnalysis,
    hierarchyIssues,
    hierarchyTree,
    bundleAnalysis: bundleAnalysis?.analysis
  };

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
    bottlenecks,
    reRenderIssues,
    hierarchyIssues,
    memoryAnalysis,
    bundleAnalysis: bundleAnalysis?.analysis
  };

  fs.writeFileSync(
    path.join(__dirname, "performance_report.json"),
    JSON.stringify(jsonReport, null, 2),
    "utf-8"
  );
  console.log("   ✓ JSON report generated");

  // Comparison mode
  if (isComparisonMode) {
    const baselineData = safeRequire(CONFIG.files.baseline, "Baseline report", true);
    
    if (baselineData) {
      console.log("\n🔄 Running comparison analysis...\n");
      const comparison = generateComparisonReport(baselineData.summary, jsonReport.summary);
      const comparisonText = generateComparisonTextReport(comparison);
      
      fs.writeFileSync(
        path.join(__dirname, "performance_comparison.txt"),
        comparisonText,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(__dirname, "performance_comparison.json"),
        JSON.stringify(comparison, null, 2),
        "utf-8"
      );
      
      console.log("   ✓ Comparison reports generated");

      if (comparison.summary.regressed > 0) {
        console.log("\n⚠️  WARNING: Performance regressions detected!");
        comparison.regressions.forEach(reg => {
          console.log(`   ❌ ${reg.metric}: ${reg.baseline} → ${reg.current} (${reg.change})`);
        });
        process.exit(1); // Exit with error code for CI/CD
      }
    } else {
      console.log("\n⚠️  Baseline report not found. Skipping comparison.");
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
  console.log(`   • Hierarchy Issues: ${hierarchyIssues.length}\n`);
  
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
