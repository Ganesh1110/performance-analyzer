// vscode-extension/extension.js
const vscode = require('vscode');
const fs     = require('fs');
const path   = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('React Performance Analyzer extension is now active!');

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('performance');

  // Auto-load on startup if report exists
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const reportPath = path.join(workspaceFolders[0].uri.fsPath, 'performance_report.json');
    if (fs.existsSync(reportPath)) {
      loadAndApplyReport(reportPath, diagnosticCollection);
    }

    // Auto-refresh: watch workspace root for report changes
    const watcher = fs.watch(workspaceFolders[0].uri.fsPath, { persistent: false }, (event, filename) => {
      if (filename === 'performance_report.json') {
        loadAndApplyReport(reportPath, diagnosticCollection);
        vscode.window.showInformationMessage('📊 Performance report updated — diagnostics refreshed.');
      }
    });
    context.subscriptions.push({ dispose: () => watcher.close() });
  }

  // Command: manually load/refresh the report
  let loadCmd = vscode.commands.registerCommand('performance-analyzer.loadReport', function () {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    const reportPath = path.join(folders[0].uri.fsPath, 'performance_report.json');
    if (fs.existsSync(reportPath)) {
      loadAndApplyReport(reportPath, diagnosticCollection);
      vscode.window.showInformationMessage('Performance report loaded.');
    } else {
      vscode.window.showErrorMessage('performance_report.json not found in workspace root. Run the analyzer first.');
    }
  });

  // Command: open the source file for a component
  let openCmd = vscode.commands.registerCommand('performance-analyzer.openComponent', async (componentPath) => {
    if (!componentPath) return;
    try {
      const uri = vscode.Uri.file(componentPath);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    } catch (e) {
      vscode.window.showErrorMessage(`Could not open file: ${componentPath}`);
    }
  });

  context.subscriptions.push(loadCmd, openCmd);
}

/**
 * Reads the report JSON and applies diagnostics.
 */
function loadAndApplyReport(reportPath, collection) {
  if (!fs.existsSync(reportPath)) return;
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    updateDiagnostics(report, collection);
  } catch (e) {
    vscode.window.showErrorMessage(`Could not parse performance_report.json: ${e.message}`);
  }
}

function updateDiagnostics(report, collection) {
  collection.clear();

  // Merge component paths: top-level (P3.4) + inside bundleAnalysis
  const allPaths = {
    ...(report.componentPaths || {}),
    ...(report.bundleAnalysis?.componentPaths || {})
  };

  const diagnosticsMap = new Map();

  function addDiagnostic(componentPath, message, severity, code) {
    if (!componentPath) return;
    const fileUri = vscode.Uri.file(componentPath);
    if (!diagnosticsMap.has(fileUri.toString())) {
      diagnosticsMap.set(fileUri.toString(), []);
    }
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 100),
      message,
      severity
    );
    diag.source = 'React Performance Analyzer';
    diag.code   = code;
    diagnosticsMap.get(fileUri.toString()).push(diag);
  }

  // Re-render issues
  (report.reRenderIssues || []).forEach(issue => {
    addDiagnostic(
      allPaths[issue.component],
      `⚠️ <${issue.component}> renders ${issue.renderCount}× — ${issue.primaryCause}. Consider React.memo().`,
      vscode.DiagnosticSeverity.Warning,
      'PERF001'
    );
  });

  // Frame drop bottlenecks
  (report.bottlenecks || []).slice(0, 10).forEach(b => {
    const comp = b.candidates?.[0]?.component;
    if (comp) {
      addDiagnostic(
        allPaths[comp],
        `🔴 Frame drop at t=${b.timestamp}ms — ${b.fps} FPS, CPU ${b.cpuTotal}%. Likely caused by <${comp}>.`,
        vscode.DiagnosticSeverity.Error,
        'PERF002'
      );
    }
  });

  // Memory leaks
  (report.memoryAnalysis?.leaks || []).forEach(leak => {
    (leak.suspectComponents || []).forEach(suspect => {
      addDiagnostic(
        allPaths[suspect.name],
        `💾 Potential memory leak: +${leak.memoryGrowth}MB. Suspect: <${suspect.name}>. Check for uncleaned useEffect/event listeners.`,
        vscode.DiagnosticSeverity.Error,
        'PERF003'
      );
    });
  });

  diagnosticsMap.forEach((diags, uriStr) => {
    collection.set(vscode.Uri.parse(uriStr), diags);
  });
}

function deactivate() {}

module.exports = { activate, deactivate };

