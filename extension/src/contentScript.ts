console.log('Mindapp contentScript?');

// addEventListener('keydown', (e) => {
// 	if (
// 		['µ', 'π'].includes(e.key) && // alt m or alt p
// 		!['INPUT', 'TEXTAREA'].includes(document.activeElement!.tagName)
// 	) {
// 		const popupWidth = 700;
// 		const popupHeight = 500;
// 		const selector =
// 			urlSelectors[location.host + location.pathname]?.() || urlSelectors[location.host]?.();
// 		const thoughtHeadline = (
// 			selector?.headline ||
// 			window.getSelection()!.toString() ||
// 			findLargestText()
// 		).trim();

// 		// const searchParams = new URLSearchParams(params).toString();
// 		const searchParams = new URLSearchParams(
// 			JSON.parse(
// 				JSON.stringify({
// 					q: selector?.q,
// 					json: JSON.stringify({
// 						// https://news.ycombinator.com/item?id=31871577
// 						// 431 Request Header Fields Too Large
// 						// https://vitejs.dev/guide/troubleshooting.html#_431-request-header-fields-too-large
// 						// TODO: thoughtHeadline.slice(0, 99999) or something to avoid 431
// 						initialContent: `${thoughtHeadline}\n${selector?.url || location.href}\n\n`,
// 						initialTags: selector?.tags,
// 					}),
// 				}),
// 			),
// 		).toString();

// 		window.open(
// 			`http://localhost:1000/?${searchParams}`,
// 			'newWindow',
// 			`width=${popupWidth},height=${popupHeight},top=0,left=${99999999}`,
// 		);
// 	}
// });

// const urlSelectors: Record<
// 	string,
// 	undefined | (() => { headline: string; url?: string; tags?: string[]; q?: string })
// > = {
// 	'www.youtube.com/watch': () => {
// 		// @ts-ignore
// 		const title: string = document.querySelector('h1.style-scope.ytd-watch-metadata')?.innerText;
// 		const nameTag = document.querySelector(
// 			'#upload-info .yt-simple-endpoint.style-scope.yt-formatted-string',
// 		);
// 		const ppHref = decodeURIComponent(
// 			document.querySelector('#owner > ytd-video-owner-renderer > a')!.getAttribute('href')!,
// 		);

// 		const author: string = ppHref?.startsWith('/channel/')
// 			? // @ts-ignore
// 				nameTag.innerText
// 			: `YouTube${ppHref?.slice(1)!}`;

// 		const unwantedI = location.href.indexOf('&list=WL');

// 		return {
// 			headline: title,
// 			tags: [author],
// 			url: unwantedI === -1 ? location.href : location.href.substring(0, unwantedI),
// 			// q: getCurrentYouTubeVideoId() || undefined,
// 		};
// 	},
// 	'www.youtube.com/playlist': () => {
// 		const author: string = decodeURIComponent(
// 			document.querySelector('#owner-text > a')!.getAttribute('href')?.slice(1)!,
// 		);

// 		return { headline: findLargestText(), tags: [`YouTube${author}`] };
// 	},
// 	'www.youtube.com': () => {
// 		const author = location.pathname.startsWith('/@')
// 			? location.pathname.slice(1, location.pathname.indexOf('/', 1))
// 			: null;
// 		const tags = author ? ['YouTube Channel', `YouTube${author}`] : [];
// 		return { headline: findLargestText(), tags };
// 	},
// 	'x.com': () => {
// 		// @ts-ignore
// 		const tweetText = document.querySelector('[data-testid="tweetText"]')?.innerText;
// 		let author = location.pathname.slice(1);
// 		const i = author.indexOf('/');
// 		if (i !== -1) {
// 			author = author.slice(0, i);
// 		}
// 		return { headline: tweetText, tags: [`Twitter@${author}`] };
// 	},
// 	'www.reddit.com': () => {
// 		// @ts-ignore
// 		const headline = document.querySelector('div.top-matter > p.title > a')?.innerText;
// 		const subreddit = location.href.match(/\/(r\/[^/]+)/)?.[1];
// 		return { headline, tags: subreddit ? [subreddit] : [] };
// 	},
// 	'news.ycombinator.com': () => {
// 		// @ts-ignore
// 		const headline = document.querySelector('.titleline a')?.innerText;
// 		return { headline };
// 	},
// 	'www.amazon.com': () => {
// 		// @ts-ignore
// 		const headline = document.querySelector('#productTitle')?.innerText;
// 		const endI = Math.min(
// 			...[
// 				//
// 				location.href.indexOf('?'),
// 				location.href.indexOf('/ref='),
// 			].filter((n) => n !== -1),
// 		);
// 		const url = location.href.slice(0, endI);
// 		return { headline, url };
// 	},
// 	'www.ebay.com': () => {
// 		// @ts-ignore
// 		const headline = document.querySelector('#mainContent h1 > span')?.innerText;
// 		const endI = Math.min(
// 			...[
// 				//
// 				location.href.indexOf('?'),
// 			].filter((n) => n !== -1),
// 		);
// 		const url = location.href.slice(0, endI);
// 		return { headline, url };
// 	},
// 	'www.perplexity.ai': () => {
// 		// @ts-ignore
// 		const headline = document.querySelector('h1').innerText;
// 		console.log('headline:', headline);
// 		return { headline };
// 	},
// 	// 'www.perplexity.ai/search': () => {
// 	// 	const copyButton = document.querySelector(
// 	// 		'div.mt-sm.flex.items-center.justify-between > div.flex.items-center.gap-x-xs > button:nth-child(1)',
// 	// 	); // @ts-ignore
// 	// 	copyButton!.click(); // I tried. Doesn't work atm
// 	// 	return '';
// 	// },
// };

// function findLargestText() {
// 	const elementsWithText = document.querySelectorAll(
// 		'*:not(script):not(style):not(meta):not(title):not(link):not(br):not(hr):not(area):not(base):not(basefont):not(bgsound):not(col):not(command):not(embed):not(keygen):not(param):not(source):not(track):not(wbr)',
// 	);
// 	let largestFontSize = 0;
// 	let elementWithLargestFontSize: Element | null = null;
// 	elementsWithText.forEach((element) => {
// 		const computedStyle = window.getComputedStyle(element);
// 		const fontSize = parseFloat(computedStyle.fontSize);
// 		// @ts-ignore
// 		if (fontSize > largestFontSize && element.innerText?.trim()) {
// 			largestFontSize = fontSize;
// 			elementWithLargestFontSize = element;
// 		}
// 	});
// 	// @ts-ignore
// 	return elementWithLargestFontSize?.innerText;
// }

// const getCurrentYouTubeVideoId = () => {
// 	const url = new URL(window.location.href);
// 	return url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
// };

// export {};
