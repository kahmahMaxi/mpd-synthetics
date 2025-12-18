/**
 * Cross-platform script to lint only staged files
 * Works on both Windows (PowerShell) and Unix systems
 */

const { execSync } = require('child_process');
const path = require('path');

const tool = process.argv[2]; // 'eslint' or 'prettier'

if (!tool || !['eslint', 'prettier'].includes(tool)) {
  console.error('Usage: node lint-staged.js <eslint|prettier>');
  process.exit(1);
}

try {
  // Get staged files
  const gitOutput = execSync('git diff --cached --name-only --diff-filter=AM', {
    encoding: 'utf8',
    stdio: 'pipe',
  });

  const stagedFiles = gitOutput
    .trim()
    .split('\n')
    .filter((file) => file && file.endsWith('.ts'))
    .map((file) => path.resolve(file));

  if (stagedFiles.length === 0) {
    console.log(`No staged .ts files to lint with ${tool}`);
    process.exit(0);
  }

  console.log(`Linting ${stagedFiles.length} staged .ts file(s) with ${tool}...`);

  if (tool === 'eslint') {
    execSync(`eslint --fix ${stagedFiles.join(' ')}`, { stdio: 'inherit' });
  } else if (tool === 'prettier') {
    execSync(`prettier --write ${stagedFiles.join(' ')}`, { stdio: 'inherit' });
  }

  console.log(`✅ ${tool} completed successfully`);
} catch (error) {
  console.error(`❌ ${tool} failed:`, error.message);
  process.exit(1);
}

