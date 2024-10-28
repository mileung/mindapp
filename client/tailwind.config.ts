import type { Config } from 'tailwindcss';

const config: Config = {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	darkMode: 'class',
	theme: {
		extend: {
			fontFamily: {
				sans: ['Quicksand Variable', 'sans-serif'],
				mono: ['Fira Code Variable', 'monospace'],
			},
			colors: {
				clear: 'var(--clear)',
				bg1: 'var(--bg1)',
				bg2: 'var(--bg2)',
				mg1: 'var(--mg1)',
				mg2: 'var(--mg2)',
				fg1: 'var(--fg1)',
				fg2: 'var(--fg2)',
			},
		},
	},
	// plugins: {
	// 	'postcss-import': {},
	// 	'tailwindcss/nesting': {},
	// 	tailwindcss: {},
	// 	autoprefixer: {},
	// },
};

export default config;
