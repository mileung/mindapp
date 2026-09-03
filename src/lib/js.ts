import { browser } from '$app/environment';
import { page } from '$app/state';
import { PUBLIC_OWNER_MSS } from '$env/static/public';
import { m } from './paraglide/messages';
import { minute, second } from './time';

export let ownerViewItemsPerLoad = 88;
export let atDomainRegex = /^@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export let emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export let rulesAllowEmail = (rules: string[], email: string) =>
	rules.some((r) => (r[0] === '@' ? email!.endsWith(r) : r === email));

export let ownerMsSet = (() => {
	try {
		let arr = JSON.parse(PUBLIC_OWNER_MSS) as number[];
		return new Set(Array.isArray(arr) ? arr : []);
	} catch (error) {
		console.error('PUBLIC_OWNER_MSS !== number[]');
		return new Set([]);
	}
})();
export let inputIsOwner = (i: { callerMs: number }) => ownerMsSet.has(i.callerMs);
export let throwIf = (truthy: any) => {
	if (truthy) throw new Error(m.anErrorOccurred());
};
export let assertInputIsOwner = (i: { callerMs: number }) => throwIf(!inputIsOwner(i));

export let isTouchScreen = browser ? 'ontouchstart' in window || !!navigator.maxTouchPoints : false;
export let isIosOrIpadOs =
	/iPad|iPhone|iPod/.test(navigator.platform) ||
	(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export let linkClass =
	'align-top inline-block max-w-[calc(100%-88px)] mini-x-scroll text-fg1 hover:text-fg3 underline decoration-hl1 hover:decoration-hl2';

export let copyToClipboard = (text: string) => {
	if (navigator?.clipboard?.writeText) {
		navigator.clipboard.writeText(text);
	} else {
		let textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		let success = document.execCommand('copy');
		document.body.removeChild(textArea);
		Promise.resolve(success);
	}
};

export let poll = (
	callback: () => any,
	initialInterval: number = second,
	incrementFunction: (currentInterval: number) => number = (n) => n * 1.5,
	maxInterval: number = minute,
) => {
	let currentInterval = initialInterval;
	let executePoll = async () => {
		if (await callback()) return;
		currentInterval = Math.min(maxInterval, incrementFunction(currentInterval));
		setTimeout(executePoll, currentInterval);
	};
	setTimeout(executePoll, currentInterval);
};

export let debounce = <T extends (...args: any[]) => any>(
	func: T,
	wait: number = 400,
): ((...args: Parameters<T>) => void) => {
	let timeout: NodeJS.Timeout | null = null;
	return function (this: any, ...args: Parameters<T>): void {
		let context = this;
		let later = () => {
			timeout = null;
			func.apply(context, args);
		};
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
};

export let throttle = <T extends unknown[]>(callback: (...args: T) => void, delay: number) => {
	let isWaiting = false;
	return (...args: T) => {
		if (isWaiting) return;
		callback(...args);
		isWaiting = true;
		setTimeout(() => (isWaiting = false), delay);
	};
};

export let isRecord = (value: unknown) =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

export let isStringifiedRecord = (value?: string) => {
	try {
		return isRecord(JSON.parse(value!));
	} catch (e) {}
	return false;
};

// prettier-ignore
let KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";

// prettier-ignore
let ROMAJI_MAP: Record<string, string> = {
  ア: "a", イ: "i", ウ: "u", エ: "e", オ: "o",
  カ: "ka", キ: "ki", ク: "ku", ケ: "ke", コ: "ko",
  サ: "sa", シ: "shi", ス: "su", セ: "se", ソ: "so",
  タ: "ta", チ: "chi", ツ: "tsu", テ: "te", ト: "to",
  ナ: "na", ニ: "ni", ヌ: "nu", ネ: "ne", ノ: "no",
  ハ: "ha", ヒ: "hi", フ: "fu", ヘ: "he", ホ: "ho",
  マ: "ma", ミ: "mi", ム: "mu", メ: "me", モ: "mo",
  ヤ: "ya", ユ: "yu", ヨ: "yo",
  ラ: "ra", リ: "ri", ル: "ru", レ: "re", ロ: "ro",
  ワ: "wa", ヲ: "wo", ン: "n"
};

let getSeededRandom = (input: string | number, index: number) => {
	let str = String(input) + index;
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
	}
	hash ^= hash >>> 16;
	hash *= 0x85ebca6b;
	hash ^= hash >>> 13;
	hash *= 0xc2b2ae35;
	hash ^= hash >>> 16;
	return hash >>> 0;
};

export let identikana = (input: number, romanized = true) => {
	if (!input) return m.anon();
	let seq: string[] = [];
	for (let i = 0; i < 3; i++) {
		let seed = getSeededRandom(input, i);
		let idx = Math.floor((seed / 0x100000000) * KATAKANA.length);
		seq.push(KATAKANA[idx]);
	}

	if (!romanized) return seq.join('');
	return seq
		.map((k, i) => (!i ? ROMAJI_MAP[k][0].toUpperCase() + ROMAJI_MAP[k].slice(1) : ROMAJI_MAP[k]))
		.join('');
};

export let isStrInt = (s: string) => /^\d+$/.test(s);

let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export let ranStr = (length = 88) => {
	let bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

export let sortObjectProps = (obj: Record<string, any>) => {
	Object.keys(obj)
		.sort()
		.forEach((key) => {
			const temp = obj[key];
			delete obj[key];
			obj[key] = temp;
		});
	return obj;
};

export let ranInt = (a: number, b: number) => {
	const min = Math.min(a, b);
	const max = Math.max(a, b);
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

export let sqlocalOkCookieName = 'sqlocalOk';
export let getRequestEnablesSqlocal = (request: Request) =>
	(request.headers.get('cookie') ?? '')
		.split(';') //
		.some((c) => c.trim() === `${sqlocalOkCookieName}=1`);
export let setSqlocalOkClientCookie = (enabled: boolean) => {
	document.cookie = enabled
		? `${sqlocalOkCookieName}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
		: `${sqlocalOkCookieName}=; path=/; max-age=0; samesite=lax`;
};

export let supportsCredentiallessIframe =
	!0 ||
	(typeof HTMLIFrameElement !== 'undefined' && //
		'credentialless' in HTMLIFrameElement.prototype);

export let deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj)) as T;

type UniqueValues<T extends Record<string, number>> = {
	[K in keyof T]: T[K] extends T[Exclude<keyof T, K>] ? never : T[K];
};
export let uniqueMapVals = <const T extends Record<string, number>>(dict: UniqueValues<T>): T =>
	dict;

export let makeErrorReadable = (error: unknown) => {
	// @ts-ignore
	return error?.message || JSON.stringify(error);
};

export let alertError = (error: unknown) => {
	console.error(error);
	alert(makeErrorReadable(error));
};

export let splitUntil = (str: string, delimiter: string, limit: number): string[] => {
	let result: string[] = [];
	let start = 0;
	let splits = 0;
	while (splits < limit) {
		let end = str.indexOf(delimiter, start);
		if (end === -1) break;
		result.push(str.substring(start, end));
		start = end + delimiter.length;
		splits++;
	}
	result.push(str.substring(start));
	return result;
};
// console.log(splitUntil('0_1_2_3', '_', 2));

export let hasDefinedKeysBesidesMs = (obj: Object) =>
	Object.entries(obj).some(([k, v]) => k !== 'ms' && v !== undefined);

export let getAlteredSearchParams = (
	obj: Record<string, string | number | boolean | null | undefined>,
	pathname?: string,
) => {
	let url = new URL(page.url);
	let searchParams = new URLSearchParams(url.search);
	for (let [key, value] of Object.entries(obj)) {
		if (value === null) searchParams.delete(key);
		else searchParams.set(key, String(value));
	}
	let newSearch = searchParams
		.toString()
		.replace(/%2C/g, ',')
		.replace(/=&/g, '&')
		.replace(/=(undefined|$)/g, '');
	return `${pathname || url.pathname}${newSearch ? '?' + newSearch : ''}${url.hash}`;
};

let seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
let countGraphemes = (str: string) => {
	return [...seg.segment(str)].length;
};
// https://github.com/slevithan/emoji-regex-xs
let r = String.raw;
let base = r`\p{Emoji}(?:\p{EMod}|[\u{E0020}-\u{E007E}]+\u{E007F}|\uFE0F?\u20E3?)`;
let emojiRegex = new RegExp(r`\p{RI}{2}|(?![#*\d](?!\uFE0F?\u20E3))${base}(?:\u200D${base})*`, 'u');
export let is1Emoji = (s: string) => countGraphemes(s) === 1 && emojiRegex.test(s);
