console.log('Mindapp contentScript');

addEventListener('keydown', (e) => {
	if (
		['µ', 'π'].includes(e.key) && // alt m or alt p
		!['INPUT', 'TEXTAREA'].includes(document.activeElement!.tagName)
	) {
		const popupWidth = 700;
		const popupHeight = 500;
		const selector =
			urlSelectors[location.host + location.pathname]?.() || urlSelectors[location.host]?.();
		const thoughtHeadline = (
			selector?.headline ||
			window.getSelection()!.toString() ||
			// getHighlightedTextAsMd() ||
			findLargestText()
		).trim();

		// const searchParams = new URLSearchParams(params).toString();
		const searchParams = new URLSearchParams(
			JSON.parse(
				JSON.stringify({
					q: selector?.q,
					json: JSON.stringify({
						// https://news.ycombinator.com/item?id=31871577
						// 431 Request Header Fields Too Large
						// https://vitejs.dev/guide/troubleshooting.html#_431-request-header-fields-too-large
						// TODO: thoughtHeadline.slice(0, 99999) or something to avoid 431
						initialContent: `${thoughtHeadline}\n${selector?.url || location.href}\n\n`,
						initialTags: selector?.tags,
					}),
				}),
			),
		).toString();

		window.open(
			`http://localhost:1234/?${searchParams}`,
			'newWindow',
			`width=${popupWidth},height=${popupHeight},top=0,left=${99999999}`,
		);
	}
});

const urlSelectors: Record<
	string,
	undefined | (() => { headline?: string; url?: string; tags?: string[]; q?: string })
> = {
	'www.youtube.com/watch': () => {
		// @ts-ignore
		const title: string = document.querySelector('h1.style-scope.ytd-watch-metadata')?.innerText;
		const nameTag = document.querySelector('#top-row yt-formatted-string a');
		const ppHref = decodeURIComponent(
			document.querySelector('#owner > ytd-video-owner-renderer > a')!.getAttribute('href')!,
		);

		const author: string = ppHref?.startsWith('/channel/')
			? // @ts-ignore
				nameTag.innerText
			: `YouTube${ppHref?.slice(1)!}`;

		const unwantedI = location.href.indexOf('&list=WL');

		return {
			headline: title,
			tags: [author],
			url: unwantedI === -1 ? location.href : location.href.substring(0, unwantedI),
			// q: getCurrentYouTubeVideoId() || undefined,
		};
	},
	'www.youtube.com/playlist': () => {
		const author: string = decodeURIComponent(
			document.querySelector('#owner-text > a')!.getAttribute('href')?.slice(1)!,
		);

		return { headline: findLargestText(), tags: [`YouTube${author}`] };
	},
	'www.youtube.com': () => {
		const author = location.pathname.startsWith('/@')
			? location.pathname.slice(1, location.pathname.indexOf('/', 1))
			: null;
		const tags = author ? ['YouTube Channel', `YouTube${author}`] : [];
		return { headline: findLargestText(), tags };
	},
	'x.com': () => {
		// @ts-ignore
		let author = location.pathname.slice(1);
		const i = author.indexOf('/');
		if (i !== -1) {
			author = author.slice(0, i);
		}
		const tweetId = location.pathname.match(/\/status\/(\d+)/)?.[1];
		// TODO: Twitter has really messy messy HTML on purpose I think to make query selectors break. Make this more robust.
		const tweetBlock = document.querySelector(`a[href="/${author}/status/${tweetId}"]`)
			?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
		// @ts-ignore
		const tweetText = tweetBlock?.querySelector('[data-testid="tweetText"]')?.innerText;

		return {
			headline: tweetText,
			// No I will not change this to X@
			tags: [`Twitter@${author}`],
		};
	},
	'www.reddit.com': () => {
		// @ts-ignore
		const headline = document.querySelector('div.top-matter > p.title > a')?.innerText;
		const subreddit = location.href.match(/\/(r\/[^/]+)/)?.[1];
		return { headline, tags: subreddit ? [subreddit] : [] };
	},
	'news.ycombinator.com': () => {
		// @ts-ignore
		const headline = document.querySelector('.titleline a')?.innerText;
		return { headline };
	},
	'www.amazon.com': () => {
		// @ts-ignore
		const headline = document.querySelector('#productTitle')?.innerText;
		const endI = Math.min(
			...[
				//
				location.href.indexOf('?'),
				location.href.indexOf('/ref='),
			].filter((n) => n !== -1),
		);
		const url = location.href.slice(0, endI);
		return { headline, url };
	},
	'www.ebay.com': () => {
		// @ts-ignore
		const headline = document.querySelector('#mainContent h1 > span')?.innerText;
		const endI = Math.min(
			...[
				//
				location.href.indexOf('?'),
			].filter((n) => n !== -1),
		);
		const url = location.href.slice(0, endI);
		return { headline, url };
	},
	'www.perplexity.ai': () => {
		// @ts-ignore
		const headline = document.querySelector('h1')?.innerText;
		console.log('headline:', headline);
		return { headline };
	},
	// 'www.perplexity.ai/search': () => {
	// 	const copyButton = document.querySelector(
	// 		'div.mt-sm.flex.items-center.justify-between > div.flex.items-center.gap-x-xs > button:nth-child(1)',
	// 	); // @ts-ignore
	// 	copyButton!.click(); // I tried. Doesn't work atm
	// 	return '';
	// },
};

