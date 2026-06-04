// sentry-integration.js
class SentryIntegration {
  constructor(dsn) {
    this.dsn = dsn;
    this.enabled = !!dsn;
  }

  exportToSentry(analysisData) {
    if (!this.enabled) {
      console.log('   ℹ️  Sentry DSN not provided, skipping export.');
      return;
    }

    // In a real scenario, we would use @sentry/node or @sentry/react-native
    // For this tool, we'll simulate the export or provide a JSON payload
    console.log('   📤 Exporting performance issues to Sentry...');

    const issues = [];

    // Export bottlenecks
    analysisData.bottlenecks.forEach(bottleneck => {
      const candidate = bottleneck.candidates[0];
      if (candidate && candidate.confidence > 0.7) {
        issues.push({
          type: 'transaction',
          name: `Performance Bottleneck: <${candidate.component}>`,
          op: 'performance.bottleneck',
          tags: {
            severity: bottleneck.severity > 0.7 ? 'critical' : 'warning',
            fps: bottleneck.fps,
            component: candidate.component
          },
          data: {
            timestamp: bottleneck.timestamp,
            renderTime: candidate.renderTime,
            cpuTotal: bottleneck.cpuTotal
          }
        });
      }
    });

    // Export memory leaks
    analysisData.memoryAnalysis.leaks.forEach(leak => {
      issues.push({
        type: 'breadcrumb',
        category: 'memory',
        message: `Potential Memory Leak: +${leak.memoryGrowth}MB growth`,
        level: 'error',
        data: {
          suspectComponents: leak.suspectComponents.map(c => c.name)
        }
      });
    });

    return issues;
  }
}

module.exports = { SentryIntegration };
