module.exports = {
  // File paths
  files: {
    flashlight: "./com.relay.infospica.json",
    reactProfile: "./profiling-data.json",
    bundleStats: "./bundle-stats.json", // Optional: from metro-bundler
    baseline: "./baseline-report.json" // For comparison mode
  },

  // Performance thresholds
  thresholds: {
    fps: {
      critical: 45,
      warning: 55,
      target: 60
    },
    cpu: {
      critical: 70,
      warning: 50,
      jsThreadCritical: 70, // Used by JSThreadAnalyzer
      jsThreadWarning: 50
    },
    renderThread: {
      critical: 50,
      warning: 35
    },
    renderTime: {
      critical: 16.67, // One frame at 60fps
      warning: 10
    },
    memory: {
      critical: 512, // MB
      warning: 256,
      leakThreshold: 50 // MB growth over time
    },
    bundleSize: {
      critical: 5000, // KB
      warning: 3000,
      componentSizeWarning: 100 // KB per component
    }
  },

  // Analysis settings
  correlation: {
    pipelineDelay: 35,
    searchWindowMs: 50,
    minConfidence: 0.3
  },

  rerender: {
    minCount: 3,
    minFrequency: 100,
    unnecessaryThreshold: 0.5
  },

  // Report settings
  report: {
    maxBottlenecks: 20,
    maxReRenderIssues: 20,
    maxHierarchyDepth: 5,
    includeCharts: true,
    chartColors: {
      fps: '#4CAF50',
      cpu: '#FF9800',
      memory: '#2196F3',
      critical: '#F44336',
      warning: '#FFC107',
      good: '#4CAF50'
    }
  },

  // Output settings
  outputs: {
    dir: "./perf-results",
    keepHistory: true,
    copyTraces: true // Save raw input traces along with the report
  },

  // User-defined performance flows (edit to add custom flows)
  // Format: 'flow-name': { start: 'StartComponentName', end: 'EndComponentName', budget: { duration: ms, fps: number } }
  flows: {
    'app-launch':   { start: 'AppContainer', end: 'HomeScreen',      budget: { duration: 2000, fps: 58 } },
    'product-view': { start: 'ProductList',  end: 'ProductDetail',   budget: { duration: 300,  fps: 60 } },
    'checkout':     { start: 'CartScreen',   end: 'CheckoutSuccess', budget: { duration: 1000, fps: 55 } }
  },

  // Screen detection patterns for baseline grouping.
  // Key: colon-separated component names (partial match), Value: human-readable screen name.
  // Add entries for your own screens here.
  screenPatterns: {
    'Header:HomeScreen:ProductList':       'Home',
    'CartSummary:CheckoutScreen:PaymentForm': 'Checkout',
    'Avatar:ProfileScreen:SettingsMenu':   'Profile'
  }
};

