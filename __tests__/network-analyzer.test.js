const { NetworkAnalyzer } = require('../analyzers/network-analyzer');

describe('NetworkAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new NetworkAnalyzer();
  });

  test('correlateWithBottlenecks should flag likely network blocked frames', () => {
    const networkLog = [
      { timestamp: 1000, duration: 500, url: 'api/data', method: 'GET', status: 200 }
    ];
    analyzer.parseNetworkLog(networkLog);

    const bottlenecks = [
      { timestamp: 1100, fps: 30, cpuJS: 20, cpuTotal: 40 } // Low JS CPU + Slow Network = likely blocked
    ];

    const result = analyzer.correlateWithBottlenecks(bottlenecks);
    
    expect(result[0].networkActivity.likelyBlocked).toBe(true);
    expect(result[0].networkActivity.concurrentCount).toBe(1);
  });

  test('correlateWithBottlenecks should not flag if CPU JS is high', () => {
    const networkLog = [{ timestamp: 1000, duration: 500, url: 'api/data', method: 'GET' }];
    analyzer.parseNetworkLog(networkLog);

    const bottlenecks = [
      { timestamp: 1100, fps: 30, cpuJS: 80, cpuTotal: 90 } // High JS CPU = JS bound, not network blocked
    ];

    const result = analyzer.correlateWithBottlenecks(bottlenecks);
    expect(result[0].networkActivity.likelyBlocked).toBe(false);
  });
});
