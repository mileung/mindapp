import type { Config } from 'tailwindcss';

const config: Config = {
	content: ['./src/**/*.{js,jsx,ts,tsx}'],
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
};

export default config;
