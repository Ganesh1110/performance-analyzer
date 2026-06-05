# React Native Performance Analyzer

Comprehensive React Native performance analysis tool to identify bottlenecks, memory leaks, and optimization opportunities.

## Features

- **Bottleneck Detection**: Identify performance bottlenecks in your React Native application.
- **Re-render Analysis**: Track and analyze unnecessary component re-renders.
- **Memory Profiling**: Analyze memory usage and detect potential leaks.
- **Hierarchy Analysis**: Build and visualize component hierarchy trees.
- **Bundle Size Analysis**: Detailed breakdown of bundle size and asset impact.
- **Flow Tracking**: Monitor user flows and performance across transitions.
- **Anomaly Detection**: Automatically detect performance regressions and anomalies.
- **Performance Budgets**: Enforce performance budgets to prevent performance decay.
- **Network Analysis**: Analyze network request patterns and overhead.
- **Animation Analysis**: Monitor frame rates and animation performance.
- **Sentry Integration**: Connect with Sentry for real-world performance data.
- **AI Prediction**: AI-powered performance prediction engine.
- **VSCode Extension**: Integrated developer experience within VSCode.

## Installation

```bash
npm install
```

## Usage

### Run Analysis
```bash
npm run analyze
```

### Full Analysis with Budgets and Baselines
```bash
npm run analyze:full
```

### Compare with Previous Baseline
```bash
npm run compare
```

### Enforce Performance Budgets
```bash
npm run check-budgets
```

### View Last HTML Report
```bash
npm run serve
```

## Reports

The tool generates multiple report formats:
- **HTML Report**: Interactive visual report (generated as `performance_report.html`).
- **Text Report**: Quick summary in terminal (generated as `performance_report.txt`).
- **JSON Data**: Raw analysis data for integration (generated as `performance_report.json`).
- **NL Report**: Natural language summary of performance insights.

## Project Structure

- `analyzers/`: Core logic for different performance metrics.
- `reporters/`: Modules for generating various report formats.
- `utils/`: Data parsers and statistical utilities.
- `vscode-extension/`: Source for the VSCode companion extension.

## CLI Flags

| Flag | Description | Example |
| --- | --- | --- |
| `--compare` | Compare current run against the saved baseline for the detected screen. | `npm run analyze -- --compare` |
| `--enforce-budgets` | Evaluate performance metrics against budgets defined in `.performance-budget.json`. | `npm run analyze -- --enforce-budgets` |
| `--update-baseline` | Save/update the baseline data with the current run's metrics. | `npm run analyze -- --update-baseline` |
| `--fix` | Proactively apply automated component memoization fixes using Babel. | `npm run analyze -- --fix` |
| `--search-window=N` | Correlation search window size in milliseconds (default: 50). | `npm run analyze -- --search-window=100` |
| `--pipeline-delay=N`| Pipeline delay threshold in milliseconds (default: 35). | `npm run analyze -- --pipeline-delay=50` |

## Configuration

### Performance Budgets (`.performance-budget.json`)
Configure your performance budget thresholds in `.performance-budget.json` in the root directory:
```json
{
  "global": {
    "healthScore": { "min": 80, "blocker": true },
    "avgFPS": { "min": 58, "blocker": true }
  },
  "bundleSize": {
    "totalKB": { "max": 5000, "blocker": false }
  },
  "perScreen": {
    "Home": {
      "transitionDuration": { "max": 200, "blocker": false }
    }
  }
}
```

### Performance Flows (`config.js`)
Define custom start-to-end performance flows in `config.js` to track user scenarios:
```javascript
flows: {
  'app-launch': { start: 'AppContainer', end: 'HomeScreen', budget: { duration: 2000, fps: 58 } }
}
```

## VSCode Extension Setup
To enable inline warnings for performance issues:
1. Open the `vscode-extension` directory in VSCode.
2. Build/package the extension or run in debug mode.
3. The extension automatically reads `performance_report.json` and updates squiggles.

## Sentry Integration
Provide your `SENTRY_DSN` environment variable to automatically export performance issues to Sentry. If the DSN is missing, the tool will export issues locally to `sentry-export.json` which can be uploaded/imported manually.

## Report Schema
For a detailed structure of the output JSON report, refer to [SCHEMA.md](file:///Users/ganeshjayaprakash/WorkSpace/Mine/performance-analyzer/SCHEMA.md).

