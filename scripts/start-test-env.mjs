import { spawn } from 'node:child_process';

const children = [];

function run(name, cmd, args, extraEnv = {}) {
  const child = spawn(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: false,
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`\n[${name}] exited with code ${code}. Stopping test environment.`);
      shutdown(code || 1);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('\nReflectivAI Test Environment');
console.log('---------------------------------------');
console.log('Starting local Worker and frontend...');
console.log('When ready, open: http://localhost:4173/RolePlaySimulator');
console.log('To stop everything: press Ctrl + C\n');

run('worker', 'npm', ['run', 'worker:dev']);
run('frontend', 'npm', ['run', 'dev', '--', '--host', '--port', '4173']);
