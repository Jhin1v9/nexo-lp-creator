/**
 * NEXO Landing Page Creator v3.0 - Build Verification Service
 *
 * Performs pre-build and post-build verification checks.
 * Ensures the generated code meets quality standards before deployment.
 *
 * @module services/lpBuildVerificationService
 * @version 3.0.0
 */

const config = require('../config/nexo-lp-config');

class BuildVerificationService {
  constructor() {
    this.enabled = config.features.bugDetection !== false;
  }

  /**
   * Run all pre-build verification checks
   * @param {object} buildContext - { sessionId, stack, html, css, js }
   * @returns {object} { passed, checks, warnings, errors }
   */
  async runPreBuildChecks(buildContext) {
    if (!this.enabled) {
      return { passed: true, checks: [], warnings: [], errors: [] };
    }

    const { sessionId, stack, html, css, js } = buildContext;
    const checks = [];
    const warnings = [];
    const errors = [];

    // Check 1: HTML content exists
    const htmlCheck = this.checkHtmlContent(html);
    checks.push({ name: 'html-content', ...htmlCheck });
    if (!htmlCheck.passed) errors.push(htmlCheck.message);

    // Check 2: HTML structure validity
    const structureCheck = this.checkHtmlStructure(html);
    checks.push({ name: 'html-structure', ...structureCheck });
    if (!structureCheck.passed) errors.push(structureCheck.message);

    // Check 3: Stack compatibility
    const stackCheck = this.checkStackCompatibility(stack, html, css, js);
    checks.push({ name: 'stack-compatibility', ...stackCheck });
    if (!stackCheck.passed) warnings.push(stackCheck.message);

    // Check 4: File size limits
    const sizeCheck = this.checkFileSizes(html, css, js);
    checks.push({ name: 'file-size', ...sizeCheck });
    if (!sizeCheck.passed) warnings.push(sizeCheck.message);

    // Check 5: No forbidden patterns
    const securityCheck = this.checkSecurityPatterns(html, css, js);
    checks.push({ name: 'security-patterns', ...securityCheck });
    if (!securityCheck.passed) errors.push(securityCheck.message);

    // Check 6: Responsive meta tag
    const responsiveCheck = this.checkResponsiveMeta(html);
    checks.push({ name: 'responsive-meta', ...responsiveCheck });
    if (!responsiveCheck.passed) warnings.push(responsiveCheck.message);

    return {
      passed: errors.length === 0,
      checks,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run all post-build verification checks
   * @param {object} buildResult - { sessionId, html, fileSize, buildTime }
   * @returns {object} { passed, checks, warnings, errors }
   */
  async runPostBuildChecks(buildResult) {
    if (!this.enabled) {
      return { passed: true, checks: [], warnings: [], errors: [] };
    }

    const { html, fileSize, buildTime } = buildResult;
    const checks = [];
    const warnings = [];
    const errors = [];

    // Check 1: HTML renders without critical errors
    const renderCheck = this.checkHtmlRenders(html);
    checks.push({ name: 'html-renders', ...renderCheck });
    if (!renderCheck.passed) errors.push(renderCheck.message);

    // Check 2: File size is reasonable
    const sizeCheck = this.checkOutputFileSize(fileSize);
    checks.push({ name: 'output-size', ...sizeCheck });
    if (!sizeCheck.passed) warnings.push(sizeCheck.message);

    // Check 3: Build time is reasonable
    const timeCheck = this.checkBuildTime(buildTime);
    checks.push({ name: 'build-time', ...timeCheck });
    if (!timeCheck.passed) warnings.push(timeCheck.message);

    // Check 4: Contains essential landing page elements
    const essentialCheck = this.checkEssentialElements(html);
    checks.push({ name: 'essential-elements', ...essentialCheck });
    if (!essentialCheck.passed) warnings.push(essentialCheck.message);

    return {
      passed: errors.length === 0,
      checks,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check that HTML content exists and is not empty
   */
  checkHtmlContent(html) {
    if (!html || html.trim().length === 0) {
      return { passed: false, message: 'HTML content is empty', severity: 'error' };
    }
    if (html.trim().length < 50) {
      return { passed: false, message: 'HTML content is too short (less than 50 characters)', severity: 'warning' };
    }
    return { passed: true, message: 'HTML content is present and has reasonable length' };
  }

  /**
   * Check basic HTML structure
   */
  checkHtmlStructure(html) {
    if (!html) {
      return { passed: false, message: 'HTML is missing', severity: 'error' };
    }

    const issues = [];

    // Check for basic tags
    if (!html.includes('<')) {
      issues.push('No HTML tags found');
    }

    // Check for unmatched tags (basic check)
    const openTags = (html.match(/<[a-z][^/>]*>/gi) || []).length;
    const closeTags = (html.match(/<\/[a-z][^>]*>/gi) || []).length;
    const selfClosing = (html.match(/<[a-z][^>]*\/>/gi) || []).length;

    // Very rough check - not a real parser but catches obvious issues
    if (openTags > 0 && closeTags === 0 && selfClosing === 0) {
      issues.push('Opening tags found but no closing tags');
    }

    if (issues.length > 0) {
      return { passed: false, message: issues.join('; '), severity: 'warning' };
    }

    return { passed: true, message: 'HTML structure looks valid' };
  }

  /**
   * Check stack compatibility
   */
  checkStackCompatibility(stack, html, css, js) {
    const supportedStacks = config.stacks.supported;

    if (!stack) {
      return { passed: false, message: 'No stack specified', severity: 'warning' };
    }

    if (!supportedStacks.includes(stack)) {
      return { passed: false, message: `Stack "${stack}" is not in supported stacks list`, severity: 'warning' };
    }

    // Check for stack-specific patterns
    if (stack === 'react-tailwind' && html) {
      if (!html.includes('className') && !html.includes('class=')) {
        return { passed: true, message: 'Stack is React but no className detected - may need review' };
      }
    }

    return { passed: true, message: `Stack "${stack}" is supported` };
  }

  /**
   * Check file sizes are within limits
   */
  checkFileSizes(html, css, js) {
    const maxSize = config.preview.maxSizeBytes;
    const totalSize = (html?.length || 0) + (css?.length || 0) + (js?.length || 0);

    if (totalSize > maxSize) {
      return {
        passed: false,
        message: `Total file size (${totalSize} bytes) exceeds limit (${maxSize} bytes)`,
        severity: 'warning',
      };
    }

    return { passed: true, message: `Total file size (${totalSize} bytes) is within limits` };
  }

  /**
   * Check for security issues in code
   */
  checkSecurityPatterns(html, css, js) {
    const combined = `${html || ''} ${css || ''} ${js || ''}`;
    const forbiddenPatterns = [
      { pattern: /eval\s*\(/gi, name: 'eval() usage' },
      { pattern: /document\.write\s*\(/gi, name: 'document.write() usage' },
      { pattern: /innerHTML\s*=.*<script/gi, name: 'script injection via innerHTML' },
    ];

    const found = [];
    for (const { pattern, name } of forbiddenPatterns) {
      if (pattern.test(combined)) {
        found.push(name);
      }
    }

    if (found.length > 0) {
      return {
        passed: false,
        message: `Potentially unsafe patterns detected: ${found.join(', ')}`,
        severity: 'error',
      };
    }

    return { passed: true, message: 'No security issues detected' };
  }

  /**
   * Check for responsive viewport meta tag
   */
  checkResponsiveMeta(html) {
    if (!html) {
      return { passed: false, message: 'No HTML to check', severity: 'warning' };
    }

    const hasViewport = html.includes('viewport') && html.includes('width=device-width');
    const hasCharset = html.includes('charset');

    if (!hasViewport) {
      return { passed: false, message: 'Missing viewport meta tag for responsive design', severity: 'warning' };
    }

    if (!hasCharset) {
      return { passed: false, message: 'Missing charset declaration', severity: 'warning' };
    }

    return { passed: true, message: 'Responsive meta tags present' };
  }

  /**
   * Check that HTML renders (basic validation)
   */
  checkHtmlRenders(html) {
    if (!html || html.trim().length === 0) {
      return { passed: false, message: 'HTML is empty - nothing to render', severity: 'error' };
    }

    // Check for common rendering blockers
    if (html.includes('undefined') && html.includes('{{')) {
      return { passed: false, message: 'Possible template syntax not properly rendered', severity: 'warning' };
    }

    return { passed: true, message: 'HTML appears renderable' };
  }

  /**
   * Check output file size
   */
  checkOutputFileSize(fileSize) {
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!fileSize) {
      return { passed: true, message: 'No file size data available' };
    }

    if (fileSize > maxSize) {
      return { passed: false, message: `Output file (${fileSize} bytes) exceeds recommended size`, severity: 'warning' };
    }

    return { passed: true, message: `Output file size (${fileSize} bytes) is acceptable` };
  }

  /**
   * Check build time
   */
  checkBuildTime(buildTime) {
    const maxTime = 120000; // 2 minutes

    if (!buildTime) {
      return { passed: true, message: 'No build time data available' };
    }

    if (buildTime > maxTime) {
      return { passed: false, message: `Build took ${buildTime}ms, which is slower than expected`, severity: 'warning' };
    }

    return { passed: true, message: `Build completed in ${buildTime}ms` };
  }

  /**
   * Check for essential landing page elements
   */
  checkEssentialElements(html) {
    if (!html) {
      return { passed: false, message: 'No HTML to check', severity: 'warning' };
    }

    const lower = html.toLowerCase();
    const missing = [];

    // Check for heading
    if (!lower.includes('<h1') && !lower.includes('<h2')) {
      missing.push('heading (h1/h2)');
    }

    // Check for some form of CTA
    if (!lower.includes('<button') && !lower.includes('<a')) {
      missing.push('interactive element (button/link)');
    }

    // Check for images or visual elements
    if (!lower.includes('<img') && !lower.includes('background') && !lower.includes('<svg')) {
      missing.push('visual element (image/svg)');
    }

    if (missing.length > 0) {
      return {
        passed: false,
        message: `Missing recommended landing page elements: ${missing.join(', ')}`,
        severity: 'warning',
      };
    }

    return { passed: true, message: 'Essential landing page elements present' };
  }
}

module.exports = new BuildVerificationService();
