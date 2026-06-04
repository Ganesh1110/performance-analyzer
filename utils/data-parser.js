const fs = require('fs');
const path = require('path');

function safeRequire(filePath, friendlyName, optional = false) {
  try {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      if (optional) {
        console.log(`ℹ️  Optional file not found: ${friendlyName}`);
        return null;
      }
      console.error(`❌ Error: ${friendlyName} file not found at: ${fullPath}`);
      process.exit(1);
    }
    return require(fullPath);
  } catch (error) {
    if (optional) {
      console.log(`ℹ️  Could not load optional file: ${friendlyName}`);
      return null;
    }
    console.error(`❌ Error loading ${friendlyName}:`, error.message);
    process.exit(1);
  }
}

function parseFlashlightData(flashlightData) {
  console.log("📊 Parsing Flashlight native metrics...");
  
  if (!flashlightData.iterations || flashlightData.iterations.length === 0) {
    console.error("❌ No iterations found in Flashlight data");
    process.exit(1);
  }
  
  const measures = flashlightData.iterations.flatMap((iteration) =>
    (iteration.measures || []).map((m) => ({
      time: m.time,
      fps: m.fps || 60,
      ram: Math.round(m.ram || 0),
      cpuTotal: m.cpu?.perCore 
        ? Object.values(m.cpu.perCore).reduce((a, b) => a + b, 0) 
        : 0,
      cpuRender: m.cpu?.perName?.["RenderThread"] || 0,
      cpuUI: m.cpu?.perName?.["UI Thread"] || 0,
      cpuJS: m.cpu?.perName?.["mqt_js"] || m.cpu?.perName?.["JavaScriptThread"] || 0
    }))
  );
  
  console.log(`   ✓ Loaded ${measures.length} native performance samples`);
  return measures;
}

function parseReactDevToolsData(reactData) {
  console.log("⚛️  Parsing React DevTools profiler data...");
  
  const stringTable = reactData.stringTable || [];
  const fiberIDToNameIndexMap = reactData.fiberIDToNameIndexMap || {};
  const profilingStartTime = reactData.profilingStartTime || 0;
  
  const commits = [];
  const componentRenderMap = new Map();
  const fiberHierarchy = new Map();
  
  // Build fiber hierarchy
  if (reactData.snapshots) {
    reactData.snapshots.forEach(snapshot => {
      if (snapshot.nodes) {
        snapshot.nodes.forEach(node => {
          if (node.id && node.parentID !== undefined) {
            fiberHierarchy.set(node.id, {
              parentId: node.parentID,
              name: stringTable[fiberIDToNameIndexMap[node.id]] || `Fiber(${node.id})`,
              children: []
            });
          }
        });
      }
    });
    
    // Build parent-child relationships
    fiberHierarchy.forEach((node, id) => {
      if (node.parentId && fiberHierarchy.has(node.parentId)) {
        fiberHierarchy.get(node.parentId).children.push(id);
      }
    });
  }
  
  (reactData.timelineData || []).forEach((timeline) => {
    (timeline.commits || []).forEach((commit) => {
      const relativeTimestamp = commit.timestamp - profilingStartTime;
      
      const commitData = {
        timestamp: relativeTimestamp,
        duration: commit.duration || 0,
        effectDuration: commit.effectDuration || 0,
        priorityLevel: commit.priorityLevel || 'Normal',
        components: []
      };
      
      if (commit.fiberActualDurations) {
        commit.fiberActualDurations.forEach(([fiberId, duration]) => {
          const nameIndex = fiberIDToNameIndexMap[fiberId];
          const componentName = nameIndex !== undefined 
            ? stringTable[nameIndex] 
            : `Unknown(${fiberId})`;
          
          commitData.components.push({
            name: componentName,
            duration,
            fiberId
          });
          
          if (!componentRenderMap.has(componentName)) {
            componentRenderMap.set(componentName, []);
          }
          componentRenderMap.get(componentName).push({
            timestamp: relativeTimestamp,
            duration,
            commitDuration: commit.duration,
            fiberId
          });
        });
      }
      
      commits.push(commitData);
    });
  });
  
  console.log(`   ✓ Loaded ${commits.length} React commits`);
  console.log(`   ✓ Tracked ${componentRenderMap.size} unique components`);
  
  return { commits, componentRenderMap, fiberHierarchy };
}

function parseBundleStats(bundleData) {
  if (!bundleData) return null;
  
  console.log("📦 Parsing bundle statistics...");
  
  // Support different bundle analyzer formats
  const modules = bundleData.modules || bundleData.assets || [];
  
  const componentSizes = new Map();
  const componentPaths = new Map();
  
  modules.forEach(module => {
    const name = module.name || module.path || 'Unknown';
    const size = module.size || module.bundleSize || 0;
    
    // Extract component name from path
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
  
  console.log(`   ✓ Analyzed ${componentSizes.size} component bundle sizes`);
  
  return {
    totalSize: modules.reduce((sum, m) => sum + (m.size || 0), 0),
    componentSizes,
    componentPaths,
    modules
  };
}

module.exports = {
  safeRequire,
  parseFlashlightData,
  parseReactDevToolsData,
  parseBundleStats
};
