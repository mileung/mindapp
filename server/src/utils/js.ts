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
