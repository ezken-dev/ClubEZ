// Root entrypoint for Bot-Hosting / Pterodactyl panels that execute "node index.js" by default.
// This file uses tsx (installed via package.json) to run the real TypeScript server entrypoint.
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsx = path.join(__dirname, 'node_modules', '.bin', 'tsx');
const server = path.join(__dirname, 'server.ts');

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', server], {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('[ENTRYPOINT ERROR] Failed to start server.ts:', err.message);
  process.exit(1);
});
