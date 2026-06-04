const CONFIG = require('../config');

function analyzeBundleSize(bundleData, componentRenderMap) {
  if (!bundleData) {
    console.log("📦 Skipping bundle analysis (no bundle stats provided)");
    return null;
  }
  
  console.log("📦 Analyzing bundle size and correlating with performance...");
  
  const { totalSize, componentSizes, modules } = bundleData;
  
  const largeComponents = [];
  const performanceCorrelation = [];
  
  componentSizes.forEach((size, componentName) => {
    const sizeKB = (size / 1024).toFixed(2);
    
    if (size > CONFIG.thresholds.bundleSize.componentSizeWarning * 1024) {
      const renders = componentRenderMap.get(componentName) || [];
      const avgRenderTime = renders.length > 0
        ? renders.reduce((sum, r) => sum + r.duration, 0) / renders.length
        : 0;
      
      largeComponents.push({
        component: componentName,
        sizeKB,
        renderCount: renders.length,
        avgRenderTime: avgRenderTime.toFixed(2),
        severity: size > CONFIG.thresholds.bundleSize.critical * 1024 
          ? 'critical' 
          : 'warning'
      });
    }
    
    // Correlate size with render performance
    const renders = componentRenderMap.get(componentName);
    if (renders && renders.length > 0) {
      const avgRenderTime = renders.reduce((sum, r) => sum + r.duration, 0) / renders.length;
      
      performanceCorrelation.push({
        component: componentName,
        sizeKB: parseFloat(sizeKB),
        avgRenderTime
      });
    }
  });
  
  // Calculate correlation coefficient
  const correlation = calculateCorrelation(
    performanceCorrelation.map(c => c.sizeKB),
    performanceCorrelation.map(c => c.avgRenderTime)
  );
  
  console.log(`   ✓ Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
  console.log(`   ✓ Found ${largeComponents.length} large components`);
  console.log(`   ✓ Size-Performance correlation: ${correlation.toFixed(2)}`);
  
  return {
    totalSizeKB: (totalSize / 1024).toFixed(2),
    largeComponents: largeComponents.sort((a, b) => 
      parseFloat(b.sizeKB) - parseFloat(a.sizeKB)
    ),
    componentPaths: Object.fromEntries(componentPaths),
    performanceCorrelation,
    correlationCoefficient: correlation
  };
}

function calculateCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

module.exports = { analyzeBundleSize };
