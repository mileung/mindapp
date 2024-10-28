export const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
	let timeoutId: ReturnType<typeof setTimeout>;

	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => {
			func(...args);
		}, delay);
	};
};

export const throttle = <T extends (...args: any[]) => void>(func: T, delay: number) => {
	let lastExecutedTime: number = 0;

	return (...args: Parameters<T>) => {
		const currentTime = Date.now();

		if (currentTime - lastExecutedTime >= delay) {
			func(...args);
			lastExecutedTime = currentTime;
		}
	};
};
