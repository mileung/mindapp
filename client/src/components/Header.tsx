import { useLocation, useNavigate, useSearchParams } from '@solidjs/router';
import { matchSorter } from 'match-sorter';
import { Icon } from 'solid-heroicons';
import {
	bars_3,
	check,
	cog,
	ellipsisHorizontal,
	lockClosed,
	magnifyingGlass,
	square_2Stack,
	tag,
	userGroup,
} from 'solid-heroicons/solid-mini';
import { createEffect, createMemo, createSignal } from 'solid-js';
import { Persona, useAnon } from '../types/PersonasPolyfill';
import { hostedLocally, localApiHost, makeUrl, ping } from '../utils/api';
import { clone, shortenString } from '../utils/js';
import { useKeyPress } from '../utils/keyboard';
import { Space } from '../utils/settings';
import {
	useActiveSpace,
	fetchedSpaces,
	personas,
	personasSet,
	rootSettings,
	drawerOpen,
	drawerOpenSet,
	useTagTree,
	passwords,
	passwordsSet,
} from '../utils/state';
import {
	bracketRegex,
	getTagRelations,
	getTags,
	listAllTags,
	sortKeysByNodeCount,
} from '../utils/tags';
import DeterministicVisualId from './DeterministicVisualId';

const setGlobalCssVariable = (variableName: string, value: string) => {
	document.documentElement.style.setProperty(`--${variableName}`, value);
};

let lastScroll = 0;
let initialScrollUpPosition = 0;
let scrollingDown = true;
// window.addEventListener('scroll', () => {
// 	const currentScroll = window.scrollY;
// 	if (currentScroll > lastScroll) {
// 		setGlobalCssVariable('header-opacity', '0.25');
// 		// setGlobalCssVariable('header-opacity', '0.0000000001');
// 		scrollingDown = true;
// 	} else {
// 		if (currentScroll <= 10 || initialScrollUpPosition - currentScroll > 88) {
// 			setGlobalCssVariable('header-opacity', '1');
// 		}
// 		if (scrollingDown) {
// 			initialScrollUpPosition = currentScroll;
// 		}
// 		scrollingDown = false;
// 	}
// 	lastScroll = currentScroll <= 0 ? 0 : currentScroll;
// });

