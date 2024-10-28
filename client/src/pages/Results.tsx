import {
	BarsArrowDownIcon,
	BarsArrowUpIcon,
	ChatBubbleBottomCenterTextIcon,
	ChatBubbleLeftRightIcon,
	FireIcon,
	TableCellsIcon,
	TrophyIcon,
} from '@heroicons/react/16/solid';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import ThoughtBlock from '../components/ThoughtBlock';
import { Thought, getThoughtId, isThoughtId } from '../utils/ClientThought';
import { buildUrl, hostedLocally, localApiHost, ping, post } from '../utils/api';
import { isStringifiedRecord } from '../utils/js';
import {
	useActiveSpace,
	useMentionedThoughts,
	useAuthors,
	usePersonas,
	useSendMessage,
	useTagTree,
} from '../utils/state';
import { ThoughtWriter } from '../components/ThoughtWriter';
import { SignedAuthor } from '../types/Author';
import { bracketRegex, getAllSubTags, getTags } from '../utils/tags';

const defaultColumnLabels = ['createDate', 'authorId', 'spaceHost', 'content', 'tags', 'parentId'];

// const authorIdRegex = /^@[A-HJ-NP-Za-km-z1-9]{9,}$/;
const authorIdRegex = /^@\w*$/;
function isAuthorId(str = '') {
	return authorIdRegex.test(str);
}

export const modes = ['new', 'old', 'table'];
const authorIdsRegex = /\B@\w*/g;
const quoteRegex = /"([^"]+)"/g;
function getQuotes(q: string) {
	return (q.match(quoteRegex) || []).map((match) => match.slice(1, -1));
}

export type UrlQuery = {
	mode: 'new' | 'old' | 'table';
	thoughtId?: string;
	authorIds?: string[];
	tags?: string[];
	other?: string[];
};

export function deconstructPathname(pathname: string) {
	pathname = pathname.replace(/\/+$/, '');
	if (!pathname.length) pathname = '/';
	const mode = (modes.find((mode) => pathname.endsWith('/' + mode)) ||
		modes[0]) as UrlQuery['mode'];
	const slashModeIndex = pathname.indexOf('/' + mode);
	let thoughtId: undefined | string;
	let authorId: undefined | string;
	const id = pathname.slice(1, mode === modes[0] ? undefined : slashModeIndex);
	if (isThoughtId(id)) {
		thoughtId = id;
	} else if (isAuthorId(id)) authorId = id.slice(1);
	let pathnameWithoutMode = mode === modes[0] ? pathname : pathname.slice(0, slashModeIndex);
	pathnameWithoutMode = pathnameWithoutMode.replace(/\/+$/, '');
	if (!pathnameWithoutMode.length) pathnameWithoutMode = '/';
	return { thoughtId, authorId, mode, pathnameWithoutMode };
}

