const { PerformanceRecorder } = require('../utils/recorder');

describe('PerformanceRecorder', () => {
  let recorder;

  beforeEach(() => {
    recorder = new PerformanceRecorder();
  });

  test('calibrateAlignment should calculate offset between spikes', () => {
    const flashlightMeasures = [
      { time: 100, fps: 60, cpuTotal: 10 },
      { time: 200, fps: 30, cpuTotal: 90 }, // Native Spike @ 200ms
      { time: 300, fps: 60, cpuTotal: 10 }
    ];

    const reactCommits = [
      { timestamp: 50, duration: 10 },
      { timestamp: 150, duration: 100 }, // React Spike @ 150ms
      { timestamp: 250, duration: 10 }
    ];

    const offset = recorder.calibrateAlignment(flashlightMeasures, reactCommits);
    
    // Offset should be NativeTime (200) - ReactTime (150) = 50ms
    expect(offset).toBe(50);
  });

  test('calibrateAlignment should return 0 if no spikes found', () => {
    const flashlightMeasures = [{ time: 100, fps: 60, cpuTotal: 10 }];
    const reactCommits = [{ timestamp: 50, duration: 10 }];

    const offset = recorder.calibrateAlignment(flashlightMeasures, reactCommits);
    expect(offset).toBe(0);
  });
});
