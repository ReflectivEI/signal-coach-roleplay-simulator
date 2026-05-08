import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(repoRoot, 'snapshots', 'cd30-pages-bundle');
const buildDir = path.join(repoRoot, 'dist', 'client');

async function main() {
  await rm(buildDir, { recursive: true, force: true });
  await mkdir(path.dirname(buildDir), { recursive: true });
  await cp(sourceDir, buildDir, { recursive: true });
  console.log(`[restore-cd30-bundle] Restored ${path.relative(repoRoot, sourceDir)} to ${path.relative(repoRoot, buildDir)}`);
}

main().catch((error) => {
  console.error(`[restore-cd30-bundle] ${error.message}`);
  process.exitCode = 1;
});