// Run the asset server and Vite together.
import { spawn } from 'node:child_process';
const run = (cmd, args) => spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
const server = run('node', ['server.mjs']);
const vite = run('npx', ['vite', '--open']);
const stop = () => { server.kill(); vite.kill(); process.exit(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