function findLargestText() {
	const elementsWithText = document.querySelectorAll(
		'*:not(script):not(style):not(meta):not(title):not(link):not(br):not(hr):not(area):not(base):not(basefont):not(bgsound):not(col):not(command):not(embed):not(keygen):not(param):not(source):not(track):not(wbr)',
	);
	let largestFontSize = 0;
	let elementWithLargestFontSize: Element | null = null;
	elementsWithText.forEach((element) => {
		const computedStyle = window.getComputedStyle(element);
		const fontSize = parseFloat(computedStyle.fontSize);
		// @ts-ignore
		if (fontSize > largestFontSize && element.innerText?.trim()) {
			largestFontSize = fontSize;
			elementWithLargestFontSize = element;
		}
	});
	// @ts-ignore
	return elementWithLargestFontSize?.innerText;
}

const getCurrentYouTubeVideoId = () => {
	const url = new URL(window.location.href);
	return url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
};

function getHighlightedTextAsMd(): string {
	const selection = window.getSelection();
	if (!selection || !selection.rangeCount) return '';

	const range = selection.getRangeAt(0);
	const fragment = range.cloneContents();
	const tempDiv = document.createElement('div');
	tempDiv.appendChild(fragment);

	function getAbsoluteUrl(url: string): string {
		const a = document.createElement('a');
		a.href = url;
		return a.href;
	}

	function processNode(node: Node): string {
		if (node.nodeType === Node.TEXT_NODE) {
			let text = node.textContent?.replace(/\s+/g, ' ') || '';
			const parentElement = node.parentElement;
			if (parentElement) {
				const styles = window.getComputedStyle(parentElement);
				if (styles.fontWeight === 'bold' || parseInt(styles.fontWeight) >= 700) {
					text = `**${text}**`;
				}
				if (styles.fontStyle === 'italic') {
					text = `*${text}*`;
				}
				if (styles.textDecoration.includes('line-through')) {
					text = `~~${text}~~`;
				}
			}
			return text;
		}
		if (node.nodeType === Node.ELEMENT_NODE) {
			let content = Array.from(node.childNodes).map(processNode).join('').replace(/\s+/g, ' ');

			if (node instanceof HTMLAnchorElement) {
				const href = getAbsoluteUrl(node.getAttribute('href') || '');
				return `[${content.trim()}](${href}) `;
			}

			return content;
		}
		return '';
	}
	return processNode(tempDiv).replace(/\s+/g, ' ').trim();
}

export {};

// can my chrome extension add suggestions in url bar
// https://www.perplexity.ai/search/can-my-chrome-extension-add-su-k3v324tMQHiu8Sf1BshL9w
