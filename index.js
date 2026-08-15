import { execSync } from 'child_process';
execSync('npx tsx server/index.ts', { stdio: 'inherit' });
