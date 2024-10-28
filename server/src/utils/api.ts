export const localApiHost = 'localhost:2000';

export function makeUrl(path: string, params?: Record<string, any>) {
	return buildUrl({ path, params });
}

export function buildUrl({
	host,
	https = !!host,
	path = '',
	params,
}: {
	https?: boolean;
	host?: string;
	path?: string;
	params?: Record<string, any>;
}) {
	let url = `http${https ? 's' : ''}://${(host || localApiHost).replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
	if (params) {
		url = `${url}?${new URLSearchParams(params).toString()}`;
	}
	// console.log('url:', url);
	return url;
}

export const ping = <T>(...args: Parameters<typeof fetch>): Promise<T> =>
	new Promise((resolve, reject) => {
		fetch(...args).then(async (res) => {
			const json = await res.json();
			return res.status === 200 ? resolve(json) : reject(json?.error || JSON.stringify(json));
		});
	});

export const post = (body: object) => ({
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(body),
});
