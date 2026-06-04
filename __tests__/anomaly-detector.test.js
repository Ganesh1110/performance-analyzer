const { AnomalyDetector } = require('../analyzers/anomaly-detector');

describe('AnomalyDetector', () => {
  let anomalyDetector;

  beforeEach(() => {
    anomalyDetector = new AnomalyDetector();
  });

  test('detectAnomalies should flag an FPS drop', () => {
    // 20 stable points
    const timeSeries = Array.from({ length: 20 }, (_, i) => ({ time: i * 100, fps: 60 }));
    // 1 anomaly
    timeSeries.push({ time: 2000, fps: 30 });

    const anomalies = anomalyDetector.detectAnomalies(timeSeries, 'fps');
    
    expect(anomalies.length).toBe(1);
    expect(anomalies[0].value).toBe(30);
    expect(anomalies[0].severity).toBe('critical'); // z-score will be high
  });

  test('detectAnomalies should return empty array if series is too short', () => {
    const timeSeries = [{ time: 100, fps: 60 }];
    const anomalies = anomalyDetector.detectAnomalies(timeSeries, 'fps');
    expect(anomalies.length).toBe(0);
  });

  test('detectAnomalies should handle zero standard deviation', () => {
    const timeSeries = Array.from({ length: 25 }, (_, i) => ({ time: i * 100, fps: 60 }));
    const anomalies = anomalyDetector.detectAnomalies(timeSeries, 'fps');
    expect(anomalies.length).toBe(0); // No anomalies in constant series
  });
});
