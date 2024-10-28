import { exec } from 'child_process';
import env from './utils/env';

exec(
	`fly secrets set ${Object.entries(env)
		.map(([key, value]) => `${key}="${value}"`)
		.join(' ')} --stage`,
	(error) => {
		if (error) {
			console.error(`exec error: ${error}`);
			return;
		}
		console.log(`Fly.io secrets set`);
	},
);
