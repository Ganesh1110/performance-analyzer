// code-fixer.js
// Note: Requires @babel/core and @babel/generator
// npm install @babel/core @babel/generator

const fs = require('fs');
const path = require('path');

class CodeFixer {
  constructor() {
    this.babel = null;
    this.generate = null;
    try {
      this.babel = require('@babel/core');
      this.generate = require('@babel/generator').default;
    } catch (e) {
      // console.warn('Babel not found. Code fixing will be limited to suggestions.');
    }
  }

  suggestFixes(reRenderIssues) {
    return reRenderIssues.map(issue => {
      const suggestions = [];

      if (issue.severity > 0.7) {
        suggestions.push({
          type: 'ADD_MEMO',
          component: issue.component,
          description: `Wrap ${issue.component} in React.memo() to prevent ${issue.renderCount} unnecessary re-renders.`
        });
      }

      if (issue.avgRenderTime > 15) {
        suggestions.push({
          type: 'USE_MEMO_HOOK',
          component: issue.component,
          description: `Optimize expensive calculations in ${issue.component} using useMemo().`
        });
      }

      return {
        component: issue.component,
        suggestions
      };
    });
  }

  // Experimental: Apply a fix using Babel
  applyMemoFix(componentName, filePath) {
    if (!this.babel || !this.generate) return { success: false, error: 'Babel not installed' };

    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast = this.babel.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      let modified = false;
      this.babel.traverse(ast, {
        ExportDefaultDeclaration: (path) => {
          if (path.node.declaration.name === componentName) {
            path.node.declaration = this.babel.types.callExpression(
              this.babel.types.identifier('memo'),
              [path.node.declaration]
            );
            modified = true;
          }
        }
      });

      if (modified) {
        const output = this.generate(ast, {}, code);
        return { success: true, code: output.code };
      }
      
      return { success: false, error: 'Could not find component export' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = { CodeFixer };
