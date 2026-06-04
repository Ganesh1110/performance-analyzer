// code-fixer.js
const fs = require('fs');
const path = require('path');

class CodeFixer {
  constructor() {
    this.parser = null;
    this.traverse = null;
    this.t = null;
    this.generate = null;

    try {
      this.parser = require('@babel/parser');
      this.traverse = require('@babel/traverse').default;
      this.t = require('@babel/types');
      this.generate = require('@babel/generator').default;
    } catch (e) {
      // console.warn('Babel components not found. Code fixing will be limited to suggestions.');
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
    if (!this.parser || !this.traverse || !this.t || !this.generate) {
      return { success: false, error: 'Babel parser/tools not installed' };
    }

    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast = this.parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      let modified = false;
      let hasMemoImport = false;

      this.traverse(ast, {
        ImportDeclaration: (path) => {
          if (path.node.source.value === 'react') {
            if (path.node.specifiers.some(s => 
              (s.type === 'ImportSpecifier' && s.imported.name === 'memo') ||
              (s.type === 'ImportDefaultSpecifier' && s.local.name === 'React')
            )) {
              hasMemoImport = true;
            }
          }
        },
        ExportDefaultDeclaration: (path) => {
          const decl = path.node.declaration;
          
          // Case 1: export default MyComponent
          if (decl.type === 'Identifier' && decl.name === componentName) {
            path.node.declaration = this.t.callExpression(
              this.t.identifier('memo'),
              [decl]
            );
            modified = true;
          }
          // Case 2: export default function MyComp() {}
          else if (decl.type === 'FunctionDeclaration' && decl.id && decl.id.name === componentName) {
            const funcExpr = this.t.functionExpression(
              decl.id,
              decl.params,
              decl.body,
              decl.generator,
              decl.async
            );
            path.node.declaration = this.t.callExpression(
              this.t.identifier('memo'),
              [funcExpr]
            );
            modified = true;
          }
          // Case 3: export default () => {} (Anonymous)
          // If we matched by name, it's probably not anonymous, but just in case
        }
      });

      if (modified) {
        if (!hasMemoImport) {
          const memoImport = this.t.importDeclaration(
            [this.t.importSpecifier(this.t.identifier('memo'), this.t.identifier('memo'))],
            this.t.stringLiteral('react')
          );
          ast.program.body.unshift(memoImport);
        }

        const output = this.generate(ast, { retainLines: true }, code);
        return { success: true, code: output.code };
      }
      
      return { success: false, error: `Could not find default export for component: ${componentName}` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = { CodeFixer };
