import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const buildDir = path.join(repoRoot, 'dist', 'client');
const indexPath = path.join(buildDir, 'index.html');
const manifestPath = path.join(buildDir, '.vite', 'manifest.json');

async function ensureFile(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`${label} is missing at ${path.relative(repoRoot, filePath)}`);
  }
}

async function main() {
  await ensureFile(indexPath, 'Built index.html');

  let manifestMissing = false;
  try {
    await ensureFile(manifestPath, 'Vite manifest');
  } catch {
    manifestMissing = true;
  }

  const indexHtml = await readFile(indexPath, 'utf8');
  if (!indexHtml.includes('<div id="root"></div>')) {
    throw new Error('Built index.html does not contain the expected app root container');
  }

  if (manifestMissing) {
    console.warn('[verify-build-output] Warning: .vite/manifest.json was not found. This is acceptable if Vite manifest generation is disabled.');
  }

  console.log(`[verify-build-output] Verified build output in ${path.relative(repoRoot, buildDir)}`);
}

main().catch((error) => {
  console.error(`[verify-build-output] ${error.message}`);
  process.exitCode = 1;
});
