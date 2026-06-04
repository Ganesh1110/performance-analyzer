const fs = require('fs');
const { CodeFixer } = require('../utils/code-fixer');

jest.mock('fs');

describe('CodeFixer', () => {
  let fixer;

  beforeEach(() => {
    fixer = new CodeFixer();
  });

  test('suggestFixes should return appropriate suggestions', () => {
    const reRenderIssues = [
      { component: 'HeavyComp', severity: 0.9, renderCount: 50, avgRenderTime: 20 }
    ];

    const result = fixer.suggestFixes(reRenderIssues);
    
    expect(result[0].suggestions.length).toBe(2);
    expect(result[0].suggestions[0].type).toBe('ADD_MEMO');
    expect(result[0].suggestions[1].type).toBe('USE_MEMO_HOOK');
  });

  test('applyMemoFix should transform code correctly', () => {
    if (!fixer.babel) {
        console.warn('Babel not found in test environment, skipping transformation test');
        return;
    }

    const inputCode = 'export default MyComponent;';
    fs.readFileSync.mockReturnValue(inputCode);

    const result = fixer.applyMemoFix('MyComponent', 'path/to/MyComponent.js');
    
    if (!result.success) {
      console.log('Transformation error:', result.error);
    }
    
    expect(result.success).toBe(true);
    expect(result.code).toContain('memo(MyComponent)');
    expect(result.code).toContain('import { memo } from "react";');
  });
});
