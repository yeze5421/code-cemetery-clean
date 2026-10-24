import electron from 'electron';
import { spawn } from 'node:child_process';
const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: environment,
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
