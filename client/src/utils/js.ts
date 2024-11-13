export function isRecord(value: unknown) {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sortKeysRecursively(thing: Record<string, any> | any[]): any[] {
	return Array.isArray(thing)
		? thing.map((e) => {
				return typeof e === 'object' && e !== null ? sortKeysRecursively(e) : e;
		  })
		: Object.entries(thing)
				.filter(([key, val]) => !!val)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, val]) => [key, isRecord(val) ? sortKeysRecursively(val) : val]);
}

// const isCenterOnLeft = () => window.screenX + window.innerWidth / 2 <= window.screen.width / 2;

export function isStringifiedRecord(value?: string) {
	if (!value) return false;
	try {
		const obj = JSON.parse(value);
		return isRecord(obj);
	} catch (error) {}
	return false;
}

export const shortenString = (str: string, startCount = 5, endCount = 5) => {
	if (str.length <= startCount + endCount) {
		return str;
	}
	return str.slice(0, startCount) + '~' + str.slice(-endCount);
};

export const copyToClipboardAsync = (str = '') => {
	if (navigator && navigator.clipboard && navigator.clipboard.writeText)
		return navigator.clipboard.writeText(str);
	return window.alert('The Clipboard API is not available.');
};

export const makeReadable = (err: any) =>
	err.toString() === '[object Object]' ? JSON.stringify(err) : err.toString();

export function clone<T>(obj: T): T {
	if (obj === null || obj === undefined) {
		return obj;
	}
	if (Array.isArray(obj)) {
		return obj.map((item) => clone(item)) as unknown as T;
	}
	if (typeof obj === 'object') {
		return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, clone(value)])) as T;
	}
	return obj;
}
