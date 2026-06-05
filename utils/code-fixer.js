// code-fixer.js
const fs = require('fs');
const path = require('path');

class CodeFixer {
  constructor() {
    this.parser   = null;
    this.traverse = null;
    this.t        = null;
    this.generate = null;

    try {
      this.parser   = require('@babel/parser');
      this.traverse = require('@babel/traverse').default;
      this.t        = require('@babel/types');
      this.generate = require('@babel/generator').default;
    } catch (e) {
      // console.warn('Babel components not found. Code fixing will be limited to suggestions.');
    }
  }

  suggestFixes(reRenderIssues) {
    return reRenderIssues.map(issue => {
      const suggestions = [];

      // React.memo — wrap component if it re-renders excessively
      if (issue.severity > 0.7) {
        suggestions.push({
          type: 'ADD_MEMO',
          component: issue.component,
          description: `Wrap ${issue.component} in React.memo() to prevent ${issue.renderCount} unnecessary re-renders.`
        });
      }

      // useMemo — if individual render time is expensive
      if (parseFloat(issue.avgRenderTime) > 15) {
        suggestions.push({
          type: 'USE_MEMO_HOOK',
          component: issue.component,
          description: `Optimize expensive calculations in ${issue.component} using useMemo().`
        });
      }

      // useCallback — if callback props are unstable (causing child re-renders)
      if (issue.unstableProps && issue.unstableProps.some(p => /^on[A-Z]/.test(p))) {
        const callbackProps = issue.unstableProps.filter(p => /^on[A-Z]/.test(p));
        suggestions.push({
          type: 'USE_CALLBACK',
          component: issue.component,
          description: `Wrap callback props [${callbackProps.join(', ')}] in useCallback() to stabilize references and prevent child re-renders.`
        });
      }

      // SPLIT_CONTEXT — if >50% of renders are context-driven
      if (issue.contextChangeCount > issue.renderCount * 0.5) {
        suggestions.push({
          type: 'SPLIT_CONTEXT',
          component: issue.component,
          description: `${issue.component} re-renders primarily due to context changes (${issue.contextChangeCount}/${issue.renderCount} renders). Split context into smaller providers to reduce blast radius.`
        });
      }

      return {
        component: issue.component,
        suggestions
      };
    });
  }

