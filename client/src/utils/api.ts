// import { useLocation } from '@solidjs/router';

import { isServer } from 'solid-js/web';

export const hostedLocally = isServer ? false : location.host.startsWith('localhost:');
export const localClientHost = hostedLocally ? location.host : '';
export const localApiHost = 'localhost:2000';
export const testingClientLocallyAsNormie = isServer ? false : location.host === 'localhost:1001';

export const defaultSpaceHost = hostedLocally
	? ''
	: testingClientLocallyAsNormie
	? 'localhost:8080'
	: 'api.mindapp.cc';

export function makeUrl(path: string, params?: Record<string, any>) {
	return buildUrl({ path, params });
}

export function buildUrl({
	host,
	https,
	path = '',
	params,
}: {
	host?: string;
	https?: boolean;
	path?: string;
	params?: Record<string, any>;
}) {
	if (https === undefined) https = !!host && !host.startsWith('localhost:');
	let url = `http${https ? 's' : ''}://${(host || localApiHost).replace(/\/+$/, '')}/${path.replace(
		/^\/+/,
		'',
	)}`;
	if (params) {
		url = `${url}?${new URLSearchParams(params).toString()}`;
	}
	// console.log('url:', url);
	return url;
}

export const ping = <T>(...args: Parameters<typeof fetch>): Promise<T> =>
	new Promise((resolve, reject) => {
		fetch(...args)
			.then(async (res) => {
				const json = await res.json();
				return res.status === 200 ? resolve(json) : reject(json?.error || JSON.stringify(json));
			})
			.catch((e) => reject(e));
	});

export const post = (body: object) => ({
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(body),
});
