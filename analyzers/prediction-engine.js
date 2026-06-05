// prediction-engine.js
class PerformancePredictionEngine {
  constructor() {
    this.historicalData = [];
    this.weights = {
      linesOfCode: 0.1,
      dependencies: 5.0,
      stateVariables: 10.0,
      childComponents: 2.0,
      propsCount: 1.0,
      usesContext: 15.0,
      hasEffects: 8.0
    };
  }

  trainModel(historicalRuns) {
    if (!historicalRuns || historicalRuns.length < 2) return;

    console.log(`   🧠 Training Prediction Engine with ${historicalRuns.length} historical samples...`);

    const learningRate = 0.01;
    const epochs = 100;

    for (let i = 0; i < epochs; i++) {
      historicalRuns.forEach(run => {
        if (!run.componentMetrics || !run.actualRenderTime) return;

        const metrics = run.componentMetrics;
        const actual = run.actualRenderTime;
        const predicted = this.predictRenderTime(metrics);
        const error = predicted - actual;

        // Adjust weights using gradient descent: w = w - lr * error * input
        Object.keys(this.weights).forEach(key => {
          const input = metrics[key] || 0;
          this.weights[key] -= learningRate * error * input;
          
          // Ensure weights stay positive
          if (this.weights[key] < 0.01) this.weights[key] = 0.01;
        });
      });
    }

    console.log("   ✅ Model trained. Refined weights:", JSON.stringify(this.weights));
  }

  predictRenderTime(componentMetrics) {
    // Simple heuristic-based prediction
    let predictedTime = 1.0; // Base render time

    Object.keys(this.weights).forEach(key => {
      if (componentMetrics[key]) {
        predictedTime += componentMetrics[key] * this.weights[key];
      }
    });

    return predictedTime;
  }

  suggestOptimizations(componentMetrics) {
    const predicted = this.predictRenderTime(componentMetrics);
    const suggestions = [];

    if (predicted > 16.67) {
      if (componentMetrics.childComponents > 10) {
        suggestions.push({
          type: 'VIRTUALIZATION',
          priority: 'HIGH',
          message: 'Component has many children. Consider virtualizing this list (use FlashList/FlatList).'
        });
      }

      if (componentMetrics.stateVariables > 5) {
        suggestions.push({
          type: 'STATE_SPLITTING',
          priority: 'MEDIUM',
          message: 'High state count. Split component into smaller pieces with localized state.'
        });
      }

      if (componentMetrics.usesContext) {
        suggestions.push({
          type: 'CONTEXT_OPTIMIZATION',
          priority: 'MEDIUM',
          message: 'Uses context. Ensure context value is memoized to prevent unnecessary re-renders.'
        });
      }
    }

    return {
      predictedRenderTime: predicted.toFixed(2) + 'ms',
      risk: predicted > 16.67 ? 'HIGH' : predicted > 10 ? 'MEDIUM' : 'LOW',
      suggestions,
      complexityScore: (predicted - 1.0).toFixed(2), // Metrics-driven complexity
      isStatic: predicted <= 1.05
    };
  }
}

module.exports = { PerformancePredictionEngine };
