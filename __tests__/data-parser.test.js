const fs = require('fs');
const path = require('path');
const { safeRequire, parseFlashlightData, parseReactDevToolsData, parseBundleStats } = require('../utils/data-parser');

jest.mock('fs');

describe('data-parser', () => {
  let mockExit;

  beforeEach(() => {
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockExit.mockRestore();
  });

  test('safeRequire should load existing file', () => {
    fs.existsSync.mockReturnValue(true);
    const absPath = path.resolve('../some-file.json');
    jest.doMock(absPath, () => ({ key: 'value' }), { virtual: true });
    
    const result = safeRequire('../some-file.json', 'Test file');
    expect(result).toEqual({ key: 'value' });
    expect(mockExit).not.toHaveBeenCalled();
  });

  test('safeRequire should exit on missing required file', () => {
    fs.existsSync.mockReturnValue(false);
    safeRequire('missing.json', 'Test file');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('safeRequire should return null for optional missing file', () => {
    fs.existsSync.mockReturnValue(false);
    const result = safeRequire('missing.json', 'Test file', true);
    expect(result).toBeNull();
    expect(mockExit).not.toHaveBeenCalled();
  });

  test('parseFlashlightData should parse valid data', () => {
    const mockData = {
      iterations: [
        {
          measures: [
            {
              time: 100,
              ram: 128,
              cpu: {
                perCore: { core0: 10, core1: 20 },
                perName: { RenderThread: 5, mqt_js: 15 }
              }
            }
          ]
        }
      ]
    };

    const result = parseFlashlightData(mockData);
    expect(result.length).toBe(1);
    expect(result[0].time).toBe(100);
    expect(result[0].ram).toBe(128);
    expect(result[0].cpuTotal).toBe(30);
    expect(result[0].cpuRender).toBe(5);
    expect(result[0].cpuJS).toBe(15);
  });

  test('parseReactDevToolsData should discover component names and process commits', () => {
    const mockReactData = {
      profilingStartTime: 0,
      dataForRoots: [
        {
          rootID: 1,
          displayName: 'RootComponent',
          commitData: [
            {
              timestamp: 50,
              duration: 5,
              priorityLevel: 'Normal',
              fiberActualDurations: [[2, 4]],
              changeDescriptions: [[2, { isFirstMount: true }]]
            }
          ]
        }
      ],
      fiberIDToNameIndexMap: {
        2: 0
      },
      stringTable: ['MyChildComponent']
    };

    const { commits, componentRenderMap } = parseReactDevToolsData(mockReactData);
    expect(commits.length).toBe(1);
    expect(commits[0].components[0].name).toBe('MyChildComponent');
    expect(componentRenderMap.has('MyChildComponent')).toBe(true);
    expect(componentRenderMap.get('MyChildComponent')[0].duration).toBe(4);
  });

  test('parseBundleStats should return size map and paths', () => {
    const mockBundleData = {
      modules: [
        { name: '/path/to/MyComponent.js', size: 2048 },
        { name: '/path/to/Other.js', size: 1024 }
      ]
    };

    const result = parseBundleStats(mockBundleData);
    expect(result.totalSize).toBe(3072);
    expect(result.componentSizes.get('MyComponent')).toBe(2048);
    expect(result.componentPaths.get('MyComponent')).toBe('/path/to/MyComponent.js');
  });
});
