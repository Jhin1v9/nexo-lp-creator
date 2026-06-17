/**
 * buildValidator.js — NEXO Landing Page Creator v3.0
 * Validates build output: required files, output directory, syntax errors.
 * Returns: { score: 0-100, issues: [...], passed: boolean }
 */

const fs = require('fs');
const path = require('path');

/**
 * Validate build output for a project directory.
 * @param {string} outputDir - Path to the build output directory
 * @param {Object} options - { expectPackageJson, expectedFiles }
 * @returns {Object} { score, issues[], passed, summary }
 */
function validateBuild(outputDir, options = {}) {
  const issues = [];
  const {
    expectPackageJson = false,
    expectedFiles = [],
  } = options;

  if (!outputDir || typeof outputDir !== 'string') {
    return {
      score: 0,
      issues: [{ severity: 'critical', message: 'Output directory path is required' }],
      passed: false,
    };
  }

  // ─── 1. Output Directory Exists ───────────────────────────────────
  if (!fs.existsSync(outputDir)) {
    return {
      score: 0,
      issues: [{ severity: 'critical', message: `Output directory does not exist: ${outputDir}` }],
      passed: false,
    };
  }

  const stats = fs.statSync(outputDir);
  if (!stats.isDirectory()) {
    return {
      score: 0,
      issues: [{ severity: 'critical', message: `Path is not a directory: ${outputDir}` }],
      passed: false,
    };
  }

  // ─── 2. index.html Required ───────────────────────────────────────
  const indexHtmlPath = path.join(outputDir, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) {
    issues.push({
      severity: 'critical',
      message: 'Missing required file: index.html',
      file: 'index.html',
    });
  } else {
    // Validate index.html is non-empty and valid HTML
    const content = fs.readFileSync(indexHtmlPath, 'utf-8');
    if (content.trim().length === 0) {
      issues.push({
        severity: 'critical',
        message: 'index.html exists but is empty',
        file: 'index.html',
      });
    } else if (!content.trim().toUpperCase().startsWith('<!DOCTYPE') && !content.trim().toUpperCase().startsWith('<HTML')) {
      issues.push({
        severity: 'error',
        message: 'index.html does not start with valid HTML5 doctype',
        file: 'index.html',
      });
    }

    // Check for basic structure
    if (!content.includes('</html>') || !content.includes('</body>') || !content.includes('</head>')) {
      issues.push({
        severity: 'error',
        message: 'index.html missing basic HTML structure tags (<head>, <body>, or <html> closing)',
        file: 'index.html',
      });
    }
  }

  // ─── 3. package.json (if applicable) ──────────────────────────────
  if (expectPackageJson) {
    const packageJsonPath = path.join(outputDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      issues.push({
        severity: 'critical',
        message: 'Missing required file: package.json',
        file: 'package.json',
      });
    } else {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        if (!pkg.name) {
          issues.push({ severity: 'warning', message: 'package.json missing "name" field', file: 'package.json' });
        }
        if (!pkg.version) {
          issues.push({ severity: 'info', message: 'package.json missing "version" field', file: 'package.json' });
        }
      } catch (e) {
        issues.push({
          severity: 'critical',
          message: `package.json contains invalid JSON: ${e.message}`,
          file: 'package.json',
        });
      }
    }
  }

  // ─── 4. Expected Custom Files ─────────────────────────────────────
  expectedFiles.forEach((file) => {
    const filePath = path.join(outputDir, file);
    if (!fs.existsSync(filePath)) {
      issues.push({
        severity: 'error',
        message: `Expected file missing: ${file}`,
        file,
      });
    }
  });

  // ─── 5. No Empty Files ────────────────────────────────────────────
  const files = fs.readdirSync(outputDir, { recursive: true, withFileTypes: false });
  const emptyFiles = [];
  const allFiles = Array.isArray(files)
    ? files.filter((f) => fs.statSync(path.join(outputDir, f)).isFile())
    : [];

  allFiles.forEach((file) => {
    const filePath = path.join(outputDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim().length === 0) {
        emptyFiles.push(file);
        issues.push({
          severity: 'warning',
          message: `Empty file detected: ${file}`,
          file,
        });
      }
    } catch (e) {
      issues.push({
        severity: 'warning',
        message: `Cannot read file: ${file} — ${e.message}`,
        file,
      });
    }
  });

  // ─── 6. Check for node_modules / .git / .env (should NOT be present) ───
  const forbiddenDirs = ['node_modules', '.git', '.env', '.env.local', '.env.production'];
  forbiddenDirs.forEach((dir) => {
    const dirPath = path.join(outputDir, dir);
    if (fs.existsSync(dirPath)) {
      issues.push({
        severity: 'warning',
        message: `Forbidden directory/file should not be in output: ${dir}`,
      });
    }
  });

  // ─── 7. HTML Syntax Validation on all .html files ─────────────────
  const htmlFiles = allFiles.filter((f) => f.endsWith('.html'));
  htmlFiles.forEach((file) => {
    const filePath = path.join(outputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Basic unclosed tag detection
    const voidTags = new Set(['meta', 'link', 'img', 'input', 'br', 'hr', 'source', 'track', 'wbr', 'area', 'base', 'col', 'embed', 'param']);
    const tagRegex = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    const closeRegex = /<\/([a-zA-Z][a-zA-Z0-9]*)>/g;
    const openTags = {};
    const closeTags = {};

    let m;
    while ((m = tagRegex.exec(content)) !== null) {
      const tag = m[1].toLowerCase();
      if (!voidTags.has(tag)) {
        openTags[tag] = (openTags[tag] || 0) + 1;
      }
    }
    while ((m = closeRegex.exec(content)) !== null) {
      const tag = m[1].toLowerCase();
      closeTags[tag] = (closeTags[tag] || 0) + 1;
    }

    // Check critical structural tags
    ['html', 'head', 'body', 'title'].forEach((tag) => {
      if ((openTags[tag] || 0) !== (closeTags[tag] || 0)) {
        issues.push({
          severity: 'error',
          message: `Unclosed or mismatched <${tag}> tags in ${file} (open: ${openTags[tag] || 0}, close: ${closeTags[tag] || 0})`,
          file,
        });
      }
    });
  });

  // ─── 8. Check CSS files for syntax errors ─────────────────────────
  const cssFiles = allFiles.filter((f) => f.endsWith('.css'));
  cssFiles.forEach((file) => {
    const filePath = path.join(outputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    // Basic syntax checks
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push({
        severity: 'error',
        message: `Mismatched braces in ${file} ({: ${openBraces}, }: ${closeBraces})`,
        file,
      });
    }
  });

  // ─── 9. Check JS files for obvious syntax errors ──────────────────
  const jsFiles = allFiles.filter((f) => f.endsWith('.js') && !f.includes('node_modules'));
  jsFiles.forEach((file) => {
    const filePath = path.join(outputDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    try {
      // Use Function constructor for lightweight syntax check
      new Function(content);
    } catch (e) {
      issues.push({
        severity: 'error',
        message: `JavaScript syntax error in ${file}: ${e.message}`,
        file,
      });
    }
  });

  // ─── 10. Build command check (info if package.json exists) ────────
  const pkgJsonPath = path.join(outputDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (!pkg.scripts || !pkg.scripts.build) {
        issues.push({
          severity: 'info',
          message: 'No "build" script found in package.json',
          file: 'package.json',
        });
      }
    } catch (e) {
      // Already reported above
    }
  }

  // ─── Score Calculation ────────────────────────────────────────────
  const weights = {
    critical: 25,
    error: 10,
    warning: 3,
    info: 0,
  };

  const deductions = issues.reduce((sum, issue) => sum + (weights[issue.severity] || 0), 0);
  const score = Math.max(0, 100 - deductions);

  return {
    score: Math.round(score),
    issues,
    passed: score >= 80 && !issues.some((i) => i.severity === 'critical'),
    summary: {
      outputDir,
      totalFiles: allFiles.length,
      htmlFiles: htmlFiles.length,
      cssFiles: cssFiles.length,
      jsFiles: jsFiles.length,
      emptyFiles: emptyFiles.length,
      hasIndexHtml: fs.existsSync(indexHtmlPath),
      hasPackageJson: fs.existsSync(path.join(outputDir, 'package.json')),
      forbiddenItemsPresent: forbiddenDirs.filter((d) => fs.existsSync(path.join(outputDir, d))).length,
    },
  };
}

module.exports = { validateBuild };
