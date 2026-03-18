import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import { join } from 'path';

// Using recursive true which is available in Node 20.1+
const files = readdirSync('./tests', { recursive: true })
  .filter(f => f.endsWith('.test.ts'))
  .map(f => join('tests', f));

console.log('Running tests:', files);

const result = spawnSync('node', ['--import', 'tsx', '--test', ...files], { 
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

process.exit(result.status !== null ? result.status : 1);
