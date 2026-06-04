const fs = require('fs');
const path = require('path');
const CONFIG = require('../config');

function safeRequire(filePath, friendlyName, optional = false) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      if (optional) return null;
      console.error(`❌ Error: ${friendlyName} file not found at: ${fullPath}`);
      process.exit(1);
    }
    return require(fullPath);
  } catch (error) {
    if (optional) return null;
    console.error(`❌ Error loading ${friendlyName}:`, error.message);
    process.exit(1);
  }
}

function parseFlashlightData(flashlightData) {
  console.log("📊 Parsing Flashlight native metrics...");
  if (!flashlightData || !flashlightData.iterations) {
    console.error("❌ Invalid Flashlight data format");
    process.exit(1);
  }
  const measures = flashlightData.iterations.flatMap((it) =>
    (it.measures || []).map((m) => ({
      time: m.time || 0,
      fps: m.fps || 60,
      ram: Math.round(m.ram || 0),
      cpuTotal: Object.values(m.cpu?.perCore || {}).reduce((a, b) => a + b, 0),
      cpuRender: m.cpu?.perName?.["RenderThread"] || 0,
      cpuUI: m.cpu?.perName?.["UI Thread"] || 0,
      cpuJS: m.cpu?.perName?.["mqt_js"] || m.cpu?.perName?.["JavaScriptThread"] || 0
    }))
  );
  measures.sort((a, b) => a.time - b.time);
  return measures;
}

function parseReactDevToolsData(reactData) {
  console.log("⚛️  Parsing React DevTools profiler data...");
  const data = reactData.data || reactData;
  const profilingStartTime = data.profilingStartTime || 0;
  
  const fiberIDToNameMap = new Map();
  const componentRenderMap = new Map();
  const fiberHierarchy = new Map();
  const commits = [];

  // 1. "Scorched Earth" Name Discovery (Unconditional Recursion)
  function discover(obj, visited = new Set()) {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) discover(obj[i], visited);
    } else {
      // Logic A: Standard displayName property
      if (obj.displayName && (obj.id !== undefined || obj.fiberId !== undefined)) {
        const id = obj.id !== undefined ? obj.id : obj.fiberId;
        fiberIDToNameMap.set(Number(id), String(obj.displayName));
      }
      
      // Logic B: Old code stringTable + Index map support
      if (obj.fiberIDToNameIndexMap && obj.stringTable) {
        Object.entries(obj.fiberIDToNameIndexMap).forEach(([id, idx]) => {
          fiberIDToNameMap.set(Number(id), obj.stringTable[idx]);
        });
      }

      // Logic C: Recursively scan every property
      for (const key in obj) {
        const val = obj[key];
        if (val && typeof val === 'object') discover(val, visited);
      }
    }
  }

  console.log("   🔍 Scanning file for all component names...");
  discover(data);
  
  // Extra pass for root IDs
  if (data.dataForRoots) {
    data.dataForRoots.forEach(root => {
      if (root.displayName && root.rootID) fiberIDToNameMap.set(Number(root.rootID), root.displayName);
    });
  }

  console.log(`   ✓ Discovered ${fiberIDToNameMap.size} unique component names`);

  // 2. Time scaling detection
  let timeScale = 1;
  const firstRoot = data.dataForRoots?.[0];
  const firstCommit = firstRoot?.commitData?.[0] || data.timelineData?.[0]?.commits?.[0];
  if (firstCommit && firstCommit.timestamp > 100000000) {
     timeScale = 0.001; 
     console.log("   ℹ️  Microsecond timestamps detected, applying 1/1000 scaling");
  }

  // 3. Process Commits
  function processCommit(commit) {
    const relativeTimestamp = (commit.timestamp - profilingStartTime) * timeScale;
    
    // Extract change descriptions into a map for easy lookup
    const changeDescriptions = new Map();
    if (commit.changeDescriptions) {
      commit.changeDescriptions.forEach(([id, description]) => {
        changeDescriptions.set(Number(id), description);
      });
    }

    const commitData = {
      timestamp: relativeTimestamp,
      duration: commit.duration || 0,
      effectDuration: commit.effectDuration || 0,
      priorityLevel: commit.priorityLevel || 'Normal',
      updaters: (commit.updaters || []).map(u => ({
        name: u.displayName || `Unknown(${u.id})`,
        id: u.id
      })),
      components: []
    };

    const durations = commit.fiberActualDurations || commit.actualDurations || [];
    durations.forEach((item) => {
      let fiberId, duration;
      if (Array.isArray(item)) [fiberId, duration] = item;
      else if (typeof item === 'object') { fiberId = item.id; duration = item.duration; }

      if (fiberId === undefined) return;
      
      const componentName = fiberIDToNameMap.get(Number(fiberId)) || `Unknown(${fiberId})`;
      const description = changeDescriptions.get(Number(fiberId));
      
      const renderInfo = {
        timestamp: relativeTimestamp,
        duration,
        fiberId,
        reason: description ? {
          props: description.props,
          state: description.state,
          context: description.context,
          hooks: description.hooks,
          isFirstMount: description.isFirstMount
        } : null
      };

      commitData.components.push({ 
        name: componentName, 
        ...renderInfo
      });
      
      if (!componentRenderMap.has(componentName)) componentRenderMap.set(componentName, []);
      componentRenderMap.get(componentName).push(renderInfo);
    });
    commits.push(commitData);
  }

  if (data.dataForRoots) {
    data.dataForRoots.forEach(root => {
      if (root.commitData) root.commitData.forEach(processCommit);
    });
  }
  if (data.timelineData) {
    data.timelineData.forEach(t => (t.commits || []).forEach(processCommit));
  }

  console.log(`   ✓ Loaded ${commits.length} React commits`);
  console.log(`   ✓ Tracked ${componentRenderMap.size} unique components`);
  
  return { commits, componentRenderMap, fiberHierarchy };
}

function parseBundleStats(bundleData) {
  if (!bundleData) return null;
  const modules = bundleData.modules || bundleData.assets || [];
  const componentSizes = new Map();
  const componentPaths = new Map();
  modules.forEach(module => {
    const name = module.name || module.path || 'Unknown';
    const size = module.size || module.bundleSize || 0;
    const match = name.match(/\/([A-Z][a-zA-Z0-9]+)\.(js|tsx?)$/);
    if (match) {
      const componentName = match[1];
      if (!componentSizes.has(componentName)) {
        componentSizes.set(componentName, 0);
        componentPaths.set(componentName, name);
      }
      componentSizes.set(componentName, componentSizes.get(componentName) + size);
    }
  });
  return { totalSize: modules.reduce((sum, m) => sum + (m.size || 0), 0), componentSizes, componentPaths, modules };
}

module.exports = { safeRequire, parseFlashlightData, parseReactDevToolsData, parseBundleStats };
