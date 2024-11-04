import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [],
	build: {
		outDir: 'dist',
		rollupOptions: {
			input: {
				content: 'src/content.ts',
			},
			output: {
				entryFileNames: '[name].js',
			},
		},
	},
});
