import { A, useLocation, useNavigate, useParams } from '@solidjs/router';
import { matchSorter } from 'match-sorter';
import { Icon } from 'solid-heroicons';
import { chevronRight, plus } from 'solid-heroicons/solid-mini';
import { createEffect, createMemo, createSignal, onMount } from 'solid-js';
import InputAutoWidth from '~/components/InputAutoWidth';
import TagEditor from '~/components/TagEditor';
import { hostedLocally, makeUrl, ping, post } from '~/utils/api';
import { clone, copyToClipboardAsync } from '~/utils/js';
import { useKeyPress } from '~/utils/keyboard';
import { debounce } from '~/utils/performance';
import { fetchedSpacesSet, personas, useActiveSpace, useTagTree } from '~/utils/state';
import {
	RecursiveTag,
	TagTree,
	getParentsMap,
	getTagRelations,
	listAllTags,
	makeRootTag,
	scrubTagTree,
	sortKeysByNodeCount,
} from '~/utils/tags';

// TODO: the owner of communal spaces can edit this page
// Viewers of the space can send their current tag tree and the api returns
// a more up to date one if necessary. This sounds overly complicated
// Need to have an easier way
// How about the default tag tree can be overridden by the client and
// they can revert back to the default if they want
// Ya, the owner can switch workspaces for their personal and communal space tag trees and just copy over the tag tree from the test workspace to state.ts
// For keeping the client tag tree up to date, clients can send a hash of their tag tree to the server
// and the server will send back an up to date tag tree if the hash of its tag tree doesn't match

