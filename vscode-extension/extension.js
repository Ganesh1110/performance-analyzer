// vscode-extension/extension.js
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('React Performance Analyzer extension is now active!');

  const diagnosticCollection = vscode.languages.createDiagnosticCollection('performance');

  // Register command to load performance report
  let disposable = vscode.commands.registerCommand('performance-analyzer.loadReport', function () {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const reportPath = path.join(workspaceFolders[0].uri.fsPath, 'performance_report.json');

    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        updateDiagnostics(report, diagnosticCollection);
        vscode.window.showInformationMessage(`Loaded performance report with ${report.reRenderIssues.length} issues.`);
      } catch (e) {
        vscode.window.showErrorMessage('Could not parse performance_report.json');
      }
    } else {
      vscode.window.showErrorMessage('performance_report.json not found in workspace root. Run the analyzer first.');
    }
  });

  context.subscriptions.push(disposable);
}

function updateDiagnostics(report, collection) {
  collection.clear();

  const diagnosticsMap = new Map();

  report.reRenderIssues.forEach(issue => {
    // In a real extension, we would resolve the component name to a file path
    // For this placeholder, we'll look for files named after the component
    
    // This is a simplified mock implementation
    const fileName = `${issue.component}.js`; 
    
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 100),
      `⚠️ Performance Issue: This component renders ${issue.renderCount} times (${issue.totalTimeSpent}ms wasted). Consider React.memo().`,
      vscode.DiagnosticSeverity.Warning
    );
    diagnostic.source = 'React Performance Analyzer';
    diagnostic.code = 'PERF001';

    // Since we don't have the actual file paths here, we just show how it would work
  });
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
