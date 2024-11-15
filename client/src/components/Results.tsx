import { A, useLocation, useSearchParams } from '@solidjs/router';
import { Icon } from 'solid-heroicons';
import { barsArrowDown, barsArrowUp, chatBubbleLeftRight } from 'solid-heroicons/solid-mini';
import { createEffect, createMemo, createSignal, For, onCleanup } from 'solid-js';
import ThoughtBlock from '~/components/ThoughtBlock';
import { ThoughtWriter } from '~/components/ThoughtWriter';
import {
	useActiveSpace,
	authors,
	authorsSet,
	mentionedThoughts,
	mentionedThoughtsSet,
	personas,
	roots,
	rootsSet,
	useTagTree,
} from '~/utils/state';
import { Thought, getThoughtId, isThoughtId } from '../utils/ClientThought';
import { bracketRegex, getAllSubTags, getTags } from '../utils/tags';
import { sendMessage } from '~/utils/signing';
import { SignedAuthor } from '~/types/Author';
import { buildUrl, hostedLocally, localApiHost, ping, post } from '~/utils/api';
import { clone } from '~/utils/js';

// const authorIdRegex = /^@[A-HJ-NP-Za-km-z1-9]{9,}$/;
const authorIdRegex = /^@\w*$/;
function isAuthorId(str = '') {
	return authorIdRegex.test(str);
}

export const modes = ['new', 'old'];
const authorIdsRegex = /\B@\w*/g;
const quoteRegex = /"([^"]+)"/g;