export default function Tags() {
	let lastTagParam = '';
	let addParentBtn: undefined | HTMLButtonElement;
	let searchIpt: undefined | HTMLInputElement;
	let parentTagIpt: undefined | HTMLInputElement;
	let rootTagIpt: undefined | HTMLInputElement;
	const tagSuggestionsRefs: (null | HTMLAnchorElement)[] = [];
	const parentTagSuggestionsRefs: (null | HTMLButtonElement)[] = [];

	const [tagFilter, tagFilterSet] = createSignal('');

	const decodedTag = createMemo(() => decodeURIComponent(useParams().tag || ''));
	const trimmedTagFilter = createMemo(() => tagFilter().trim());
	const tagRelations = createMemo(() => getTagRelations(useTagTree()));
	const allTags = createMemo(() => listAllTags(tagRelations()));
	const allTagsSet = createMemo(() => new Set(allTags()));

	const [parentTagFilter, parentTagFilterSet] = createSignal('');
	const [parentTagIndex, parentTagIndexSet] = createSignal<number>(0);
	const [tagIndex, tagIndexSet] = createSignal<null | number>(decodedTag() ? null : 0);
	const [subTaggingLineage, subTaggingLineageSet] = createSignal<string[]>([]);
	const [suggestParentTags, suggestParentTagsSet] = createSignal(false);
	const [addingParent, addingParentSet] = createSignal(false);

	const defaultTags = createMemo(() => sortKeysByNodeCount(useTagTree()).reverse());
	const tagToAdd = createMemo(() =>
		allTagsSet().has(trimmedTagFilter()) ? '' : trimmedTagFilter(),
	);
	const filteredTags = createMemo(() => {
		const filter = trimmedTagFilter().replace(/\s+/g, ' ');
		return !filter ? defaultTags() : matchSorter(allTags(), filter).slice(0, 99).concat(tagToAdd());
	});
	const parentsMap = createMemo(() => useTagTree() && getParentsMap(useTagTree()));
	const rootParents = createMemo(() => {
		const str = decodedTag();
		return (str && parentsMap()?.[str]) || null;
	});
	const rootTag = createMemo(() => {
		const str = decodedTag();
		return str ? makeRootTag(useTagTree(), str) : null;
	});
	const suggestedParentTags = createMemo(() => {
		const trimmedParentTagFilter = parentTagFilter().trim();
		const filter = trimmedParentTagFilter.replace(/\s+/g, ' ');
		if (!suggestParentTags()) return [];
		const addedTagsSet = new Set(rootParents());
		if (!filter)
			return defaultTags()
				.filter((tag) => !addedTagsSet.has(tag))
				.reverse();
		const arr = matchSorter(allTags(), filter).slice(0, 99).concat(trimmedParentTagFilter);
		return [...new Set(arr)].filter((tag) => !addedTagsSet.has(tag));
	});

	const navigate = useNavigate();
	const replaceTag = (tag?: string) => {
		navigate(!tag ? '/tags' : `/tags/${encodeURIComponent(tag)}`, { replace: true });
	};
	const debouncedReplaceTag = debounce((tag?: string) => replaceTag(tag), 100);

	createEffect(() => {
		if (!decodedTag() && filteredTags()[0]) {
			replaceTag(filteredTags()[0]);
		}
	});

	const refreshTagTree = async () => {
		if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
		tagIndexSet(null);
		const tagTree = await ping<TagTree>(makeUrl('get-tag-tree'));
		fetchedSpacesSet((old) => {
			old[''] = { host: '', tagTree };
			return clone(old);
		});
	};

	const addRootTag = (newTag: string, ctrlKey: boolean, altKey: boolean) => {
		if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
		altKey && tagFilterSet('');
		subTaggingLineageSet(ctrlKey ? [newTag] : []);
		ping(makeUrl('add-tag'), post({ tag: newTag }))
			.then(() => refreshTagTree())
			.catch((err) => alert(err));
	};

	const addParentTag = (e: KeyboardEvent | MouseEvent, parentTag: string) => {
		if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
		if (!rootTag()?.label || !parentTag) return;
		!e.altKey && addingParentSet(false);
		parentTagFilterSet('');
		parentTagIndexSet(0);
		tagIndexSet(null);
		return ping(makeUrl('add-tag'), post({ tag: rootTag()?.label, parentTag }))
			.then(() => refreshTagTree())
			.catch((err) => alert(err));
	};

	const addSubtag = (tag: string, parentTag: string, newSubTaggingLineage: string[]) => {
		if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
		subTaggingLineageSet(newSubTaggingLineage);
		!newSubTaggingLineage && searchIpt?.focus();
		return ping(makeUrl('add-tag'), post({ tag, parentTag }))
			.then(() => refreshTagTree())
			.catch((err) => alert(err));
	};

	const renameTag = async (oldTag: string, newTag: string, newSubTaggingLineage: string[]) => {
		if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
		replaceTag(newTag);
		subTaggingLineageSet(newSubTaggingLineage);
		return (
			ping(makeUrl('rename-tag'), post({ oldTag, newTag }))
				.then(() => refreshTagTree())
				// .then(() => searchIpt?.focus())
				.catch((err) => alert(err))
		);
	};

	const removeTag = (tag: string, parentTag?: string) => {
		if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
		return ping(makeUrl('remove-tag'), post({ tag, parentTag }))
			.then(() => refreshTagTree())
			.then(() => searchIpt?.focus())
			.catch((err) => alert(err));
	};

	const onArrowUpOrDown = (e: KeyboardEvent) => {
		if (
			(document.activeElement!.tagName === 'INPUT' && document.activeElement !== searchIpt) ||
			!filteredTags()
		)
			return;
		e.preventDefault();
		const index =
			tagIndex() === null
				? 0
				: Math.min(
						Math.max(tagIndex()! + (e.key === 'ArrowUp' ? -1 : 1), 0),
						filteredTags()!.length - 1,
					);
		tagSuggestionsRefs[index]?.focus();
		searchIpt?.focus();
		tagIndexSet(index);
		const nextTag = filteredTags()![index];
		if (e.repeat) {
			if (lastTagParam === nextTag) return;
			debouncedReplaceTag(nextTag);
			lastTagParam = nextTag;
		} else {
			replaceTag(filteredTags()![index]);
		}
	};

	useKeyPress({ key: 'ArrowDown', allowRepeats: true }, onArrowUpOrDown);
	useKeyPress({ key: 'ArrowUp', allowRepeats: true }, onArrowUpOrDown);

	return (
		<div class="flex">
			<div class="flex-1 relative min-w-80 max-w-[30rem]">
				<div class="sticky top-12 h-full pt-0.5 flex flex-col max-h-[calc(100vh-3rem)]">
					<input
						ref={(t) => {
							searchIpt = t;
							setTimeout(() => t.focus(), 0);
							// adding autofocus prop gives
							// Autofocus processing was blocked because a document already has a focused element.
							// idk y
						}}
						placeholder="Search tags"
						class="w-full px-3 h-8  border-b-2 text-xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
						value={tagFilter()}
						onInput={(e) => {
							tagIndex() !== 0 && tagIndexSet(0);
							tagFilterSet(e.target.value);
							debouncedReplaceTag(filteredTags()[tagIndex()!]);
						}}
						onKeyDown={(e) => {
							e.key === 'Escape' && searchIpt?.blur();
							if (e.key === 'Tab' && !e.shiftKey) {
								e.preventDefault();
								addParentBtn?.focus();
							}
							if (e.key === 'Enter') {
								if (!rootTag()) {
									addRootTag(tagToAdd(), e.ctrlKey, e.altKey);
								} else {
									e.preventDefault();
									rootTagIpt?.focus();
								}
							}
						}}
					/>
					<div class="flex-1 pb-1.5 overflow-scroll">
						{filteredTags().map((tag, i) => (
							<>
								{!tagFilter() && !i && !!tagRelations().loners.length && (
									<div
										class={`z-10 fx justify-between sticky top-0 bg-bg2 px-3 font-bold text-fg2`}
									>
										Lone tags
										<div class="h-2 w-2 rounded-full border bg-red-500 border-red-600" />
									</div>
								)}
								{!tagFilter() && tagRelations() && i === tagRelations().loners.length && (
									<div class="z-10 fx justify-between sticky top-0 bg-bg2 px-3 font-bold text-fg2">
										{/* Parent tags */}
										Root tags
										<div class="h-2 w-2 rounded-full border bg-green-500 border-green-600" />
									</div>
								)}
								{/* {!tagFilter() &&
									tagRelations() &&
									i === tagRelations().loners.length + tagRelations().parents.length && (
										<div
											class={`z-10 fx justify-between sticky top-0 bg-bg2 px-3 font-bold text-fg2`}
										>
											Child tags
											<div class="h-2 w-2 rounded-full border bg-blue-500 border-blue-600" />
										</div>
									)} */}
								<A
									href={`/tags/${encodeURIComponent(tag)}`}
									class={`group flex-1 pl-3 truncate fx text-xl border-t border-bg1 border-b ${
										tagIndex() === i ? 'bg-bg2' : 'bg-bg1'
									}`}
									ref={(r) => (tagSuggestionsRefs[i] = r)}
									onClick={(e) => {
										tagIndexSet(i);
										i === filteredTags()!.length - 1 &&
											tagToAdd() &&
											addRootTag(tagToAdd(), e.ctrlKey, e.altKey);
										searchIpt?.focus();
									}}
								>
									<div class="flex-1 text-left text-xl font-medium transition text-fg1 truncate">
										{tag}
									</div>
									{i === filteredTags()!.length - 1 && tagToAdd() ? (
										<Icon path={plus} class={`transition h-6 text-fg2 group-hover:text-fg1`} />
									) : (
										<Icon
											path={chevronRight}
											class={`h-6 ${
												tagIndex() === i
													? 'text-fg2 group-hover:text-fg1'
													: 'hidden group-hover:block text-fg2'
											}`}
										/>
									)}
								</A>
							</>
						))}
						<button
							class="border-t border-mg2 pl-3 text-xl w-full font-medium transition text-fg2 hover:text-fg1"
							onClick={() => {
								if (useTagTree()) {
									const publicTagTree = scrubTagTree(useTagTree());
									copyToClipboardAsync(JSON.stringify(publicTagTree, null, 2));
								}
							}}
						>
							Copy public tag tree
						</button>
					</div>
				</div>
			</div>
			<div
				class="p-3 pt-0 flex-[2] border-l-2 border-mg2 min-h-[calc(100vh-3rem)] overflow-scroll"
				// TODO: horizontal drag to resize
			>
				{!rootTag() ? (
					<div class="xy h-full">
						<p class="text-xl">
							{tagFilter() && tagToAdd()
								? `Add "${tagToAdd()}" with Enter`
								: tagFilter().length > 9 && '😳'}
							{allTags() && !allTags().length && 'No tags'}
							{tagIndex() === -1 && `"${decodedTag()}" is not a tag`}
						</p>
					</div>
				) : (
					<>
						<div class="mb-1 fx flex-wrap gap-2 pt-0.5">
							{!addingParent() ? (
								<button
									ref={addParentBtn}
									class="text-lg font-semibold rounded px-2 border-2 transition hover:text-fg1 text-fg2 border-fg2"
									onClick={() => addingParentSet(true)}
									onKeyDown={(e) => {
										if (e.key === 'Tab' && e.shiftKey) {
											e.preventDefault();
											searchIpt?.focus();
										}
									}}
								>
									<Icon path={plus} class="h-7 w-7" />
								</button>
							) : (
								<div class="">
									<InputAutoWidth
										// autofocus // this doesn't work?
										ref={(t) => {
											parentTagIpt = t;
											setTimeout(() => t.focus(), 0);
										}}
										placeholder="Parent tag"
										size={1}
										class="h-8 min-w-52 border-b-2 text-xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
										onFocus={() => suggestParentTagsSet(true)}
										onClick={() => suggestParentTagsSet(true)}
										value={parentTagFilter()}
										onInput={(e) => {
											parentTagSuggestionsRefs[0]?.focus();
											parentTagIpt?.focus();
											parentTagIndex() && parentTagIndexSet(0);
											parentTagFilterSet(e.target.value);
										}}
										onBlur={() => {
											setTimeout(() => {
												if (
													document.activeElement !== parentTagIpt &&
													!parentTagSuggestionsRefs.find((e) => e === document.activeElement)
												) {
													parentTagIndexSet(0);
													addingParentSet(false);
												}
											}, 0);
										}}
										onKeyDown={(e) => {
											if (e.key === 'Escape' || (e.key === 'Tab' && e.shiftKey)) {
												e.preventDefault();
												searchIpt?.focus();
											}
											const newParentTag =
												suggestedParentTags()[parentTagIndex()] || parentTagIpt?.value.trim();
											if (e.key === 'Enter' && newParentTag) {
												addParentTag(e, newParentTag);
											}
											if (e.key === 'ArrowUp') {
												e.preventDefault();
												const index = Math.max(parentTagIndex() - 1, -1);
												parentTagSuggestionsRefs[index]?.focus();
												parentTagIpt?.focus();
												parentTagIndexSet(index);
											}
											if (e.key === 'ArrowDown') {
												e.preventDefault();
												const index = Math.min(parentTagIndex() + 1, filteredTags()!.length - 1);
												parentTagSuggestionsRefs[index]?.focus();
												parentTagIpt?.focus();
												parentTagIndexSet(index);
											}
										}}
									/>
									{suggestParentTags() && (
										<div class="z-20 flex flex-col overflow-scroll rounded mt-9 bg-mg1 absolute max-h-56 shadow">
											{suggestedParentTags().map((tag, i) => {
												return (
													<button
														ref={(r) => (parentTagSuggestionsRefs[i] = r)}
														class={`fx min-w-52 px-2 text-nowrap text-xl hover:bg-mg2 ${
															parentTagIndex() === i ? 'bg-mg2' : 'bg-mg1'
														}`}
														onClick={(e) => addParentTag(e, tag)}
													>
														{tag}
													</button>
												);
											})}
										</div>
									)}
								</div>
							)}
							{rootParents() &&
								rootParents()!.map((tag) => (
									<A
										href={`/tags/${encodeURIComponent(tag)}`}
										class="whitespace-nowrap text-lg font-semibold rounded px-2 border-2 transition hover:text-fg1 text-fg2 border-fg2"
									>
										{tag}
									</A>
								))}
						</div>
						{rootTag() && (
							<TagEditor
								subTaggingLineage={subTaggingLineage}
								ref={(t) => (rootTagIpt = t)}
								// @ts-ignore
								recTag={rootTag}
								onSubtag={addSubtag}
								onRename={renameTag}
								onRemove={removeTag}
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
}
