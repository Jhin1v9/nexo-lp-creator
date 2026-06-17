/**
 * zipGenerator.js — NEXO Landing Page Creator v3.0
 * Generates a ZIP archive from a project directory, excluding node_modules, .git, .env.
 * Requires the 'archiver' npm package.
 */

const fs = require('fs');
const path = require('path');

// Lazy-load archiver to avoid hard dependency issues
let archiver;
try {
  archiver = require('archiver');
} catch (e) {
  archiver = null;
}

// Default exclusion patterns
const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  '.env',
  '.env.local',
  '.env.production',
  '.env.development',
  '.DS_Store',
  'Thumbs.db',
  '*.log',
  'npm-debug.log*',
  'yarn-debug.log*',
  'yarn-error.log*',
  '.npm',
  '.yarn',
  '.pnp.*',
  'coverage',
  '.nyc_output',
  '.cache',
  '.parcel-cache',
  '.next',
  'dist',
  'build',
  '.vscode',
  '.idea',
  '*.zip',
  '*.tar.gz',
];

/**
 * Generate a ZIP archive from a project directory.
 * @param {string} sourceDir - Directory to zip
 * @param {Object} options - Configuration
 * @returns {Promise<{buffer: Buffer, outputPath: string}>}
 */
function generateZip(sourceDir, options = {}) {
  return new Promise((resolve, reject) => {
    if (!archiver) {
      return reject(
        new Error(
          'The "archiver" package is required for ZIP generation. Install it with: npm install archiver'
        )
      );
    }

    const {
      outputPath = null, // If null, returns buffer only
      excludes = DEFAULT_EXCLUDES,
      includeRootFolder = true, // If true, root folder is included in zip
      customEntries = [], // Additional entries: [{ type: 'file|directory', source, name }]
      compression = 'deflate', // 'deflate' or 'store'
      compressionLevel = 6, // 0-9
    } = options;

    if (!fs.existsSync(sourceDir)) {
      return reject(new Error(`Source directory does not exist: ${sourceDir}`));
    }

    const archive = archiver('zip', {
      zlib: { level: compressionLevel },
      store: compression === 'store',
    });

    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('error', (err) => reject(err));
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('ZIP warning:', err.message);
      } else {
        reject(err);
      }
    });

    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);

      // Write to file if outputPath is provided
      if (outputPath) {
        try {
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, buffer);
        } catch (writeErr) {
          return reject(writeErr);
        }
      }

      resolve({
        buffer,
        outputPath,
        size: buffer.length,
        filesProcessed: archive.pointer(),
      });
    });

    // Build glob-based exclusion pattern for archiver
    const globOptions = {
      cwd: sourceDir,
      dot: true,
      ignore: excludes.map((ex) => {
        if (ex.includes('*')) return ex;
        return `**/${ex}/**`;
      }),
    };

    // Add main directory contents
    if (includeRootFolder) {
      const rootName = path.basename(sourceDir);
      archive.directory(sourceDir, rootName, (entryData) => {
        const name = entryData.name;
        for (const exclude of excludes) {
          if (exclude.includes('*')) {
            const regex = new RegExp(exclude.replace(/\*/g, '.*'));
            if (regex.test(name)) return false;
          } else if (name.includes(`/${exclude}/`) || name === exclude || name.startsWith(`${exclude}/`)) {
            return false;
          }
        }
        return entryData;
      });
    } else {
      archive.directory(sourceDir, false);
    }

    // Add custom entries
    customEntries.forEach((entry) => {
      if (entry.type === 'file' && fs.existsSync(entry.source)) {
        archive.file(entry.source, { name: entry.name });
      } else if (entry.type === 'directory' && fs.existsSync(entry.source)) {
        archive.directory(entry.source, entry.name);
      } else if (entry.type === 'buffer' && Buffer.isBuffer(entry.source)) {
        archive.append(entry.source, { name: entry.name });
      } else if (entry.type === 'string' && typeof entry.source === 'string') {
        archive.append(entry.source, { name: entry.name });
      }
    });

    archive.finalize();
  });
}

/**
 * Generate a ZIP buffer from a flat list of files (key-value: filename -> content).
 * @param {Object} files - { 'index.html': '<html>...', 'style.css': '...' }
 * @param {Object} options - { outputPath }
 * @returns {Promise<{buffer: Buffer, outputPath: string}>}
 */
function generateZipFromFiles(files, options = {}) {
  return new Promise((resolve, reject) => {
    if (!archiver) {
      return reject(
        new Error(
          'The "archiver" package is required for ZIP generation. Install it with: npm install archiver'
        )
      );
    }

    const { outputPath = null, compressionLevel = 6 } = options;

    const archive = archiver('zip', {
      zlib: { level: compressionLevel },
    });

    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('error', (err) => reject(err));
    archive.on('end', () => {
      const buffer = Buffer.concat(chunks);

      if (outputPath) {
        try {
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, buffer);
        } catch (writeErr) {
          return reject(writeErr);
        }
      }

      resolve({
        buffer,
        outputPath,
        size: buffer.length,
        fileCount: Object.keys(files).length,
      });
    });

    Object.entries(files).forEach(([filePath, content]) => {
      if (Buffer.isBuffer(content)) {
        archive.append(content, { name: filePath });
      } else if (typeof content === 'string') {
        archive.append(content, { name: filePath });
      } else {
        console.warn(`Skipping file ${filePath}: unsupported content type`);
      }
    });

    archive.finalize();
  });
}

/**
 * Quick check if archiver is available.
 * @returns {boolean}
 */
function isArchiverAvailable() {
  return archiver !== null;
}

/**
 * Get default exclusion list.
 * @returns {string[]}
 */
function getDefaultExcludes() {
  return [...DEFAULT_EXCLUDES];
}

module.exports = {
  generateZip,
  generateZipFromFiles,
  isArchiverAvailable,
  getDefaultExcludes,
  DEFAULT_EXCLUDES,
};