export default function Results() {
	const [searchParams] = useSearchParams();
	const searchedText = createMemo(() => searchParams.q?.toString() || '');
	const mode = createMemo(() => {
		const searchedMode = searchParams.mode?.toString().toLowerCase() || '';
		return modes.includes(searchedMode) ? searchedMode : 'new';
	});

	const userSearchParams = createMemo(() => {
		const searchedTags = getTags(searchedText());
		const allTags: Set<string> = new Set(searchedTags);
		searchedTags.forEach((tag) => {
			const arr = getAllSubTags(useTagTree(), tag);
			arr.forEach((tag) => allTags.add(tag));
		});
		let searchedTextNoTagsOrAuthors = searchedText()
			.replace(bracketRegex, ' ')
			.replace(authorIdsRegex, ' ');
		const thoughtId = isThoughtId(searchedText()) ? searchedText() : undefined;
		const authorIds = searchedText()
			.match(authorIdsRegex)
			?.map((a) => a.slice(1));
		const quotes = (searchedTextNoTagsOrAuthors.match(quoteRegex) || []).map((match) =>
			match.slice(1, -1),
		);
		const other = [
			...quotes,
			...searchedTextNoTagsOrAuthors
				.replace(quoteRegex, ' ')
				.split(/\s+/g)
				.filter((a) => !!a)
				.map((s) => s.toLowerCase()),
		].filter((str) => str !== thoughtId);

		return {
			searchedText: searchedText(),
			mode: mode(),
			tags: [...allTags],
			thoughtId,
			authorIds,
			other,
		};
	});
	const { thoughtId } = userSearchParams();
	let thoughtsBeyond = mode() === 'old' ? 0 : Number.MAX_SAFE_INTEGER;
	let pinging = false;
	let linkingThoughtId = '';

	const [queriedThoughtRoot, queriedThoughtRootSet] = createSignal<null | Thought>(null);
	createEffect(() => {
		const newQueriedThoughtRoot = (userSearchParams().thoughtId && roots[0] && roots[0]) || null;
		newQueriedThoughtRoot && queriedThoughtRootSet(newQueriedThoughtRoot);
	});

	const pluggedIn = createMemo(
		() => useActiveSpace().fetchedSelf !== null || !useActiveSpace().host,
	);

	const [restrainLoad, restrainLoadSet] = createSignal(!!searchParams.json?.toString());

	const loadMoreThoughts = async () => {
		if (!pluggedIn() || pinging) return;
		const lastRoot = roots.slice(-1)[0];
		if (lastRoot === null || !useActiveSpace()) return;
		const ignoreRootIds = roots.map((root) => root && getThoughtId(root));
		pinging = true;
		sendMessage<{
			mentionedThoughts: Record<string, Thought>;
			authors: Record<string, SignedAuthor>;
			latestCreateDate: number;
			roots: Thought[];
		}>({
			from: personas[0].id,
			to: buildUrl({ host: useActiveSpace().host || localApiHost, path: 'get-roots' }),
			query: {
				...userSearchParams(),
				ignoreRootIds,
				thoughtsBeyond,
			},
		})
			.then((data) => {
				// console.log('data:', data);
				authorsSet({ ...authors, ...data.authors });
				mentionedThoughtsSet({ ...mentionedThoughts, ...data.mentionedThoughts });
				const rootsPerLoad = 8;
				const newRoots = roots.concat(data.roots);
				data.roots.length < rootsPerLoad && newRoots.push(null);
				thoughtsBeyond = data.latestCreateDate;
				rootsSet(newRoots);

				if (hostedLocally) {
					ping(buildUrl({ host: localApiHost, path: 'save-roots' }), post({ roots: data.roots }))
						// .then((res) => console.log('res:', res))
						.catch((err) => alert(err));
				}
			})
			.catch((err) => console.error(err))
			.finally(() => (pinging = false));
	};

	createEffect(() => {
		let rootsLengthLastLoad: number;
		const handleScroll = async () => {
			restrainLoad() && restrainLoadSet(false);
			const scrollPosition = window.innerHeight + window.scrollY;
			const documentHeight = document.body.offsetHeight;
			if (roots.slice(-1)[0] !== null && scrollPosition >= documentHeight - 2000) {
				if (roots.length !== rootsLengthLastLoad) {
					rootsLengthLastLoad = roots.length;
					loadMoreThoughts();
				}
			}
		};

		window.addEventListener('scroll', handleScroll);
		onCleanup(() => window.removeEventListener('scroll', handleScroll));
	});

	createEffect(() => {
		if (!restrainLoad() && !roots.length && !pinging && pluggedIn()) {
			mentionedThoughtsSet({});
			thoughtsBeyond = mode() === 'old' ? 0 : Number.MAX_SAFE_INTEGER;
			loadMoreThoughts();
		}
	});

	createEffect((p) => {
		const key = JSON.stringify([userSearchParams(), personas[0].spaceHosts[0]]);
		if (p === key) return p;
		queriedThoughtRootSet(null);
		rootsSet([]);
		return key;
	});

	return (
		<div class="w-full">
			{queriedThoughtRoot() && (
				<div class="mb-1">
					<ThoughtBlock
						highlightedId={thoughtId}
						// @ts-ignore
						thought={queriedThoughtRoot}
						roots={roots}
						rootsIndices={[0]}
						onRootsChange={(newRoots) => {
							newRoots = clone(newRoots);
							if (
								!newRoots[0] ||
								getThoughtId(newRoots[0]) !== getThoughtId(queriedThoughtRoot()!)
							) {
								queriedThoughtRootSet(null);
							} else {
								queriedThoughtRootSet(newRoots[0]);
							}
							rootsSet(newRoots);
						}}
					/>
				</div>
			)}
			{!pluggedIn() ? (
				<p class="text-xl text-fg2 text-center font-semibold">Couldn't join space </p>
			) : (
				<div class="space-y-1.5">
					<ThoughtWriter
						initialContent={thoughtId}
						onWrite={({ mentionedThoughts: mentions, thought }, ctrlKey) => {
							ctrlKey && (linkingThoughtId = getThoughtId(thought));
							setTimeout(() => {
								mentionedThoughtsSet({ ...mentionedThoughts, ...mentions });
								rootsSet(
									queriedThoughtRoot()
										? [roots[0], thought, ...roots.slice(1)]
										: [thought, ...roots],
								);
							}, 0);
						}}
					/>
					{/* TODO: To me (Awaiting interaction) */}
					{/* TODO: From me (My interactions) */}

					{/* TODO: Pending response */}
					{/* TODO: Root posts */}
					{/* TODO: Post replies */}
					{/* TODO: Strong upvotes */}
					{/* TODO: Strong downvotes */}
					{/* TODO: Weak upvotes */}
					{/* TODO: Weak downvotes */}
					<div class="fx gap-3">
						{thoughtId && (
							<p class="text-xl leading-4 text-fg2 text-center">
								{roots.length <= 2 ? 'No mentions' : 'Mentions'}
							</p>
						)}
						{(
							[
								// [fire, 'Hot'],
								// [trophy, 'Top'],
								[barsArrowDown, 'New'],
								[barsArrowUp, 'Old'],

								// This could just be a query getting post that await a user's interaction
								// [chatBubbleLeftRight, 'Replies'],
							] as const
						).map(([iconPath, label], i) => {
							const params: Record<string, string> = {};
							if (searchedText()) params.q = searchedText();
							if (i) params.mode = label.toLowerCase();
							const href = '/?' + new URLSearchParams(params).toString();
							return (
								<A
									replace
									class={`h-4 fx transition hover:text-fg1 ${
										userSearchParams().mode.toLocaleLowerCase() === label.toLocaleLowerCase()
											? 'text-fg1'
											: 'text-fg2'
									}`}
									href={href}
									// onClick={(e) => !e.metaKey && !e.shiftKey && rootsSet([])}
								>
									<Icon path={iconPath} class="h-5 w-5" />
									<p class="ml-1 font-semibold">{label}</p>
								</A>
							);
						})}
					</div>
					{!roots.length ? (
						<div class="xy">
							<p class="text-lg font-semibold">
								{restrainLoad() ? 'Scroll down to load' : 'Loading...'}
							</p>
						</div>
					) : (
						<div class=" space-y-1.5">
							<For each={roots.slice(thoughtId ? 1 : 0)}>
								{(thought, i) => {
									if (!thought) return;
									const thoughtId = getThoughtId(thought);
									return (
										<ThoughtBlock
											initiallyLinking={linkingThoughtId === thoughtId}
											thought={() => thought}
											roots={roots}
											rootsIndices={[i() + (queriedThoughtRoot() ? 1 : 0)]}
											onRootsChange={(newRoots) => {
												rootsSet(clone(newRoots));
											}}
										/>
									);
								}}
							</For>
							{thoughtId && roots[0] === null && (
								<div class="xy h-40">
									<p class="text-2xl">Thought not found</p>
								</div>
							)}
							{!thoughtId && roots[0] === null && (
								<p class="text-2xl text-center">No thoughts found</p>
							)}
							{roots.length > 1 && roots.slice(-1)[0] === null && (
								<p class="text-xl text-fg2 text-center">End of results </p>
							)}
						</div>
					)}
				</div>
			)}
			{/* This is for when the initial 8 roots that load don't extend past the bottom of the screen making scrolling impossible */}
			{roots[roots.length - 1] !== null && <div class="h-screen"></div>}
		</div>
	);
}
