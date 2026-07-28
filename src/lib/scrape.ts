export function trimSuffix(str: string, suffix: string): string {
	if (!suffix) return str;
	return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
}

// prettier-ignore
let trackingParams = (['app','ra','source','medium','campaign','content','utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid','gbraid','wbraid','mc_eid','pk_campaign','pk_kwd','hsmi','hsenc','_hsenc','_hsmi','oly_enc_id','oly_anon_id','__s','vero_id','mkt_tok']);
let removeParams = (url: string, params: string[] | true): string => {
	try {
		let urlObj = new URL(url);
		if (params === true) {
			urlObj.search = '';
			return urlObj.toString();
		}
		let keysToDelete: string[] = [];
		let paramsSet = new Set(params);
		urlObj.searchParams.forEach((_value, key) => {
			if (paramsSet.has(key.toLowerCase())) keysToDelete.push(key);
		});
		keysToDelete.forEach((key) => urlObj.searchParams.delete(key));
		if (urlObj.searchParams.toString() === '') urlObj.search = '';
		return urlObj.toString();
	} catch (e) {
		console.error('Invalid URL:', e);
		return url;
	}
};

export let scrape = (externalUrl: string, externalDomString: string) => {
	let urlObj = new URL(externalUrl);
	let externalDom = new DOMParser().parseFromString(externalDomString, 'text/html');
	let querySelector = (s: string) => externalDom.querySelector(s) as null | HTMLElement;
	let querySelectorAll = (s: string) => [...externalDom.querySelectorAll(s)] as HTMLElement[];
	let extensionSearchQ = '';
	let tags: string[] = [];
	let headline =
		querySelector('meta[name="title"]')?.getAttribute('content') ||
		externalDom.title ||
		decodeURIComponent(
			externalUrl.slice(externalUrl.lastIndexOf('/') + 1), // for file pages
		);
	let url = removeParams(externalUrl, trackingParams);
	let pathnameSlugs = urlObj.pathname.split('/').slice(1);

	// TODO: IMDB for Movie genres https://www.imdb.com/title/tt1877832/
	let tldToSldToScraperMap: Record<string, undefined | Record<string, undefined | (() => void)>> = {
		com: {
			amazon: () => {
				if (pathnameSlugs.includes('dp')) {
					headline = querySelector('#productTitle')?.innerText || headline;
					let endI = Math.min(
						...[
							externalUrl.indexOf('?'), //
							externalUrl.indexOf('/ref='),
						].filter((n) => n !== -1),
					);
					url = externalUrl.slice(0, endI);
					// extensionSearchQ = `[amazon.com] ${pathnameSlugs[2]}`;
					// extensionSearchQ = `[amazon.com] ${pathnameSlugs[1]}`;
				}
			},
			ebay: () => {
				if (pathnameSlugs[0] === 'itm') {
					headline = querySelector('#mainContent h1 > span')?.innerText || headline;
					url = urlObj.origin + urlObj.pathname;
				}
			},
			imdb: () => {
				if (pathnameSlugs[0] === 'title') {
					let aTags = querySelectorAll(
						'section[data-testid="hero-parent"] section .ipc-chip-list__scroller a',
					);
					headline = querySelector('h1')?.innerText || '';
					let year = [
						...((querySelector('h1')?.nextElementSibling as HTMLElement).innerText || '').matchAll(
							/\d\d\d\d/g,
						),
					].at(-1)?.[0];
					console.log('year:', year);
					headline = `${headline}\n${querySelector('span[role="presentation"][data-testid="plot-l"]')?.innerText || ''}`;
					tags = aTags?.map((t) => t.innerText);
					if (year) tags.unshift(`${year.slice(0, 3) + '0'}s`);
					url = urlObj.origin + urlObj.pathname;
					extensionSearchQ = `[imdb.com] ${pathnameSlugs[1]}`;
				}
			},
			instagram: () => {
				if (pathnameSlugs[0] === 'p' || pathnameSlugs[0] === 'reel') {
					let moreOptionsButton = querySelector('[aria-label="More options"]');
					let handle =
						moreOptionsButton?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.querySelector(
							'a',
						)?.innerText;
					if (handle) tags = [`@${handle}`];
					headline =
						querySelector('span div div+span')?.innerText || //
						querySelector('h1')?.innerText ||
						'';
					// headline = selectAll('ul')[1].innerText;
					// headline = '';
				} else if (pathnameSlugs[0] === 'reels') {
					let spans = (
						querySelector('[aria-label="Adjust volume"]')?.nextSibling as HTMLElement
					)?.querySelectorAll('span');
					let texts = [...new Set([...spans].map((s) => s.innerText))].slice(1, -1);
					let handle = texts[0];
					tags = [`@${handle}`];
					headline = texts.slice(1).join('\n');
				} else if (pathnameSlugs[0] === querySelector('h2')?.innerText) {
					tags = [`@${pathnameSlugs[0]}`];
					headline = pathnameSlugs[0];
				}
			},
			reddit: () => {
				if (pathnameSlugs[0] === 'r') {
					tags = [pathnameSlugs.slice(0, 2).join('/')];
					headline = headline.slice(0, headline.lastIndexOf(' : '));
				}
			},
			soundcloud: () => {
				let handlePlaying = querySelector('a.playbackSoundBadge__lightLink')
					?.getAttribute('href')
					?.slice(1);
				if (handlePlaying) {
					let atHandle = '@' + handlePlaying;
					tags = [atHandle];
					headline =
						querySelector('a.playbackSoundBadge__titleLink span[aria-hidden="true"]')?.innerText ||
						headline;
					let trackUrlObj = new URL(
						(querySelector('a.playbackSoundBadge__titleLink') as HTMLAnchorElement)?.href,
					);
					url = urlObj.origin + trackUrlObj.pathname;
					extensionSearchQ = `[${atHandle}] ${trackUrlObj.pathname}`;
				}
			},
			tiktok: () => {
				if (pathnameSlugs[1] === 'video') {
					tags = [pathnameSlugs[0]];
					let vidDesc = (
						querySelector('[data-e2e="video-desc"]') ||
						querySelector('[data-e2e="browse-video-desc"]')
					)?.innerText;
					headline = vidDesc || headline;
				} else if (pathnameSlugs[0][0] === '@') {
					tags = [pathnameSlugs[0]];
					let bioElement = querySelector('[data-e2e="user-bio"]');
					headline = `${querySelector('h1')?.innerText}\n${bioElement?.innerText}\n${(bioElement?.nextSibling as HTMLElement)?.innerText || ''}`;
				}
			},
			unsplash: () => {
				if (pathnameSlugs[0] === 'photos') {
					let imgNode = querySelector('[class^="imageLayout-"] img') as HTMLImageElement;
					if (imgNode) headline = `${imgNode.alt}\n![](${removeParams(imgNode.src, true)})`;
					let atHandle = querySelector('header div[class^="photographer-"] a[class^="link-"]')
						?.getAttribute('href')
						?.slice(1);
					console.log('atHandle:', atHandle);
					if (atHandle) {
						extensionSearchQ = `[${atHandle}] ${pathnameSlugs[1]}`;
						tags = [atHandle];
					}
				}
			},
			x: () => {
				if (pathnameSlugs[1] === 'status') {
					let atHandle = `@${pathnameSlugs[0]}`;
					extensionSearchQ = `[${atHandle}] ${pathnameSlugs[2]}`;
					tags = [atHandle];
					// TODO: X has really messy HTML on purpose I think to make query selectors break. Make this more robust.
					let tweetBlock = querySelector(`a[href="/${pathnameSlugs.join('/')}"]`)?.parentElement
						?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
					headline =
						tweetBlock?.querySelector<HTMLElement>('[data-testid="tweetText"]')?.innerText ||
						headline;
				}
			},
			youtube: () => {
				if (pathnameSlugs[0] === 'watch') {
					headline = querySelector('h1 yt-formatted-string[title]')?.innerText || headline;
					let nameTag = querySelector('#top-row yt-formatted-string a');
					// TODO: scrape vids with multiple channel authors
					let ppHref = externalDom
						.querySelector('#owner > ytd-video-owner-renderer > a')
						?.getAttribute('href')!;
					let atHandle: string = ppHref?.startsWith('/channel/')
						? nameTag!.innerText
						: ppHref?.slice(1)!;
					if (atHandle) {
						extensionSearchQ = `[${atHandle}] ${urlObj.searchParams.get('v') || ''}`;
						tags = [atHandle];
					} else {
						tags = [
							...querySelectorAll(
								'.ytSpecDialogLayoutContainer .ytListViewModelHost .ytListItemViewModelSubtitleBadgeWrapper+span',
							),
						].map((s) => {
							let atHandle =
								'@' +
								s.innerText
									.slice(s.innerText.indexOf('@') + 1, s.innerText.indexOf(' '))
									.replace(/[^A-Za-z0-9._-]/g, '')
									.replace(/^[._-]+|[._-]+$/g, '');
							return atHandle;
						});
						extensionSearchQ = `${tags.map((t) => `[${t}]!`).join(' ')} ${urlObj.searchParams.get('v') || ''}`;
					}

					urlObj.searchParams.delete('app');
					urlObj.searchParams.delete('ra');
					if (urlObj.searchParams.get('list') === 'WL') {
						urlObj.searchParams.delete('list');
						urlObj.searchParams.delete('index');
					}
					url = urlObj.href;
				} else if (pathnameSlugs[0] === 'shorts') {
					let title = querySelector('.ytShortsVideoTitleViewModelShortsVideoTitle')?.innerText;
					let atHandle = querySelector('.ytAttributedStringLink')?.innerText;
					if (title) headline = title;
					if (atHandle) tags = [atHandle];
					extensionSearchQ = `[${atHandle}] ${urlObj.searchParams.get('v') || ''}`;
				} else if (pathnameSlugs[0] === 'post') {
					let atHandle: string =
						querySelector('#author-thumbnail a')?.getAttribute('href')?.slice(1) || '';
					tags = [atHandle];
					headline = querySelector('#content-text')?.innerText || '';
					extensionSearchQ = `[${atHandle}] ${pathnameSlugs[2]}`;
				} else if (pathnameSlugs[0] === 'playlist') {
					let atHandle = querySelector('yt-page-header-view-model a[href^="/@"]')
						?.getAttribute('href')
						?.slice(1);
					if (atHandle) {
						tags = [atHandle];
						headline =
							querySelector(
								'h1 .yt-core-attributed-string.yt-core-attributed-string--white-space-pre-wrap',
							)?.innerText || headline;
					} // albums have no atHandle: https://www.youtube.com/playlist?list=OLAK5uy_nV_H2i8w-Pm1IpTP1lolyAa2GY4u7tqbA
				} else if (pathnameSlugs[0][0] === '@') {
					headline = querySelector('h1.dynamicTextViewModelH1')?.innerText || headline;
					tags = [pathnameSlugs[0]];
				} else if (pathnameSlugs[0] === 'results') {
					headline = urlObj.searchParams.get('search_query') || headline;
				}
				headline = trimSuffix(headline, ' - YouTube');
			},
		},
		org: {
			wikipedia: () => {
				if (pathnameSlugs[0] === 'wiki') {
					headline = querySelector(`#firstHeading`)?.innerText ?? headline;
					extensionSearchQ = `[wikipedia.org] ${pathnameSlugs[1]}`;
				}
			},
		},
	};

	let [tld, sld] = urlObj.hostname.split('.', 3).reverse();
	tldToSldToScraperMap[tld]?.[sld]?.();
	tags.unshift(`${sld ? `${sld}.` : ''}${tld}`);
	headline = headline.trim();
	return {
		extensionSearchQ,
		tags,
		headline,
		url,
	};
};
