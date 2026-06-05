const { calculateStats, calculatePercentileChange, detectTrend } = require('../utils/stats');

describe('stats utilities', () => {
  test('calculateStats should handle empty or invalid input', () => {
    const emptyResult = calculateStats(null);
    expect(emptyResult.avg).toBe(0);
    expect(emptyResult.min).toBe(0);
  });

  test('calculateStats should compute min, max, avg, median, standard deviation', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const stats = calculateStats(values);
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(9);
    expect(stats.avg).toBe(5);
    expect(stats.median).toBe(5);
    expect(stats.stdDev).toBeCloseTo(2.0, 2);
  });

  test('calculatePercentileChange should return change percentage', () => {
    expect(calculatePercentileChange(100, 150)).toBe(50);
    expect(calculatePercentileChange(0, 100)).toBe(0);
  });

  test('detectTrend should identify trend correctly', () => {
    expect(detectTrend([1, 2, 3, 4, 5])).toBe('increasing');
    expect(detectTrend([5, 4, 3, 2, 1])).toBe('decreasing');
    expect(detectTrend([5, 5, 5, 5, 5])).toBe('stable');
  });
});
