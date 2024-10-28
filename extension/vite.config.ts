import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
	plugins: [crx({ manifest })],
	// server: { port: 3000 }, // TODO: find a way to change ports
});