export default function Results() {
	const activeSpace = useActiveSpace();
	const location = useLocation();
	const [searchParams, searchParamsSet] = useSearchParams();
	const sendMessage = useSendMessage();
	const [personas] = usePersonas();
	const [authors, authorsSet] = useAuthors();
	const [mentionedThoughts, mentionedThoughtsSet] = useMentionedThoughts();
	const [queriedThoughtRoot, queriedThoughtRootSet] = useState<null | Thought>(null);
	const [roots, rootsSet] = useState<(null | Thought)[]>([]);
	const [columnLabels, columnLabelsSet] = useState(defaultColumnLabels);

	const [tagTree] = useTagTree();
	const q = searchParams.get('q') || '';
	const { thoughtId, authorId, mode, pathnameWithoutMode } = useMemo(
		() => deconstructPathname(location.pathname),
		[location.pathname],
	);
	const tags = getTags(q);
	const urlQuery = useMemo(() => {
		const urlQuery: UrlQuery = {
			mode,
			thoughtId,
			authorIds:
				authorId !== undefined ? [authorId] : q.match(authorIdsRegex)?.map((a) => a.slice(1)),
			other: [
				...getQuotes(q),
				...q
					.replace(bracketRegex, ' ')
					.replace(quoteRegex, ' ')
					.replace(authorIdsRegex, ' ')
					.split(/\s+/g)
					.filter((a) => !!a)
					.map((s) => s.toLowerCase()),
			],
		};
		const allTags: Set<string> = new Set(tags);

		tags.forEach((tag) => {
			if (!tagTree) return;
			const arr = getAllSubTags(tagTree, tag);
			arr.forEach((tag) => allTags.add(tag));
		});

		urlQuery.tags = [...allTags];
		return urlQuery;
	}, [thoughtId, authorId, mode, pathnameWithoutMode, q, tagTree]);

	const queriedThoughtId = useMemo(() => urlQuery?.thoughtId, [urlQuery?.thoughtId]);
	const thoughtsBeyond = useRef(urlQuery.mode === 'old' ? 0 : Number.MAX_SAFE_INTEGER);
	const pinging = useRef(false);
	const rootTextArea = useRef<HTMLTextAreaElement>(null);
	const boundingDv = useRef<HTMLDivElement>(null);
	const linkingThoughtId = useRef('');

	useEffect(() => {
		queriedThoughtId && roots[0] && queriedThoughtRootSet(roots[0]);
	}, [roots]);

	const pluggedIn = useMemo(
		() => activeSpace.fetchedSelf !== null || !activeSpace.host,
		[activeSpace],
	);

	const loadMoreThoughts = useCallback(async () => {
		if (!pluggedIn || pinging.current) return;
		const lastRoot = roots.slice(-1)[0];
		if (lastRoot === null || !activeSpace) return;
		const ignoreRootIds =
			urlQuery.mode !== 'table'
				? roots.map((root) => root && getThoughtId(root))
				: roots
						.filter((r) => r?.createDate === roots.slice(-1)[0]?.createDate)
						.map((r) => getThoughtId(r!));
		pinging.current = true;

		sendMessage<{
			mentionedThoughts: Record<string, Thought>;
			authors: Record<string, SignedAuthor>;
			latestCreateDate: number;
			roots: Thought[];
		}>({
			from: personas[0].id,
			to: buildUrl({ host: activeSpace.host || localApiHost, path: 'get-roots' }),
			query: {
				...urlQuery,
				ignoreRootIds,
				thoughtsBeyond: thoughtsBeyond.current,
			},
		})
			.then((data) => {
				// console.log('data:', data);
				authorsSet({ ...authors, ...data.authors });
				mentionedThoughtsSet({ ...mentionedThoughts, ...data.mentionedThoughts });
				const rootsPerLoad = urlQuery.mode === 'table' ? 40 : 8;
				const newRoots = roots.concat(data.roots);
				data.roots.length < rootsPerLoad && newRoots.push(null);
				thoughtsBeyond.current = data.latestCreateDate;
				rootsSet(newRoots);

				data.roots.forEach((root) => {
					if (isStringifiedRecord(root.content)) {
						const newColumnLabels = [...columnLabels];
						newColumnLabels.unshift(
							...Object.keys(JSON.parse(root.content!)).filter((a) => !columnLabels.includes(a)),
						);
						columnLabelsSet(newColumnLabels);
					}
				});

				if (hostedLocally) {
					ping(buildUrl({ host: localApiHost, path: 'save-roots' }), post({ roots: data.roots }))
						// .then((res) => console.log('res:', res))
						.catch((err) => alert(err));
				}
			})
			.catch((err) => console.error(err))
			.finally(() => (pinging.current = false));
	}, [pluggedIn, activeSpace, sendMessage, personas[0], roots, urlQuery]);

	useEffect(() => {
		let rootsLengthLastLoad: number;
		const handleScroll = () => {
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
		return () => window.removeEventListener('scroll', handleScroll);
	}, [roots, loadMoreThoughts]);

	useEffect(() => {
		if (tagTree && !roots.length && !pinging.current && pluggedIn) {
			mentionedThoughtsSet({});
			thoughtsBeyond.current = urlQuery.mode === 'old' ? 0 : Number.MAX_SAFE_INTEGER;
			loadMoreThoughts();
		}
	}, [tagTree, urlQuery.mode, roots, pluggedIn, loadMoreThoughts]);

	useEffect(() => {
		rootsSet([]);
	}, [location, personas[0].spaceHosts[0]]);

	return (
		<div className="flex-1 max-w-full">
			{pathnameWithoutMode === '/' ||
			urlQuery.thoughtId ||
			urlQuery.authorIds?.length ||
			urlQuery.tags?.length ||
			urlQuery.other?.length ? (
				urlQuery &&
				(!tags.length || tagTree) &&
				(!pluggedIn ? (
					<p className="text-xl text-fg2 text-center font-semibold">Couldn't join space </p>
				) : (
					<div className="space-y-1.5">
						{pathnameWithoutMode === '/' && (
							<ThoughtWriter
								parentRef={rootTextArea}
								initialContent={queriedThoughtId}
								onWrite={({ mentionedThoughts: mentions, thought }, ctrlKey) => {
									ctrlKey && (linkingThoughtId.current = getThoughtId(thought));
									setTimeout(() => {
										mentionedThoughtsSet({ ...mentionedThoughts, ...mentions });
										rootsSet([thought, ...roots]);
									}, 0);
								}}
							/>
						)}
						{queriedThoughtRoot && (
							<ThoughtBlock
								highlightedId={queriedThoughtId}
								thought={queriedThoughtRoot}
								roots={roots}
								rootsIndices={[0]}
								onNewRoot={() => rootTextArea.current?.focus()}
								onRootsChange={(newRoots) => {
									if (
										!newRoots[0] ||
										getThoughtId(newRoots[0]) !== getThoughtId(queriedThoughtRoot)
									)
										queriedThoughtRootSet(null);
									rootsSet(newRoots);
								}}
							/>
						)}
						{/* TODO: To me (Awaiting interaction) */}
						{/* TODO: From me (My interactions) */}

						{/* TODO: Pending response */}
						{/* TODO: Root posts */}
						{/* TODO: Post replies */}
						{/* TODO: Strong upvotes */}
						{/* TODO: Strong downvotes */}
						{/* TODO: Weak upvotes */}
						{/* TODO: Weak downvotes */}
						<div className="fx gap-3">
							{queriedThoughtId && roots.length > 1 && (
								<p className="text-xl leading-4 text-fg2 text-center">
									{roots.length === 2 ? 'No mentions' : 'Mentions'}
								</p>
							)}
							{(
								[
									// [FireIcon, 'Hot'],
									// [ChatBubbleLeftRightIcon, 'Replies'],
									// [TrophyIcon, 'Top'],
									[BarsArrowDownIcon, 'New'],
									// [BarsArrowUpIcon, 'Old'],
									// [TableCellsIcon, 'Table'],
								] as const
							).map(([Icon, label], i) => {
								const to = `${pathnameWithoutMode}${pathnameWithoutMode === '/' ? '' : '/'}${!i ? '' : label.toLowerCase()}`;
								return (
									<Link
										key={label}
										replace
										className={`h-4 fx transition hover:text-fg1 ${mode.toLocaleLowerCase() === label.toLocaleLowerCase() ? 'text-fg1' : 'text-fg2'}`}
										to={to}
										onClick={(e) => !e.metaKey && !e.shiftKey && rootsSet([])}
									>
										<Icon className="h-5 w-5" />
										<p className="ml-1 font-medium">{label}</p>
									</Link>
								);
							})}
						</div>
						{!roots.length ? (
							<div className="xy">
								<p className="text-lg font-semibold">Loading...</p>
							</div>
						) : (
							<div
								className="relative space-y-1.5"
								onClick={() => {
									setTimeout(() => {
										if (
											boundingDv.current &&
											boundingDv.current.clientHeight < window.innerHeight + 500
										) {
											loadMoreThoughts();
										}
									}, 0);
								}}
								ref={boundingDv}
							>
								{urlQuery.mode !== 'table'
									? roots.slice(queriedThoughtId ? 1 : 0).map((thought, i) => {
											if (!thought) return;
											const thoughtId = getThoughtId(thought);
											return (
												<ThoughtBlock
													key={thoughtId}
													initiallyLinking={linkingThoughtId.current === thoughtId}
													thought={thought}
													roots={roots}
													rootsIndices={[i + (queriedThoughtRoot ? 1 : 0)]}
													onNewRoot={() => rootTextArea.current?.focus()}
													onRootsChange={(newRoots) => rootsSet(newRoots)}
												/>
											);
										})
									: roots.length > (queriedThoughtId ? 2 : 1) && (
											<div className="-mx-3 w-screen overflow-x-scroll">
												<div
													className="grid gap-0 w-fit border border-fg2"
													style={{
														gridTemplateColumns: `auto repeat(${columnLabels.length}, minmax(5rem, 1fr))`,
													}}
												>
													{['', ...columnLabels].map((field, i) => (
														<div key={i} className="flex font-mono px-1 border border-fg2">
															{!!i && (
																<>
																	<div className="border-r-2 border-fg2 pr-1 mr-1">
																		{numberToLetter(i - 1)}
																	</div>
																	<div className="truncate">{field}</div>
																</>
															)}
														</div>
													))}
													{roots.slice(queriedThoughtId ? 1 : 0).map((thought, i) => {
														const contentAsRecord = isStringifiedRecord(thought?.content)
															? (JSON.parse(thought!.content!) as Record<string, any>)
															: null;
														return (
															thought && (
																<React.Fragment key={getThoughtId(thought)}>
																	<div className="w-full fy whitespace-pre font-mono px-1 border border-fg2">
																		{String(i)}
																	</div>
																	{columnLabels.map((col) => {
																		const val = defaultColumnLabels.includes(col)
																			? // @ts-ignore
																				thought[col]
																			: contentAsRecord
																				? contentAsRecord[col]
																				: undefined;
																		return (
																			<button
																				key={col}
																				className="flex justify-start font-mono px-1 border border-fg2 truncate -outline-offset-1 hover:outline hover:outline-sky-600 focus:outline focus:outline-sky-500 hover:z-20 focus:z-10"
																			>
																				{typeof val === 'object'
																					? JSON.stringify(val)
																					: val === undefined
																						? ''
																						: String(val)}
																			</button>
																		);
																	})}
																</React.Fragment>
															)
														);
													})}
												</div>
											</div>
										)}
								{queriedThoughtId && roots[0] === null && (
									<div className="xy h-40">
										<p className="text-2xl">Thought not found</p>
									</div>
								)}
								{/* This is for when the initial 8 roots that load don't extend past the bottom of the screen making scrolling impossible */}
								{roots.length === 8 && <div className="h-screen"></div>}
								{!queriedThoughtId && roots[0] === null && (
									<p className="text-2xl text-center">No thoughts found</p>
								)}
								{!queriedThoughtId && roots.length > 1 && roots.slice(-1)[0] === null && (
									<p className="text-xl text-fg2 text-center">End of results </p>
								)}
							</div>
						)}
					</div>
				))
			) : (
				<div className="xy h-40">
					<p className="text-2xl">Invalid URL</p>
				</div>
			)}
		</div>
	);
}

function numberToLetter(num: number) {
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	let result = '';
	while (num >= 0) {
		result = letters[num % 26] + result;
		num = Math.floor(num / 26) - 1;
	}
	return result;
}
