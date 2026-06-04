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
