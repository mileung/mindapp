import { PopupMessage } from './background';

// TODO: Users should be able to assign shortcuts in /settings
// The frontend and bg script would send messages and
// save settings in chrome.storage.sync
let oldMindappDevUrl = 'http://localhost:1234';
let newMindappDevUrl = 'http://localhost:8888';
let newMindappPreviewUrl = 'http://localhost:1111';
let newMindappUrl = 'https://mindapp.cc';

chrome.runtime.onMessage.addListener((msg) => {
	if (['context-menu-clicked', 'extension-icon-clicked'].includes(msg.type))
		openPopup(newMindappUrl, true);
});

if (
	[
		oldMindappDevUrl,
		newMindappDevUrl,
		newMindappPreviewUrl,
		newMindappUrl, //
	].some((url) => location.href.startsWith(url))
) {
	window.addEventListener('message', async (event) => {
		if (event.source !== window) return;
		if (event.data.type === '2-popup-requests-external-page-info') {
			window.postMessage({
				type: '4-popup-receives-external-page-info',
				payload: await chrome.runtime.sendMessage({
					type: '3-content-script-retrieves-saved-page-info',
				}),
			});
		}
	});
}

window.addEventListener('keydown', (e) => {
	let baseUrl = '';
	if (e.altKey && e.code === 'KeyM') {
		baseUrl = newMindappUrl;
	} else if (e.altKey && e.code === 'KeyD') {
		baseUrl = newMindappDevUrl;
	} else if (e.altKey && e.code === 'KeyP') {
		baseUrl = newMindappPreviewUrl;
	} else if (e.altKey && e.code === 'KeyG') {
		baseUrl = oldMindappDevUrl;
	}
	if (baseUrl && !['INPUT', 'TEXTAREA'].includes(document.activeElement!.tagName)) {
		openPopup(baseUrl, e.code !== 'KeyG');
	}
});

let openPopup = (baseUrl: string, sendBgMessage = false) => {
	let selector =
		urlSelectors[location.host + location.pathname]?.() || urlSelectors[location.host]?.();

	let txtHeadline =
		// TODO: This doesn't return the highlighted text all the time - e.g. go to a reddit post and try highlighting the headline and clipping: https://www.reddit.com/r/videos/comments/10oak86/goldsmith_uses_chemistry_to_refine_indistinct/
		(
			window.getSelection()?.toString() ||
			// getSelectionAsMarkdown() ||
			// TODO: selectionToMarkdown() ||
			selector?.headline ||
			// TODO: pageToMarkdown() ||
			getTitle()
		).trim();

	if (sendBgMessage) {
		chrome.runtime.sendMessage({
			type: '1-content-amd-background-scripts-save-page-info',
			url: window.location.href,
			externalDomString: document.documentElement.outerHTML,
			selectedPlainText: window.getSelection()?.toString().trim(),
			selectedHtmlString: (() => {
				let selection = window.getSelection();
				if (selection && selection.rangeCount !== 0) {
					let range = selection.getRangeAt(0);
					let fragment = range.cloneContents();
					let div = document.createElement('div');
					div.appendChild(fragment.cloneNode(true));
					return div.innerHTML;
				}
			})(),
		} as PopupMessage);
	}

	// TODO: allow postId (to reply to) as a param
	// TODO: imagine turn based stateless apps like tic-tac-toe or chess
	// where the "submit" button opens new tab with url params for
	// tags, core, postId. Allow altMindappUrl for other mindapp instances
	// TODO: Games where it's your turn show up under "Your turn" on post feed.
	// The hierarchical nature of the posts would allow games to branch off into many threads
	window.open(
		sendBgMessage //
			? baseUrl + '?extension'
			: `${baseUrl}?${new URLSearchParams({
					json: JSON.stringify({
						// https://news.ycombinator.com/item?id=31871577
						// 431 Request Header Fields Too Large
						// https://vitejs.dev/guide/troubleshooting.html#_431-request-header-fields-too-large
						// TODO: txtHeadline.slice(0, 99999) or something to avoid 431
						initialContent: `${txtHeadline}\n${selector?.url || location.href}\n\n`,
						initialTags: selector?.tags,
					}),
				}).toString()}`,
		'_blank',
		`width=888,height=500,top=0,left=999999999`,
	);
};

