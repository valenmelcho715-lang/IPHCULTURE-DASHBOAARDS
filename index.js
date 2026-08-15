import { execSync } from 'child_process';
execSync('npm run build:server && node dist-server/index.js', { stdio: 'inherit' });
