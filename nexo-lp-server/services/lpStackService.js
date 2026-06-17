/**
 * NEXO Landing Page Creator v3.0 - Stack Service
 *
 * Handles technology stack selection and validation.
 * Supports multiple frontend stacks for landing page generation.
 *
 * @module services/lpStackService
 * @version 3.0.0
 */

const config = require('../config/nexo-lp-config');

/**
 * Stack definitions with their configurations
 */
const STACK_DEFINITIONS = {
  'react-tailwind': {
    name: 'React + Tailwind CSS',
    description: 'Modern React with Tailwind CSS utility-first styling',
    framework: 'React',
    styling: 'Tailwind CSS',
    language: 'JavaScript/JSX',
    buildTool: 'Vite',
    template: 'default',
    features: ['components', 'hooks', 'responsive', 'dark-mode'],
    dependencies: ['react', 'react-dom', 'tailwindcss'],
    devDependencies: ['vite', '@vitejs/plugin-react', 'autoprefixer', 'postcss'],
    fileStructure: [
      'src/App.jsx',
      'src/main.jsx',
      'src/index.css',
      'index.html',
      'package.json',
      'vite.config.js',
      'tailwind.config.js',
    ],
    cdnSupport: false,
    recommended: true,
  },
  'vue-tailwind': {
    name: 'Vue + Tailwind CSS',
    description: 'Vue.js with Tailwind CSS for reactive landing pages',
    framework: 'Vue.js',
    styling: 'Tailwind CSS',
    language: 'JavaScript/Vue',
    buildTool: 'Vite',
    template: 'default',
    features: ['components', 'composables', 'responsive', 'transitions'],
    dependencies: ['vue', 'tailwindcss'],
    devDependencies: ['vite', '@vitejs/plugin-vue', 'autoprefixer', 'postcss'],
    fileStructure: [
      'src/App.vue',
      'src/main.js',
      'src/style.css',
      'index.html',
      'package.json',
      'vite.config.js',
      'tailwind.config.js',
    ],
    cdnSupport: false,
    recommended: false,
  },
  'html-css': {
    name: 'HTML + CSS',
    description: 'Plain HTML with custom CSS - no build step required',
    framework: 'None',
    styling: 'Custom CSS',
    language: 'HTML/CSS',
    buildTool: 'None',
    template: 'default',
    features: ['static', 'fast', 'simple', 'cdn-ready'],
    dependencies: [],
    devDependencies: [],
    fileStructure: [
      'index.html',
      'css/styles.css',
      'js/main.js',
    ],
    cdnSupport: true,
    recommended: false,
  },
  'nextjs-tailwind': {
    name: 'Next.js + Tailwind CSS',
    description: 'Full-stack React with SSR and Tailwind CSS',
    framework: 'Next.js',
    styling: 'Tailwind CSS',
    language: 'JavaScript/JSX',
    buildTool: 'Next.js',
    template: 'app-router',
    features: ['ssr', 'components', 'api-routes', 'image-optimization'],
    dependencies: ['next', 'react', 'react-dom', 'tailwindcss'],
    devDependencies: ['autoprefixer', 'postcss'],
    fileStructure: [
      'app/page.js',
      'app/layout.js',
      'app/globals.css',
      'package.json',
      'next.config.js',
      'tailwind.config.js',
    ],
    cdnSupport: false,
    recommended: false,
  },
};

class StackService {
  constructor() {
    this.stacks = STACK_DEFINITIONS;
    this.defaultStack = config.stacks.default;
    this.supportedStacks = config.stacks.supported;
  }

  /**
   * List all supported technology stacks
   * @returns {object[]} Array of stack definitions
   */
  listSupportedStacks() {
    return this.supportedStacks.map((key) => ({
      id: key,
      ...this.stacks[key],
    }));
  }

  /**
   * Get a specific stack definition
   * @param {string} stackId
   * @returns {object|null}
   */
  getStack(stackId) {
    return this.stacks[stackId] || null;
  }

  /**
   * Check if a stack is supported
   * @param {string} stackId
   * @returns {boolean}
   */
  isSupported(stackId) {
    return this.supportedStacks.includes(stackId);
  }