let urlSelectors: Record<
	string,
	undefined | (() => { headline?: string; url?: string; tags?: string[] })
> = {
	'news.ycombinator.com': () => {
		return { headline: getTitle().slice(0, -14) };
	},
	'www.perplexity.ai': () => {
		return { headline: document.querySelector('h1')?.innerText };
	},
	'www.reddit.com': () => {
		let subreddit = location.href.match(/\/(r\/[^/]+)/)?.[1];
		// TODO: get the post body as markdown
		// e.g. https://www.reddit.com/r/UI_Design/comments/vzqe34/menu_knowledge_is_essential/
		return { headline: getTitle(), tags: subreddit ? [subreddit] : [] };
	},
	'www.youtube.com/watch': () => {
		// @ts-ignore
		let title: string = document.querySelector('h1.style-scope.ytd-watch-metadata')?.innerText;
		let nameTag = document.querySelector('#top-row yt-formatted-string a');
		let ppHref = decodeURIComponent(
			document.querySelector('#owner > ytd-video-owner-renderer > a')?.getAttribute('href')!,
		);

		let author: string = ppHref?.startsWith('/channel/')
			? // @ts-ignore
				nameTag.innerText
			: `YouTube${ppHref?.slice(1)!}`;

		let url = location.href.replace('app=desktop&', '');
		if (url.includes('list=WL')) {
			url = url.replace('&list=WL', '');
			url = url.replace(/&index=\d+/, '');
		}
		return {
			headline: title,
			tags: [author],
			url,
		};
	},
	'www.youtube.com/playlist': () => {
		let author: string = decodeURIComponent(
			document
				.querySelector('yt-page-header-view-model a[href^="/@"]')
				?.getAttribute('href')
				?.slice(1)!,
		);

		return {
			headline: document.querySelector<HTMLHeadElement>(
				'h1 .yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap',
			)?.innerText,
			tags: [`YouTube${author}`],
		};
	},
	'www.youtube.com': () => {
		let author = location.pathname.startsWith('/@')
			? location.pathname.slice(1, location.pathname.indexOf('/', 1))
			: null;
		let tags = author ? ['YouTube Channel', `YouTube${author}`] : [];
		return {
			headline: document.querySelector<HTMLHeadElement>('h1.dynamic-text-view-model-wiz__h1')
				?.innerText,
			tags,
		};
	},
	'x.com': () => {
		let author = location.pathname.slice(1);
		let i = author.indexOf('/');
		if (i !== -1) author = author.slice(0, i);
		let tweetId = location.pathname.match(/\/status\/(\d+)/)?.[1];
		// TODO: X has really messy messy HTML on purpose I think to make query selectors break. Make this more robust.
		let tweetBlock = document.querySelector(`a[href="/${author}/status/${tweetId}"]`)?.parentElement
			?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
		let tweetText = tweetBlock?.querySelector<HTMLElement>('[data-testid="tweetText"]')?.innerText;

		return {
			headline: tweetText,
			tags: [`X@${author}`],
		};
	},
	'www.amazon.com': () => {
		let headline = document.querySelector<HTMLElement>('#productTitle')?.innerText;
		let endI = Math.min(
			...[
				//
				location.href.indexOf('?'),
				location.href.indexOf('/ref='),
			].filter((n) => n !== -1),
		);
		let url = location.href.slice(0, endI);
		return { headline, url };
	},
	'www.ebay.com': () => {
		let headline = document.querySelector<HTMLElement>('#mainContent h1 > span')?.innerText;
		let endI = Math.min(
			...[
				//
				location.href.indexOf('?'),
			].filter((n) => n !== -1),
		);
		let url = location.href.slice(0, endI);
		return { headline, url };
	},
};

let getTitle = () =>
	document //
		.querySelector('meta[name="title"]')
		?.getAttribute('content') || document.title;
