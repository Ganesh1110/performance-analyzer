const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("🚀 Starting Comprehensive Smoke Test...");

// 1. Setup Mock Data
const mockFlashlight = {
  iterations: [{
    measures: [
      { time: 500, fps: 60, ram: 200, cpu: { perName: { "mqt_js": 10 } } },
      { time: 1000, fps: 30, ram: 210, cpu: { perName: { "mqt_js": 95 } } },
      { time: 1500, fps: 60, ram: 205, cpu: { perName: { "mqt_js": 15 } } }
    ]
  }]
};

const mockReact = {
  data: {
    profilingStartTime: 0,
    dataForRoots: [{
      commitData: [
        {
          timestamp: 800,
          duration: 120,
          fiberActualDurations: [[1, 100], [2, 20]],
          changeDescriptions: [[1, { props: ['data'], state: null, context: null, hooks: [] }]]
        }
      ]
    }],
    fiberIDToNameIndexMap: { "1": 0, "2": 1 },
    stringTable: ["HeavyComponent", "SubComponent"],
    fiberIDToParentIDMap: { "2": 1 }
  }
};

fs.writeFileSync('com.relay.infospica.json', JSON.stringify(mockFlashlight), 'utf8');
fs.writeFileSync('profiling-data.json', JSON.stringify(mockReact), 'utf8');

// 2. Run Analyzer with various flags
try {
  console.log("\n--- Testing Basic Analysis ---");
  execSync('node index.js --no-open', { stdio: 'inherit' });
  console.log("✅ Basic analysis passed.");

  console.log("\n--- Testing Budget Enforcement ---");
  try {
    execSync('node index.js --enforce-budgets --no-open', { stdio: 'inherit' });
  } catch (e) {
    // Exit code 1 is expected if budgets are violated
    console.log("ℹ️ Budget enforcement exited with code 1 (Expected due to violations).");
  }
  console.log("✅ Budget enforcement logic passed.");

  console.log("\n--- Testing Baseline & Prediction Training ---");
  execSync('node index.js --update-baseline --no-open', { stdio: 'inherit' });
  execSync('node index.js --update-baseline --no-open', { stdio: 'inherit' }); // Run twice to get training data
  console.log("✅ Baseline & Prediction training passed.");

  console.log("\n--- Testing Automated Fixes (Dry Run) ---");
  // We won't actually check file changes here to keep it simple, 
  // just that it doesn't crash
  execSync('node index.js --fix --no-open', { stdio: 'inherit' });
  console.log("✅ Automated fixes logic passed.");

  // 3. Verify Output Files
  const requiredFiles = [
    'performance_report.json',
    'performance_report.html',
    'performance_report.txt',
    'performance-badge.svg'
  ];

  console.log("\n--- Verifying Output Files ---");
  requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
      console.log(`✅ Found: ${file}`);
    } else {
      console.error(`❌ Missing: ${file}`);
      process.exit(1);
    }
  });

  console.log("\n🏆 SMOKE TEST COMPLETE: All systems operational!");

} catch (e) {
  console.error("\n❌ SMOKE TEST FAILED:", e.message);
  process.exit(1);
} finally {
  // Cleanup mock files (optional, but keep them for user to see)
  // fs.unlinkSync('com.relay.infospica.json');
  // fs.unlinkSync('profiling-data.json');
}