export default function Header() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	let searchIpt: undefined | HTMLInputElement;
	let searchBtn: undefined | HTMLButtonElement;
	let spaceBtn: undefined | HTMLButtonElement;
	let personaBtn: undefined | HTMLButtonElement;
	const tagSuggestionsRefs: (null | HTMLButtonElement)[] = [];
	const [suggestTags, suggestTagsSet] = createSignal(false);
	const [switchingSpaces, switchingSpacesSet] = createSignal(false);
	const [switchingPersonas, switchingPersonasSet] = createSignal(false);
	const [searchedText, searchedTextSet] = createSignal(searchParams.q?.toString() || '');
	const [tagIndex, tagIndexSet] = createSignal<number>(0);
	const addedTags = createMemo(() => getTags(searchedText()));
	const tagFilter = createMemo(() =>
		searchedText().trim().replace(bracketRegex, '').replace(/\s\s+/g, ' ').trim(),
	);

	const allTags = createMemo(() =>
		!suggestTags() ? [] : listAllTags(getTagRelations(useTagTree())),
	);
	const defaultTags = createMemo(() =>
		!suggestTags() ? [] : sortKeysByNodeCount(useTagTree()).reverse(),
	);
	const suggestedTags = createMemo(() => {
		if (!suggestTags()) return [];
		const addedTagsSet = new Set(addedTags());
		const trimmedFilter = tagFilter().trim();
		if (!trimmedFilter) return defaultTags().filter((tag) => !addedTagsSet.has(tag));
		const filter = trimmedFilter.replace(/\s+/g, ' ');
		let arr = matchSorter(allTags(), filter).slice(0, 99).concat(trimmedFilter);
		return [...new Set(arr)].filter((tag) => !addedTagsSet.has(tag));
	});

	createEffect(() => {
		searchedTextSet(searchParams.q?.toString() || '');
	});

	useKeyPress('/', () => {
		const activeElement = document.activeElement!;
		if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
			setTimeout(() => searchIpt?.focus(), 0); // setTimeout prevents inputting '/' on focus
		}
	});

	const searchInput = (newTab = false) => {
		const q = encodeURIComponent(searchedText().trim())
			.replace(/%40/g, '@')
			.replace(/%5B/g, '[')
			.replace(/%5D/g, ']');

		if (q) {
			searchIpt?.blur();
			setTimeout(() => {
				if (newTab) {
					window.open(`/?q=${q}`, '_blank');
				} else {
					navigate(`/?q=${q}`);
				}
			}, 0);
			// setTimeout prevents search from adding new line to contentTextarea on enter
		}
	};

	const addTagToSearchInput = (tag: string) => {
		tagIndexSet(-1);
		searchedTextSet(
			`${searchedText()
				.replace(/\s\s+/g, ' ')
				.trim()
				.replace(new RegExp(tagFilter() + '$'), '')
				.trim()}[${tag}] `.trimStart(),
		);
		setTimeout(() => searchIpt!.scrollTo({ left: Number.MAX_SAFE_INTEGER }), 0);
	};

	const onSwitchingBlur = () => {
		setTimeout(() => {
			if (document.activeElement !== spaceBtn && document.activeElement !== personaBtn) {
				switchingPersonasSet(false);
				switchingSpacesSet(false);
			}
		}, 0);
	};

	return (
		<>
			<div class="h-12" />
			{personas && (
				<header
					class="z-50 fixed top-0 w-full px-2 sm:px-3 fx justify-between h-12 transition-opacity bg-bg1"
					// Not sure how I feel about this especially now
					// that the tag map is there
					// style={{ opacity: 'var(--header-opacity)' }}
					onMouseMove={() => setGlobalCssVariable('header-opacity', '1')}
				>
					<button
						class={`${
							// I feel like this is bad ux?
							useLocation().pathname === '/' ? 'md:hidden' : 'sm:hidden'
						} xy -ml-2 mr-2 h-full w-10 text-fg2 transition hover:text-fg1`}
						onClick={() => drawerOpenSet(!drawerOpen())}
					>
						<Icon path={bars_3} class="h-7 w-7" />
					</button>
					<a href="/" class="fx shrink-0">
						<img
							src={'/mindapp-logo.svg'}
							alt="logo"
							class={`h-6 ${hostedLocally && rootSettings.testWorkingDirectory && 'grayscale'}`}
						/>
						<p class="ml-2 text-xl font-black hidden sm:block">Mindapp</p>
					</a>
					<div class="ml-3 md:ml-5 h-full flex-1 max-w-3xl relative">
						<div class="flex h-full">
							<input
								ref={searchIpt}
								value={searchedText()}
								class="w-full pr-12 text-lg px-2 rounded border-2 transition border-mg1 hover:border-mg2 focus:border-mg2 my-1"
								placeholder="Search"
								onFocus={() => {
									suggestTagsSet(true);
									tagIndexSet(-1);
								}}
								onBlur={() => {
									document.activeElement !== searchBtn && suggestTagsSet(false);
								}}
								onInput={(e) => {
									suggestTagsSet(true);
									tagIndexSet(addedTags().length ? -1 : 0);
									searchedTextSet(e.target.value);
								}}
								onKeyDown={(e) => {
									if (e.key === 'Escape') {
										suggestTagsSet(false);
										searchIpt?.blur();
									}
									if (e.key === 'Enter') {
										if (suggestedTags()[tagIndex()]) {
											addTagToSearchInput(suggestedTags()[tagIndex()]);
										} else {
											searchInput(e.metaKey);
										}
									}
									if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
										e.preventDefault();
										const index = Math.min(
											Math.max(tagIndex() + (e.key === 'ArrowUp' ? -1 : 1), -1),
											suggestedTags().length - 1,
										);
										tagSuggestionsRefs[index]?.focus();
										searchIpt?.focus();
										tagIndexSet(index);
									}
								}}
							/>
							<button
								ref={searchBtn}
								class="xy -ml-12 w-12 px-2 rounded transition text-fg2 hover:text-fg1"
								onClick={(e) => searchInput(e.metaKey)}
							>
								<Icon path={magnifyingGlass} class="h-7 w-7" />
							</button>
						</div>
						{suggestTags() && (
							<div class="z-20 flex flex-col overflow-scroll rounded absolute w-full max-h-56 shadow">
								{suggestedTags().map((tag, i) => {
									return (
										<button
											class={`fx px-3 text-xl hover:bg-mg2 ${
												tagIndex() === i ? 'bg-mg2' : 'bg-mg1'
											}`}
											ref={(r) => (tagSuggestionsRefs[i] = r)}
											onMouseDown={(e) => e.preventDefault()}
											onClick={() => addTagToSearchInput(tag)}
										>
											<p class="truncate">{tag}</p>
										</button>
									);
								})}
							</div>
						)}
					</div>
					<div class="fx">
						{hostedLocally && (
							<a href="/tags" class="xy w-10 text-fg2 transition hover:text-fg1">
								<Icon path={tag} class="h-7 w-7" />
							</a>
						)}
						<a href="/settings" class="xy w-10 text-fg2 transition hover:text-fg1">
							<Icon path={cog} class="h-7 w-7" />
						</a>
						<div class="mr-2 border-l-2 border-mg2 h-8"></div>
						<button
							ref={spaceBtn}
							class="h-8 w-8 xy"
							onBlur={onSwitchingBlur}
							onClick={() => {
								switchingPersonasSet(false);
								switchingSpacesSet(!switchingSpaces());
							}}
							onKeyDown={(e) => {
								if (e.key === 'Escape') {
									switchingPersonasSet(false);
									switchingSpacesSet(false);
								}
							}}
						>
							<DeterministicVisualId
								input={useActiveSpace()}
								// input={useActiveSpace().owner ? useActiveSpace() : useActiveSpace().host}
								class="rounded overflow-hidden h-7 w-7"
							/>
						</button>
						<button
							ref={personaBtn}
							class="ml-2 h-8 w-8 xy"
							onBlur={onSwitchingBlur}
							onClick={() => {
								switchingSpacesSet(false);
								switchingPersonasSet(!switchingPersonas());
							}}
							onKeyDown={(e) => {
								if (e.key === 'Escape') {
									switchingPersonasSet(false);
									switchingSpacesSet(false);
								}
							}}
						>
							<DeterministicVisualId
								input={personas[0].id}
								class="rounded-full overflow-hidden h-7 w-7"
							/>
						</button>
					</div>
					{(switchingSpaces() || switchingPersonas()) && (
						<>
							{/*
							fragment is needed to avoid crashing
							idk y. Without it, refresh the home page, press n, press tab, press f, press enter, switch from anon to a persona and it crashes, unless there's this fragment...
							*/}
							<div
								class={`absolute shadow rounded h-fit overflow-hidden top-12 bg-mg1 ${
									switchingSpaces() ? 'right-12' : 'right-2'
								} mr-0 sm:mr-1`}
							>
								<div class="max-h-48 overflow-scroll">
									{(
										(switchingSpaces()
											? personas[0].spaceHosts.map((host) => fetchedSpaces[host] || { host })
											: personas) as (Space & Persona)[]
									).map((thing, i) => {
										const thingKey = switchingSpaces() ? thing.host : thing.id;
										const showCheck = !i;
										return (
											<div class="flex transition hover:bg-mg2">
												<button
													onMouseDown={(e) => e.preventDefault()}
													class="w-44 pl-2 h-11 fx"
													onClick={() => {
														if (
															switchingPersonas() &&
															thing.id &&
															passwords[thing.id] === undefined
														) {
															switchingPersonasSet(false);
															return navigate(`/unlock/${thingKey}`);
														}
														personasSet((old) => {
															if (switchingSpaces()) {
																old[0].spaceHosts.splice(
																	0,
																	0,
																	old[0].spaceHosts.splice(
																		old[0].spaceHosts.findIndex((h) => h === thingKey),
																		1,
																	)[0],
																);
															} else {
																old.splice(
																	0,
																	0,
																	old.splice(
																		old.findIndex((p) => p.id === thingKey),
																		1,
																	)[0],
																);
															}
															switchingSpacesSet(false);
															switchingPersonasSet(false);
															return clone(old);
														});
													}}
												>
													<DeterministicVisualId
														input={switchingSpaces() ? thing : thingKey}
														class={`h-6 w-6 overflow-hidden ${
															switchingSpaces() ? 'rounded' : 'rounded-full'
														}`}
													/>
													<div class="flex-1 ml-1.5 truncate">
														<p
															class={`max-w-full text-left text-lg font-semibold leading-5  ${
																!thing?.name && 'text-fg2'
															} truncate`}
														>
															{switchingSpaces()
																? !thing.host
																	? 'Local space'
																	: fetchedSpaces[thing.host]?.fetchedSelf
																	? fetchedSpaces[thing.host]!.name || 'No name'
																	: '...'
																: thing.name || (thingKey ? 'No name' : 'Anon')}
														</p>
														<p class="text-left font-mono text-fg2 leading-5 truncate">
															{switchingSpaces()
																? thingKey || localApiHost
																: shortenString(thingKey!)}
														</p>
													</div>
												</button>
												{!thingKey ? (
													<div class="w-8 xy">
														{showCheck && <Icon path={check} class="h-5 w-5" />}
													</div>
												) : (
													<a
														class="xy w-8 group relative"
														aria-disabled={!thingKey}
														href={`/${switchingSpaces() ? 'spaces' : 'personas'}/${thingKey}`}
														onMouseDown={(e) => e.preventDefault()}
														onClick={() => {
															switchingSpacesSet(false);
															switchingPersonasSet(false);
														}}
													>
														{showCheck ? (
															<Icon path={check} class="h-5 w-5" />
														) : (
															switchingPersonas() &&
															passwords[thing.id] === undefined && (
																<Icon path={lockClosed} class="h-4 w-4 text-fg2" />
															)
														)}
														<div class="bg-mg2 opacity-0 transition hover:opacity-100 absolute xy inset-0">
															<Icon path={ellipsisHorizontal} class="h-5 w-5" />
														</div>
													</a>
												)}
											</div>
										);
									})}
								</div>
								<a
									href={switchingSpaces() ? '/spaces' : '/personas'}
									class="border-t border-mg2 h-10 fx transition hover:bg-mg2 px-2 py-1"
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => {
										switchingSpacesSet(false);
										switchingPersonasSet(false);
									}}
								>
									<div class="h-6 w-6 xy">
										{switchingSpaces() ? (
											<Icon path={square_2Stack} class="h-6 w-6" />
										) : (
											<Icon path={userGroup} class="h-6 w-6" />
										)}
									</div>
									<p class="ml-1.5 text-lg font-medium">
										{/* TODO: Button should say add space or create persona? */}
										Manage {switchingSpaces() ? 'spaces' : 'personas'}
									</p>
								</a>
								{!switchingSpaces() && (
									<button
										class="w-full border-t border-mg2 h-10 fx transition hover:bg-mg2 px-2 py-1"
										onMouseDown={(e) => e.preventDefault()}
										onClick={() => {
											useAnon();
											personas.forEach((persona) => {
												passwordsSet((old) => ({ ...old, [persona.id]: undefined }));
											});

											switchingSpacesSet(false);
											switchingPersonasSet(false);
											navigate('/');
										}}
									>
										<div class="h-6 w-6 xy">
											<Icon path={lockClosed} class="h-6 w-6" />
										</div>
										<p class="ml-1.5 text-lg font-medium">Lock all personas</p>
									</button>
								)}
							</div>
						</>
					)}
				</header>
			)}
		</>
	);
}
