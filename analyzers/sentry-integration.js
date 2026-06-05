// sentry-integration.js
const fs   = require('fs');
const path = require('path');

class SentryIntegration {
  constructor(dsn) {
    this.dsn     = dsn;
    this.enabled = !!dsn;
  }

  exportToSentry(analysisData) {
    if (!this.enabled) {
      console.log('   ℹ️  Sentry DSN not provided — writing sentry-export.json for manual import.');
    } else {
      console.log('   📤 Exporting performance issues to Sentry...');
    }

    const issues = [];

    // ── Bottlenecks ─────────────────────────────────────────────────────────
    (analysisData.bottlenecks || []).forEach(bottleneck => {
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

    // ── Memory leaks ─────────────────────────────────────────────────────────
    (analysisData.memoryAnalysis?.leaks || []).forEach(leak => {
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

    // ── Re-render issues ──────────────────────────────────────────────────────
    (analysisData.reRenderIssues || []).slice(0, 10).forEach(issue => {
      issues.push({
        type: 'breadcrumb',
        category: 'performance.rerender',
        message: `Excessive Re-renders: <${issue.component}> rendered ${issue.renderCount} times`,
        level: issue.severity > 0.7 ? 'error' : 'warning',
        data: {
          component:       issue.component,
          renderCount:     issue.renderCount,
          wastedRenders:   issue.wastedRenders,
          primaryCause:    issue.primaryCause,
          totalTimeSpentMs: issue.totalTimeSpent
        }
      });
    });

    // ── Context cascades ──────────────────────────────────────────────────────
    (analysisData.contextCascades || []).forEach(cascade => {
      issues.push({
        type: 'breadcrumb',
        category: 'performance.context-cascade',
        message: `Context Cascade: ${cascade.affectedCount} components re-rendered at t=${cascade.timestamp}ms`,
        level: cascade.severity === 'high' ? 'error' : 'warning',
        data: {
          affectedCount: cascade.affectedCount,
          components:    cascade.components,
          sources:       cascade.sources
        }
      });
    });

    // ── Always write JSON export ──────────────────────────────────────────────
    const exportPath = path.join(process.cwd(), 'sentry-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(issues, null, 2), 'utf8');
    console.log(`   ✓ Wrote ${issues.length} issues to sentry-export.json`);

    // ── Optional: real Sentry SDK send ───────────────────────────────────────
    if (this.enabled) {
      try {
        const Sentry = require('@sentry/node');
        Sentry.init({ dsn: this.dsn });
        issues.forEach(issue => {
          if (issue.type === 'transaction') {
            Sentry.withScope(scope => {
              Object.entries(issue.tags || {}).forEach(([k, v]) => scope.setTag(k, v));
              scope.setExtra('data', issue.data);
              Sentry.captureMessage(issue.name, 'warning');
            });
          }
        });
        console.log(`   ✓ Sent ${issues.length} issues to Sentry`);
      } catch (e) {
        console.warn('   ⚠️  @sentry/node not installed — issues saved to sentry-export.json only.');
        console.warn('      To enable real Sentry export: npm install @sentry/node');
      }
    }

    return this.enabled ? issues : undefined;
  }
}

module.exports = { SentryIntegration };
