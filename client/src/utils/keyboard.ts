import { useEffect } from 'react';

export function useKeyPress(
	input:
		| string
		| {
				key: string;
				modifiers?: string[];
				allowRepeats?: boolean;
		  },
	callback: (e: KeyboardEvent) => void,
	dependencies: any[],
) {
	useEffect(() => {
		const {
			key,
			modifiers = [],
			allowRepeats = false,
		} = typeof input === 'string' ? { key: input } : input;
		let isAboutToTrigger = !modifiers.length;
		const resetTrigger = () => {
			isAboutToTrigger = !modifiers.length;
		};
		const handleKeyMove = (event: KeyboardEvent) => {
			if (modifiers.includes(event.key)) {
				isAboutToTrigger = event.type === 'keydown';
			} else if (event.key === key && isAboutToTrigger && (allowRepeats || !event.repeat)) {
				callback(event);
			}
		};

		document.addEventListener('visibilitychange', resetTrigger);
		document.addEventListener('keydown', handleKeyMove);
		modifiers.length && document.addEventListener('keyup', handleKeyMove);
		return () => {
			document.removeEventListener('visibilitychange', resetTrigger);
			document.removeEventListener('keydown', handleKeyMove);
			document.removeEventListener('keyup', handleKeyMove);
		};
	}, [JSON.stringify(input), callback, ...(dependencies || [])]);
}