  /**
   * Get the default stack
   * @returns {object}
   */
  getDefaultStack() {
    return {
      id: this.defaultStack,
      ...this.stacks[this.defaultStack],
    };
  }

  /**
   * Validate a stack configuration
   * @param {string} stackId
   * @param {object} requirements - Optional requirements to check against
   * @returns {object} { valid, errors, warnings, stack }
   */
  validateStack(stackId, requirements = {}) {
    const errors = [];
    const warnings = [];

    // Check if stack exists
    const stack = this.getStack(stackId);
    if (!stack) {
      errors.push(`Stack "${stackId}" is not supported`);
      return { valid: false, errors, warnings: [], stack: null };
    }

    // Check if stack is in supported list
    if (!this.isSupported(stackId)) {
      warnings.push(`Stack "${stackId}" is defined but not in the supported stacks list`);
    }

    // Validate against requirements if provided
    if (requirements.features) {
      const missingFeatures = requirements.features.filter(
        (f) => !stack.features.includes(f)
      );
      if (missingFeatures.length > 0) {
        warnings.push(`Stack does not support features: ${missingFeatures.join(', ')}`);
      }
    }

    if (requirements.cdn && !stack.cdnSupport) {
      warnings.push('Stack does not support CDN-only deployment');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stack: {
        id: stackId,
        ...stack,
      },
    };
  }

  /**
   * Recommend a stack based on requirements
   * @param {object} requirements - { complexity, ssr, interactivity, familiarity }
   * @returns {object} Recommended stack
   */
  recommendStack(requirements = {}) {
    // Default to react-tailwind for most cases
    if (!requirements || Object.keys(requirements).length === 0) {
      return this.getDefaultStack();
    }

    // If SSR is needed, recommend Next.js
    if (requirements.ssr) {
      return {
        id: 'nextjs-tailwind',
        ...this.stacks['nextjs-tailwind'],
      };
    }

    // If simplicity is preferred, recommend HTML/CSS
    if (requirements.simplicity || requirements.noBuild) {
      return {
        id: 'html-css',
        ...this.stacks['html-css'],
      };
    }

    // If Vue familiarity
    if (requirements.familiarity === 'vue') {
      return {
        id: 'vue-tailwind',
        ...this.stacks['vue-tailwind'],
      };
    }

    // Default recommendation
    return this.getDefaultStack();
  }

  /**
   * Get stack-specific generation prompt prefix
   * @param {string} stackId
   * @returns {string}
   */
  getStackPromptPrefix(stackId) {
    const prefixes = {
      'react-tailwind': 'Generate a React component using Tailwind CSS classes. Use function components with hooks. Ensure responsive design.',
      'vue-tailwind': 'Generate a Vue single-file component using Tailwind CSS classes. Use the Composition API. Ensure responsive design.',
      'html-css': 'Generate plain HTML with inline CSS styling. Use semantic HTML5 elements. Ensure responsive design with media queries.',
      'nextjs-tailwind': 'Generate a Next.js page component using Tailwind CSS classes. Use the App Router structure. Ensure responsive design.',
    };
    return prefixes[stackId] || prefixes['react-tailwind'];
  }

  /**
   * Get the HTML wrapper template for a stack
   * @param {string} stackId
   * @returns {string}
   */
  getHtmlWrapper(stackId) {
    const wrappers = {
      'react-tailwind': '<div id="root"></div>',
      'vue-tailwind': '<div id="app"></div>',
      'html-css': '<!-- Content goes here -->',
      'nextjs-tailwind': '<main></main>',
    };
    return wrappers[stackId] || wrappers['html-css'];
  }

  /**
   * Get file extension for a stack
   * @param {string} stackId
   * @returns {string}
   */
  getFileExtension(stackId) {
    const extensions = {
      'react-tailwind': '.jsx',
      'vue-tailwind': '.vue',
      'html-css': '.html',
      'nextjs-tailwind': '.js',
    };
    return extensions[stackId] || '.html';
  }
}

module.exports = new StackService();