  /**
   * Applies React.memo() wrapping to a component using Babel AST.
   * Supports 4 export patterns:
   *   1. export default ComponentName;
   *   2. export default function ComponentName() {}
   *   3. const ComponentName = () => {}; (plus a separate export default)
   *   4. export const ComponentName = () => {};
   */
  applyMemoFix(componentName, filePath) {
    if (!this.parser || !this.traverse || !this.t || !this.generate) {
      return { success: false, error: 'Babel parser/tools not installed' };
    }

    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast  = this.parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      let wrapped      = false;
      let hasMemoImport = false;
      const t = this.t;

      this.traverse(ast, {
        ImportDeclaration: (nodePath) => {
          if (nodePath.node.source.value === 'react') {
            if (nodePath.node.specifiers.some(s =>
              (s.type === 'ImportSpecifier' && s.imported.name === 'memo') ||
              (s.type === 'ImportDefaultSpecifier' && s.local.name === 'React')
            )) {
              hasMemoImport = true;
            }
          }
        },

        ExportDefaultDeclaration: (nodePath) => {
          if (wrapped) return;
          const decl = nodePath.node.declaration;

          // Pattern 1: export default ComponentName;
          if (t.isIdentifier(decl) && decl.name === componentName) {
            nodePath.node.declaration = t.callExpression(
              t.identifier('memo'),
              [decl]
            );
            wrapped = true;
          }
          // Pattern 2: export default function ComponentName() {}
          else if (t.isFunctionDeclaration(decl) && decl.id && decl.id.name === componentName) {
            const funcExpr = t.functionExpression(
              decl.id, decl.params, decl.body, decl.generator, decl.async
            );
            nodePath.node.declaration = t.callExpression(t.identifier('memo'), [funcExpr]);
            wrapped = true;
          }
        },

        // Pattern 3: const ComponentName = () => {}; (with separate export default)
        VariableDeclaration: (nodePath) => {
          if (wrapped) return;
          const declarator = nodePath.node.declarations.find(d =>
            t.isIdentifier(d.id) && d.id.name === componentName
          );
          if (!declarator) return;
          if (t.isArrowFunctionExpression(declarator.init) || t.isFunctionExpression(declarator.init)) {
            declarator.init = t.callExpression(t.identifier('memo'), [declarator.init]);
            wrapped = true;
          }
        },

        // Pattern 4: export const ComponentName = () => {};
        ExportNamedDeclaration: (nodePath) => {
          if (wrapped || !nodePath.node.declaration) return;
          const declarator = nodePath.node.declaration.declarations?.find(d =>
            t.isIdentifier(d.id) && d.id.name === componentName
          );
          if (!declarator) return;
          if (t.isArrowFunctionExpression(declarator.init) || t.isFunctionExpression(declarator.init)) {
            declarator.init = t.callExpression(t.identifier('memo'), [declarator.init]);
            wrapped = true;
          }
        }
      });

      if (!wrapped) {
        return { success: false, error: `Could not find a wrappable export pattern for <${componentName}>.` };
      }

      // Inject memo import if needed
      if (!hasMemoImport) {
        const memoImport = t.importDeclaration(
          [t.importSpecifier(t.identifier('memo'), t.identifier('memo'))],
          t.stringLiteral('react')
        );
        ast.program.body.unshift(memoImport);
      }

      const output = this.generate(ast, { retainLines: true }, code);
      return { success: true, code: output.code };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Wraps callback functions (usually on* props) in useCallback().
   * Logic: Finds the component, looks for arrow functions or function expressions
   * defined in the body that are assigned to variables matching the propNames.
   */
  applyUseCallbackFix(componentName, filePath, propNames) {
    if (!this.parser || !this.traverse || !this.t || !this.generate) {
      return { success: false, error: 'Babel parser/tools not installed' };
    }

    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast  = this.parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      let modified = false;
      let hasUseCallbackImport = false;
      const t = this.t;

      this.traverse(ast, {
        ImportDeclaration: (nodePath) => {
          if (nodePath.node.source.value === 'react') {
            if (nodePath.node.specifiers.some(s =>
              (s.type === 'ImportSpecifier' && s.imported.name === 'useCallback') ||
              (s.type === 'ImportDefaultSpecifier' && s.local.name === 'React')
            )) {
              hasUseCallbackImport = true;
            }
          }
        },

        // Find the component function
        Function: (nodePath) => {
          let isTargetComponent = false;
          if (nodePath.node.id && nodePath.node.id.name === componentName) isTargetComponent = true;
          else if (nodePath.parentPath.isVariableDeclarator() && nodePath.parentPath.node.id.name === componentName) isTargetComponent = true;

          if (!isTargetComponent) return;

          nodePath.traverse({
            VariableDeclarator: (vPath) => {
              if (!t.isIdentifier(vPath.node.id) || !propNames.includes(vPath.node.id.name)) return;
              
              const init = vPath.node.init;
              if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) {
                // Wrap in useCallback
                // For simplicity, we use an empty dependency array [] for now. 
                // A better implementation would analyze dependencies.
                vPath.node.init = t.callExpression(
                  t.identifier('useCallback'),
                  [init, t.arrayExpression([])]
                );
                modified = true;
              }
            }
          });
        }
      });

      if (modified) {
        if (!hasUseCallbackImport) {
          // Add useCallback to react import
          const reactImport = ast.program.body.find(n => 
            t.isImportDeclaration(n) && n.source.value === 'react'
          );
          if (reactImport) {
            reactImport.specifiers.push(t.importSpecifier(t.identifier('useCallback'), t.identifier('useCallback')));
          } else {
            const newImport = t.importDeclaration(
              [t.importSpecifier(t.identifier('useCallback'), t.identifier('useCallback'))],
              t.stringLiteral('react')
            );
            ast.program.body.unshift(newImport);
          }
        }
        const output = this.generate(ast, { retainLines: true }, code);
        return { success: true, code: output.code };
      }

      return { success: false, error: `Could not apply useCallback fix to <${componentName}>. No matching callbacks found in component body.` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Wraps expensive-looking calculations in useMemo().
   * Logic: Looks for .map(), .filter(), .reduce() calls or complex objects.
   */
  applyUseMemoFix(componentName, filePath) {
    if (!this.parser || !this.traverse || !this.t || !this.generate) {
      return { success: false, error: 'Babel parser/tools not installed' };
    }

    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const ast  = this.parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });

      let modified = false;
      let hasUseMemoImport = false;
      const t = this.t;

      this.traverse(ast, {
        ImportDeclaration: (nodePath) => {
          if (nodePath.node.source.value === 'react') {
            if (nodePath.node.specifiers.some(s =>
              (s.type === 'ImportSpecifier' && s.imported.name === 'useMemo') ||
              (s.type === 'ImportDefaultSpecifier' && s.local.name === 'React')
            )) {
              hasUseMemoImport = true;
            }
          }
        },

        Function: (nodePath) => {
          let isTargetComponent = false;
          if (nodePath.node.id && nodePath.node.id.name === componentName) isTargetComponent = true;
          else if (nodePath.parentPath.isVariableDeclarator() && nodePath.parentPath.node.id.name === componentName) isTargetComponent = true;

          if (!isTargetComponent) return;

          nodePath.traverse({
            VariableDeclarator: (vPath) => {
              const init = vPath.node.init;
              if (!init) return;

              // Check for .map, .filter, .reduce
              let isExpensive = false;
              if (t.isCallExpression(init) && t.isMemberExpression(init.callee)) {
                const methodName = init.callee.property.name;
                if (['map', 'filter', 'reduce', 'sort'].includes(methodName)) {
                  isExpensive = true;
                }
              }

              if (isExpensive) {
                // Wrap in useMemo(() => init, [])
                vPath.node.init = t.callExpression(
                  t.identifier('useMemo'),
                  [
                    t.arrowFunctionExpression([], init),
                    t.arrayExpression([])
                  ]
                );
                modified = true;
              }
            }
          });
        }
      });

      if (modified) {
        if (!hasUseMemoImport) {
          const reactImport = ast.program.body.find(n => 
            t.isImportDeclaration(n) && n.source.value === 'react'
          );
          if (reactImport) {
            reactImport.specifiers.push(t.importSpecifier(t.identifier('useMemo'), t.identifier('useMemo')));
          } else {
            const newImport = t.importDeclaration(
              [t.importSpecifier(t.identifier('useMemo'), t.identifier('useMemo'))],
              t.stringLiteral('react')
            );
            ast.program.body.unshift(newImport);
          }
        }
        const output = this.generate(ast, { retainLines: true }, code);
        return { success: true, code: output.code };
      }

      return { success: false, error: `Could not apply useMemo fix to <${componentName}>. No expensive calculations identified.` };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = { CodeFixer };

