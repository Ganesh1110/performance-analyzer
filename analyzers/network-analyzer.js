class NetworkAnalyzer {
  constructor() {
    this.requests = [];
  }

  /**
   * Parses a network log in HAR or Chrome DevTools format.
   * Each entry should have: startTime/timestamp, duration/endTime, url, method, status, responseSize.
   */
  parseNetworkLog(networkLog = []) {
    this.requests = networkLog.map(req => ({
      timestamp: req.startTime || req.timestamp,
      duration:  (req.endTime || req.timestamp + (req.duration || 0)) - (req.startTime || req.timestamp),
      url:    req.url,
      method: req.method,
      size:   (req.responseSize || 0) / 1024, // KB
      status: req.status
    }));
  }

  correlateWithBottlenecks(bottlenecks) {
    if (!this.requests.length) return bottlenecks;

    return bottlenecks.map(bottleneck => {
      // Widened from ±100ms to ±300ms to catch network latency that starts earlier
      const concurrentRequests = this.requests.filter(req =>
        req.timestamp >= bottleneck.timestamp - 300 &&
        req.timestamp <= bottleneck.timestamp + 300
      );

      const slowRequests   = concurrentRequests.filter(req => req.duration > 200);
      const failedRequests = concurrentRequests.filter(req => req.status >= 400 || req.status === 0);
      const totalPayloadKB = concurrentRequests.reduce((s, r) => s + r.size, 0).toFixed(1);

      return {
        ...bottleneck,
        networkActivity: {
          concurrentCount:      concurrentRequests.length,
          slowCount:            slowRequests.length,
          failedCount:          failedRequests.length,
          totalPayloadKB,
          totalDuration:        concurrentRequests.reduce((sum, r) => sum + r.duration, 0).toFixed(0),
          likelyBlocked:        slowRequests.length > 0 && bottleneck.cpuJS < 40,
          likelyFailureCaused:  failedRequests.length > 0,
          details:  slowRequests.map(r => `${r.method} ${r.url.substring(0, 30)}... (${r.duration.toFixed(0)}ms)`),
          failures: failedRequests.map(r => `${r.method} ${r.url.substring(0, 30)}... → HTTP ${r.status}`)
        }
      };
    });
  }

  /**
   * Returns an overall network summary (not tied to individual bottlenecks).
   * Useful for the JSON report's networkSummary field.
   */
  getSummary() {
    if (!this.requests.length) return null;
    const failed = this.requests.filter(r => r.status >= 400 || r.status === 0);
    const slow   = this.requests.filter(r => r.duration > 500);
    return {
      totalRequests:  this.requests.length,
      failedCount:    failed.length,
      slowCount:      slow.length,
      totalPayloadKB: this.requests.reduce((s, r) => s + r.size, 0).toFixed(1),
      avgDurationMs:  Math.round(this.requests.reduce((s, r) => s + r.duration, 0) / this.requests.length)
    };
  }
}

module.exports = { NetworkAnalyzer };
