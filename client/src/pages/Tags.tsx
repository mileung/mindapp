import { ChevronRightIcon, PlusIcon } from '@heroicons/react/16/solid';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLastUsedTags, useTagTree } from '../utils/state';
import { hostedLocally, makeUrl, ping, post } from '../utils/api';
import {
	TagTree,
	getAllSubTags,
	getNodes,
	getNodesArr,
	getParentsMap,
	makeRootTag,
	scrubTagTree,
} from '../utils/tags';
import TagEditor from '../components/TagEditor';
import { debounce } from '../utils/performance';
import { useKeyPress } from '../utils/keyboard';
import { matchSorter } from 'match-sorter';
import InputAutoWidth from '../components/InputAutoWidth';
import { copyToClipboardAsync } from '../utils/js';

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
	const navigate = useNavigate();
	const { tag } = useParams();
	const [tagTree, tagTreeSet] = useTagTree();
	// tagTree = { parents: {}, loners: [] };
	const [lastUsedTags, lastUsedTagsSet] = useLastUsedTags();
	const [parentTagFilter, parentTagFilterSet] = useState('');
	const [tagFilter, tagFilterSet] = useState('');
	const [parentTagIndex, parentTagIndexSet] = useState<number>(0);
	const [tagIndex, tagIndexSet] = useState<null | number>(tag ? null : 0);
	const addParentBtn = useRef<HTMLButtonElement>(null);
	const searchIpt = useRef<null | HTMLInputElement>(null);
	const parentTagIpt = useRef<null | HTMLInputElement>(null);
	const rootTagIpt = useRef<null | HTMLInputElement>(null);
	const tagSuggestionsRefs = useRef<(null | HTMLAnchorElement)[]>([]);
	const parentTagSuggestionsRefs = useRef<(null | HTMLButtonElement)[]>([]);
	const [subTaggingLineage, subTaggingLineageSet] = useState<string[]>([]);
	const [suggestParentTags, suggestParentTagsSet] = useState(false);
	const [addingParent, addingParentSet] = useState(false);
	const lastTagParam = useRef('');
	const parentsMap = useMemo(() => tagTree && getParentsMap(tagTree), [JSON.stringify(tagTree)]);
	const nodes = useMemo(() => tagTree && getNodes(tagTree), [tagTree]);
	const nodesArr = useMemo(() => nodes && getNodesArr(nodes), [nodes]);
	const nodesSet = useMemo(() => new Set(nodesArr), [nodesArr]);
	const trimmedTagFilter = useMemo(() => tagFilter.trim(), [tagFilter]);
	const tagToAdd = useMemo(
		() => (nodesSet.has(trimmedTagFilter) ? '' : trimmedTagFilter),
		[nodesSet, trimmedTagFilter],
	);
	const suggestedTags = useMemo(
		() =>
			nodesArr &&
			(trimmedTagFilter
				? matchSorter(nodesArr, trimmedTagFilter).concat(tagToAdd || [])
				: nodesArr),
		[nodesArr, trimmedTagFilter, tagToAdd],
	);
	const rootTag = useMemo(() => {
		return tagTree && suggestedTags && tagIndex !== null
			? makeRootTag(tagTree, suggestedTags[tagIndex])
			: null;
	}, [tagTree, suggestedTags, tagIndex]);
	const rootParents = useMemo(
		() => (rootTag && parentsMap?.[rootTag.label]) || null,
		[parentsMap, rootTag],
	);

	const trimmedParentFilter = useMemo(() => parentTagFilter.trim(), [parentTagFilter]);
	const suggestedParentTags = useMemo(() => {
		if (!nodesArr || !suggestParentTags) return [];
		let arr = matchSorter(nodesArr, trimmedParentFilter);
		trimmedParentFilter ? arr.push(trimmedParentFilter) : arr.unshift(...lastUsedTags);
		arr = [...new Set(arr)].filter((tag) => !(rootParents || []).includes(tag));
		return arr;
	}, [nodesArr, suggestParentTags, trimmedParentFilter, lastUsedTags, rootParents]);

	const replaceTag = useCallback((tag?: string) => {
		navigate(!tag ? '/tags' : `/tags/${encodeURIComponent(tag)}`, { replace: true });
	}, []);
	const debouncedReplaceTag = useCallback(
		debounce((tag?: string) => replaceTag(tag), 100),
		[],
	);

	const refreshTagTree = useCallback(
		(rootTagLabel: string, ignoreTagFilter = false) => {
			if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
			ping<TagTree>(makeUrl('get-tag-tree'))
				.then((data) => {
					tagTreeSet(data);
					const newNodesArr = getNodesArr(getNodes(data));
					const newSuggestedTags =
						ignoreTagFilter || !tagFilter ? newNodesArr : matchSorter(newNodesArr, tagFilter);
					const i = newSuggestedTags.indexOf(rootTagLabel);
					tagIndexSet(i === -1 ? 0 : i);
				})
				.catch((err) => alert(err));
		},
		[tagFilter, tagToAdd],
	);

	const addRootTag = useCallback(
		(newTag: string, ctrlKey: boolean, altKey: boolean) => {
			if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
			altKey && tagFilterSet('');
			subTaggingLineageSet(ctrlKey ? [newTag] : []);
			ping(makeUrl('add-tag'), post({ tag: newTag }))
				.then(() => refreshTagTree(newTag, altKey))
				.catch((err) => alert(err));
		},
		[refreshTagTree],
	);

	const addParentTag = useCallback(
		(
			e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent<HTMLInputElement>,
			parentTag: string,
		) => {
			if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
			if (!rootTag?.label || !parentTag) return;
			!e.altKey && addingParentSet(false);
			parentTagFilterSet('');
			parentTagIndexSet(0);
			return ping(makeUrl('add-tag'), post({ tag: rootTag.label, parentTag }))
				.then(() => refreshTagTree(rootTag!.label))
				.catch((err) => alert(err));
		},
		[rootTag?.label, refreshTagTree],
	);

	const addSubtag = useCallback(
		(tag: string, parentTag: string, newSubTaggingLineage: string[]) => {
			if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
			subTaggingLineageSet(newSubTaggingLineage);
			!newSubTaggingLineage && searchIpt.current?.focus();
			return ping(makeUrl('add-tag'), post({ tag, parentTag }))
				.then(() => refreshTagTree(rootTag!.label))
				.catch((err) => alert(err));
		},
		[rootTag?.label, refreshTagTree],
	);

	const renameTag = useCallback(
		async (oldTag: string, newTag: string, newSubTaggingLineage: string[]) => {
			if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
			subTaggingLineageSet(newSubTaggingLineage);
			return (
				ping(makeUrl('rename-tag'), post({ oldTag, newTag }))
					.then(() => refreshTagTree(rootTag!.label === oldTag ? newTag : rootTag!.label))
					// .then(() => searchIpt.current?.focus())
					.catch((err) => alert(err))
			);
		},
		[rootTag?.label, refreshTagTree],
	);

	const removeTag = useCallback(
		(tag: string, parentTag?: string) => {
			if (!hostedLocally) return alert('Run Mindapp locally to edit tags');
			return ping(makeUrl('remove-tag'), post({ tag, parentTag }))
				.then(() => refreshTagTree(rootTag!.label))
				.then(() => searchIpt.current?.focus())
				.catch((err) => alert(err));
		},
		[rootTag?.label, refreshTagTree],
	);

	const showTagInLeftPanel = useCallback(
		(tag: string, e?: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
			// console.log('tag:', tag);
			if (e?.metaKey || e?.shiftKey || !suggestedTags || !nodesArr) return;
			let i = suggestedTags.indexOf(tag);
			if (i === -1) {
				tagFilterSet('');
				i = nodesArr.indexOf(tag);
			}
			setTimeout(() => {
				tagSuggestionsRefs.current[i]?.focus();
				searchIpt.current?.focus();
			}, 0);
			tagIndexSet(i);
		},
		[nodesArr, suggestedTags],
	);

	const onArrowUpOrDown = useCallback(
		(e: KeyboardEvent) => {
			if (
				(document.activeElement!.tagName === 'INPUT' &&
					document.activeElement !== searchIpt.current) ||
				!suggestedTags
			)
				return;
			e.preventDefault();
			const index =
				tagIndex === null
					? 0
					: Math.min(
							Math.max(tagIndex + (e.key === 'ArrowUp' ? -1 : 1), 0),
							suggestedTags.length - 1,
						);
			tagSuggestionsRefs.current[index]?.focus();
			searchIpt.current?.focus();
			tagIndexSet(index);
			const nextTag = suggestedTags[index];
			if (e.repeat) {
				if (lastTagParam.current === nextTag) return;
				debouncedReplaceTag(nextTag);
				lastTagParam.current = nextTag;
			} else {
				replaceTag(suggestedTags[index]);
			}
		},
		[tagIndex, suggestedTags],
	);
	useKeyPress({ key: 'ArrowDown', allowRepeats: true }, onArrowUpOrDown, [onArrowUpOrDown]);
	useKeyPress({ key: 'ArrowUp', allowRepeats: true }, onArrowUpOrDown, [onArrowUpOrDown]);

	useEffect(() => {
		const newTag = rootTag?.label || (tagIndex && suggestedTags?.[tagIndex]);
		newTag && debouncedReplaceTag(newTag);
	}, [rootTag?.label, tagIndex, suggestedTags]);

	useEffect(() => {
		if (tagIndex === null && suggestedTags && tag) {
			tagIndexSet(suggestedTags.indexOf(tag));
		}
	}, [tagIndex, suggestedTags, tag]);

	return (
		<div className="flex">
			<div className="flex-1 relative min-w-80 max-w-[30rem]">
				<div className="sticky top-12 h-full pt-0.5 flex flex-col max-h-[calc(100vh-3rem)]">
					<input
						ref={searchIpt}
						autoFocus
						placeholder="Search tags"
						className="w-full px-3 h-8  border-b-2 text-xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
						value={tagFilter}
						onChange={(e) => {
							tagIndex !== 0 && tagIndexSet(0);
							tagFilterSet(e.target.value);
						}}
						onKeyDown={(e) => {
							e.key === 'Escape' && searchIpt.current?.blur();
							if (e.key === 'Tab' && !e.shiftKey) {
								e.preventDefault();
								addParentBtn.current!.focus();
							}
							if (e.key === 'Enter' && suggestedTags && tagIndex !== null) {
								if (suggestedTags[tagIndex] === tagToAdd) {
									addRootTag(tagToAdd, e.ctrlKey, e.altKey);
								} else {
									e.preventDefault();
									rootTagIpt.current?.focus();
								}
							}
						}}
					/>
					<div className="flex-1 pb-1.5 overflow-scroll">
						{suggestedTags &&
							suggestedTags.map((tag, i) => (
								<React.Fragment key={tag}>
									{!tagFilter && !i && !!nodes?.loners.length && (
										<div
											className={`z-10 fx justify-between sticky top-0 bg-bg2 px-3 font-bold text-fg2`}
										>
											Lone tags
											<div className="h-2 w-2 rounded-full border bg-red-500 border-red-600" />
										</div>
									)}
									{!tagFilter && nodes && i === nodes.loners.length && (
										<div className="z-10 fx justify-between sticky top-0 bg-bg2 px-3 font-bold text-fg2">
											Parent tags
											<div className="h-2 w-2 rounded-full border bg-green-500 border-green-600" />
										</div>
									)}
									{!tagFilter && nodes && i === nodes.loners.length + nodes.parents.length && (
										<div
											className={`z-10 fx justify-between sticky top-0 bg-bg2 px-3 font-bold text-fg2`}
										>
											Child tags
											<div className="h-2 w-2 rounded-full border bg-blue-500 border-blue-600" />
										</div>
									)}
									<Link
										to={`/tags/${encodeURIComponent(tag)}`}
										className={`group flex-1 pl-3 truncate fx text-xl border-t border-bg1 border-b ${tagIndex === i ? 'bg-bg2' : 'bg-bg1'}`}
										ref={(r) => (tagSuggestionsRefs.current[i] = r)}
										onClick={(e) => {
											tagIndexSet(i);
											i === suggestedTags.length - 1 &&
												tagToAdd &&
												addRootTag(tagToAdd, e.ctrlKey, e.altKey);
											tagIndex === i ? rootTagIpt.current?.focus() : searchIpt.current?.focus();
										}}
									>
										<div className="flex-1 text-left text-xl font-medium transition text-fg1 truncate">
											{tag}
										</div>
										{i === suggestedTags.length - 1 && tagToAdd ? (
											<PlusIcon className={`transition h-6 text-fg2 group-hover:text-fg1`} />
										) : (
											<ChevronRightIcon
												className={`h-6 ${tagIndex === i ? 'text-fg2 group-hover:text-fg1' : 'hidden group-hover:block text-fg2'}`}
											/>
										)}
									</Link>
								</React.Fragment>
							))}
						<button
							className="border-t border-mg2 pl-3 text-xl w-full font-medium transition text-fg2 hover:text-fg1"
							onClick={() => {
								if (tagTree) {
									const publicTagTree = scrubTagTree(tagTree);
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
				className="p-3 pt-0 flex-[2] border-l-2 border-mg2 min-h-[calc(100vh-3rem)] overflow-scroll"
				// TODO: horizontal drag to resize
			>
				{!rootTag ? (
					<div className="xy h-full">
						<p className="text-xl">
							{tagFilter && tagToAdd
								? `Add "${tagToAdd}" with Enter`
								: !!nodesArr?.length && tagFilter.length > 9 && '😳'}
							{nodesArr && !nodesArr.length && 'No tags'}
							{tagIndex === -1 && `"${tag}" is not a tag`}
						</p>
					</div>
				) : (
					<>
						<div className="mb-1 fx flex-wrap gap-2 pt-0.5">
							{!addingParent ? (
								<button
									ref={addParentBtn}
									className="text-lg font-semibold rounded px-2 border-2 transition hover:text-fg1 text-fg2 border-fg2"
									onClick={() => addingParentSet(true)}
									onKeyDown={(e) => {
										if (e.key === 'Tab' && e.shiftKey) {
											e.preventDefault();
											searchIpt.current?.focus();
										}
									}}
								>
									<PlusIcon className="h-7 w-7" />
								</button>
							) : (
								<div className="">
									<InputAutoWidth
										autoFocus
										ref={parentTagIpt}
										placeholder="Parent tag"
										size={1}
										className="h-8 min-w-52 border-b-2 text-xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
										onFocus={() => suggestParentTagsSet(true)}
										onClick={() => suggestParentTagsSet(true)}
										value={parentTagFilter}
										onChange={(e) => {
											// TODO: why is adding a parent tag ui so slow when typing
											parentTagSuggestionsRefs.current[0]?.focus();
											parentTagIpt.current?.focus();
											parentTagIndex && parentTagIndexSet(0);
											parentTagFilterSet(e.target.value);
										}}
										onBlur={() => {
											setTimeout(() => {
												if (
													document.activeElement !== parentTagIpt.current &&
													!parentTagSuggestionsRefs.current.find(
														(e) => e === document.activeElement,
													)
												) {
													parentTagIndexSet(0);
													addingParentSet(false);
												}
											}, 0);
										}}
										onKeyDown={(e) => {
											if (e.key === 'Escape' || (e.key === 'Tab' && e.shiftKey)) {
												e.preventDefault();
												searchIpt.current?.focus();
											}
											const newParentTag =
												suggestedParentTags[parentTagIndex] || parentTagIpt.current?.value.trim();
											if (e.key === 'Enter' && newParentTag) {
												addParentTag(e, newParentTag);
											}
											if (e.key === 'ArrowUp') {
												e.preventDefault();
												const index = Math.max(parentTagIndex - 1, -1);
												parentTagSuggestionsRefs.current[index]?.focus();
												parentTagIpt.current?.focus();
												parentTagIndexSet(index);
											}
											if (e.key === 'ArrowDown') {
												e.preventDefault();
												const index = Math.min(parentTagIndex + 1, suggestedTags!.length - 1);
												parentTagSuggestionsRefs.current[index]?.focus();
												parentTagIpt.current?.focus();
												parentTagIndexSet(index);
											}
										}}
									/>
									{suggestParentTags && (
										<div className="z-20 flex flex-col overflow-scroll rounded mt-9 bg-mg1 absolute max-h-56 shadow">
											{suggestedParentTags.map((tag, i) => {
												return (
													<button
														key={i}
														ref={(r) => (parentTagSuggestionsRefs.current[i] = r)}
														className={`fx min-w-52 px-2 text-nowrap text-xl hover:bg-mg2 ${parentTagIndex === i ? 'bg-mg2' : 'bg-mg1'}`}
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
							{rootParents &&
								rootParents.map((tag) => (
									<Link
										key={tag}
										to={`/tags/${encodeURIComponent(tag)}`}
										className="whitespace-nowrap text-lg font-semibold rounded px-2 border-2 transition hover:text-fg1 text-fg2 border-fg2"
										onClick={(e) => showTagInLeftPanel(tag, e)}
									>
										{tag}
									</Link>
								))}
						</div>
						<TagEditor
							subTaggingLineage={subTaggingLineage}
							_ref={rootTagIpt}
							recTag={rootTag}
							onSubtag={addSubtag}
							onRename={renameTag}
							onRemove={removeTag}
							onLinkClick={showTagInLeftPanel}
						/>
					</>
				)}
			</div>
		</div>
	);
}
