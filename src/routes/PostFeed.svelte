<script lang="ts">
	import { page } from '$app/state';
	import { gotoIfNeeded, scrollToHighlight, textInputFocused } from '$lib/dom';
	import {
		assertCallerIsOwnerOrInGlobal,
		getBottomOverlayShown,
		getCallerIsOwner,
		getPromptEnableLocalSpace,
		getPromptSigningIn,
		getSpaceContext,
		getSpacePermissions,
		gs,
		mergeMsToAccountNameTxtMap,
		mergeMsToSpaceNameTxtMap,
		mergeSpaceMsToAccountMsToMembershipMap,
		resetBottomOverlay,
	} from '$lib/global-state.svelte';
	import { alertError, getAlteredSearchParams, makeErrorReadable } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { updateLocalCache, updateSavedTags } from '$lib/types/local-cache';
	import { hasParent } from '$lib/types/parts';
	import {
		getAtIdStr,
		getIdObj,
		getIdStr,
		getIdStrAsIdObj,
		getUrlInMs,
		type IdObj,
	} from '$lib/types/parts/partIds';
	import { cleanTags, getCitedPostIds, getLastVersion, type Post } from '$lib/types/posts';
	import { addPost } from '$lib/types/posts/addPost';
	import { editPost } from '$lib/types/posts/editPost';
	import {
		getDefaultSection,
		getPostFeed,
		type PostFeedSection,
	} from '$lib/types/posts/getPostFeed';
	import {
		getParsedQPaginates,
		maxTopLvlPostLimitPerSection,
		parseSearchQuery,
		type ParsedQ,
	} from '$lib/types/posts/parseSearchQuery';
	import { accentCodes } from '$lib/types/spaces';
	import {
		IconArchive,
		IconChevronRight,
		IconClockUp,
		IconList,
		IconListTree,
		IconPencilPlus,
		IconSquareFilled,
		IconX,
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import PostBlock from './PostBlock.svelte';
	import PostWriter from './PostWriter.svelte';
	import PromptEnableLocalSpace from './PromptEnableLocalSpace.svelte';
	import PromptSignIn from './PromptSignIn.svelte';
	import ReactionHistory from './ReactionHistory.svelte';
	import SearchBar from './SearchBar.svelte';
	import TimeRangePicker from './TimeRangePicker.svelte';

	let qSearchParam = $derived(page.url.searchParams.get('q') ?? '');
	let { idSlug } = $derived(page.params);
	let flatView = $derived(idSlug ? false : page.url.searchParams.get('nested') === null);
	let newFirst = $derived(page.url.searchParams.get('old') === null);
	let parseIntParam = (paramKey: string) => {
		let v = page.url.searchParams.get(paramKey);
		return v !== null && Number.isInteger(+v)
			? +v //
			: undefined;
	};
	// TODO: rename to msFrom and msTo? Would have to fix the offset by 1 ms
	let msGte = $derived(parseIntParam('msGte'));
	let msLte = $derived(parseIntParam('msLte'));
	let urlInMs = $derived(getUrlInMs());
	let { canPost } = $derived(getSpacePermissions(urlInMs));
	let space = $derived(urlInMs === undefined ? undefined : gs.msToSpaceMap[urlInMs]);
	let spaceContext = $derived(getSpaceContext(urlInMs));
	let isMergedView = $derived(page.url.pathname === '/merged-view');
	let callerIsOwner = $derived(getCallerIsOwner());
	let isOwnerView = $derived(callerIsOwner && page.url.pathname === '/owner-view');

	let viewable = $derived(
		callerIsOwner ||
			!!space?.isPublic.num || //
			!!spaceContext?.permissionCode ||
			isMergedView ||
			isOwnerView,
	);
	let promptSignIn = $derived(getPromptSigningIn());
	let promptEnableLocalSpace = $derived(getPromptEnableLocalSpace());
	let callerMs = $derived(gs.accounts?.[0].ms);
	let callerCheckedSpace = $derived(
		callerMs !== undefined &&
			urlInMs !== undefined &&
			gs.accountMsToSpaceMsToCheckedMap[callerMs]?.[urlInMs],
	);
	let okToLoadMorePosts = $derived(
		!promptSignIn &&
			!promptEnableLocalSpace &&
			(isMergedView || isOwnerView || (viewable && callerCheckedSpace)),
	);
	let identifier = $derived(
		!okToLoadMorePosts
			? ''
			: JSON.stringify({
					callerMs,
					href: page.url.href,
				}),
	);
	$effect(() => {
		// console.log('viewable:', viewable);
		// console.log('okToLoadMorePosts:', okToLoadMorePosts);
		// console.log(
		// 	callerMs === undefined,
		// 	promptSignIn,
		// 	urlInMs === undefined,
		// 	!isMergedView,
		// 	!isOwnerView,
		// );
		// console.log('identifier:', identifier);
	});
	let postFeed = $derived(gs.identifierToPostFeedMap[identifier]);
	let sectionObjs = $derived(postFeed?.sectionObjs || []);
	let endReached = $derived(postFeed?.endReached);
	let error = $derived(postFeed?.error ?? '');
	let useLocalDb = $derived(urlInMs === 0);
	let hasAnyPosts = $derived(
		sectionObjs.some((o) => o.topLvlPostIdStrs.some((s) => gs.idToPostMap[s])),
	);

	let mergePostFeedUpdate = (postFeedUpdate: Awaited<ReturnType<typeof getPostFeed>>) => {
		mergeMsToAccountNameTxtMap(postFeedUpdate.msToAccountNameTxtMap);
		mergeMsToSpaceNameTxtMap(postFeedUpdate.msToSpaceNameTxtMap);
		mergeSpaceMsToAccountMsToMembershipMap(postFeedUpdate.spaceMsToAccountMsToMembershipMap);
		Object.entries(postFeedUpdate.idToPostMap || {}).forEach(([id, post]) => {
			let lastVersion = getLastVersion(post);
			if (lastVersion !== null && post.history?.[lastVersion])
				(post.history[lastVersion].tags ??= []).sort();
			// if (!gs.idToPostMap[id]) {
			// 	gs.idToPostMap[id] = { ...gs.idToPostMap[id], ...post };
			// }
			gs.idToPostMap[id] = post;
			if (hasParent(post)) {
				let atIdStr = getAtIdStr(post);
				gs.postIdToSubIdsMap[atIdStr] = [
					...new Set([...(gs.postIdToSubIdsMap[atIdStr] || []), id]),
				].sort(
					// TODO: sort reply posts by reactions and atPost author?
					(a, b) => getIdStrAsIdObj(b).ms - getIdStrAsIdObj(a).ms,
				);
			}
		});
	};

	let loadMorePosts = async (e: InfiniteEvent) => {
		// console.log('loadMorePosts');
		// if (1) return;
		if (!okToLoadMorePosts) return;
		// await new Promise((res) => setTimeout(res, 1000));
		// TODO: load locally saved topLvlPostIdStrs and only fetch new ones if the user scrolls or
		// interacts with the feed. This is to reduce unnecessary requests when the user just wants
		// to add a post via the extension
		// TODO: use local db as a fallback when cloud db can't find a post
		if (endReached) return e.detail.complete();
		try {
			let firstLoad = !sectionObjs.length;
			let sectionHeadings: {
				heading: (typeof sectionObjs)['0']['heading'];
				secondaryTxt?: string;
			}[] = [];
			let extensionSearchPostFeedSection: undefined | PostFeedSection;
			let forYouPostFeedSection: undefined | PostFeedSection;
			let pinnedPostFeedSection: undefined | PostFeedSection;
			let mainPostFeedSection: undefined | PostFeedSection;
			let getMinTopLvlPostLimit = (topLvlPostLimit: number, p: ParsedQ) =>
				getParsedQPaginates(p)
					? topLvlPostLimit
					: Math.min(topLvlPostLimit, p.postIdObjsInclude.length);
			if (idSlug) {
				sectionHeadings.push({ heading: 'post' });
				mainPostFeedSection = {
					...getDefaultSection(),
					postIdObjsInclude: [getIdStrAsIdObj(idSlug)],
					flatView: false,
					topLvlPostLimit: 1,
				};
			} else {
				if (firstLoad && flatView && newFirst && !isMergedView && !isOwnerView && !qSearchParam) {
					if (gs.extensionSearchQ) {
						sectionHeadings.push({ heading: 'extSearch', secondaryTxt: gs.extensionSearchQ });
						let parsedExtSearchQ = parseSearchQuery(gs.extensionSearchQ);
						extensionSearchPostFeedSection = {
							...getDefaultSection(),
							...parsedExtSearchQ,
							topLvlPostLimit: getMinTopLvlPostLimit(3, parsedExtSearchQ),
						};
						extensionSearchPostFeedSection.eitherInMss.push(urlInMs!);
					} else {
						if (urlInMs && callerMs && urlInMs !== callerMs && spaceContext?.permissionCode) {
							sectionHeadings.push({ heading: 'forYou' });
							forYouPostFeedSection = {
								...getDefaultSection(),
								eitherInMss: [urlInMs],
								eitherAtByMss: [callerMs],
								// eitherTags: ['__' + callerMs], // TODO: merge posts with account tag and eitherAtByMss
								// This may require a rewrite to the parser (using an AST, parentheses, and pipes "|") due
								// to the ambiguity of `@__8 [__8]`
								// Unclear if this should search for posts tagged with __8 at account __8 or
								// posts at account __8 or posts tagged with __8
								// TODO: Would also have to make an api for searching current space members.
								// Would be used in dots page to search for members and PostWriter for tagging account ids
								topLvlPostLimit: 3,
							};
						}
						if (space?.pinnedQuery.txt) {
							sectionHeadings.push({ heading: 'pinned', secondaryTxt: space?.pinnedQuery.txt });
							let parsedPinnedQueryTxt = parseSearchQuery(space?.pinnedQuery.txt);
							pinnedPostFeedSection = {
								...getDefaultSection(),
								...parsedPinnedQueryTxt,
								topLvlPostLimit: getMinTopLvlPostLimit(3, parsedPinnedQueryTxt),
							};
							pinnedPostFeedSection.eitherInMss.push(urlInMs!);
						}
					}
				}
				sectionHeadings.push({
					heading: qSearchParam ? 'search' : sectionHeadings.length ? 'nextUp' : '',
					secondaryTxt: qSearchParam,
				});
				let parsedQ = parseSearchQuery(qSearchParam);
				mainPostFeedSection = {
					...getDefaultSection(),
					flatView,
					newFirst,
					msGte,
					msLte,
					...parsedQ,
					topLvlPostLimit: getMinTopLvlPostLimit(maxTopLvlPostLimitPerSection, parsedQ),
					eitherInMss: [
						...new Set([
							...(isMergedView
								? (page.url.searchParams.get('inMss') ?? '').split(',').map(Number)
								: useLocalDb || isOwnerView
									? []
									: [urlInMs!]),
							...(parsedQ.eitherInMss || []),
						]),
					],
				};
				let lastSectionTopLvlPostIdStrs = sectionObjs.at(-1)?.topLvlPostIdStrs;
				let lastTopLvlPostIdStr = lastSectionTopLvlPostIdStrs?.at(-1);
				let lastTopLvlPostIdObj = lastTopLvlPostIdStr ? getIdStrAsIdObj(lastTopLvlPostIdStr) : null;
				if (!firstLoad) mainPostFeedSection.postIdObjsInclude = [];
				if (lastTopLvlPostIdObj && getParsedQPaginates(parsedQ)) {
					if (flatView) {
						mainPostFeedSection[newFirst ? 'msLte' : 'msGte'] = lastTopLvlPostIdObj.ms;
						let lastTopLvlPostIdObjsWithSameMs: IdObj[] = [lastTopLvlPostIdObj];
						for (let i = lastSectionTopLvlPostIdStrs!.length - 2; i >= 0; i--) {
							let postIdStr = lastSectionTopLvlPostIdStrs![i];
							let o = getIdStrAsIdObj(postIdStr);
							if (o.ms === lastTopLvlPostIdObj.ms) lastTopLvlPostIdObjsWithSameMs.push(o);
							else break;
						}
						mainPostFeedSection.postIdObjsExclude = [...lastTopLvlPostIdObjsWithSameMs];
					} else {
						let getAllIdsInNest = (parentIdStr: string): string[] => {
							let result = new Set<string>();
							result.add(parentIdStr);
							let subIds = gs.postIdToSubIdsMap[parentIdStr] || [];
							for (let subId of subIds) {
								let childDescendants = getAllIdsInNest(subId);
								childDescendants.forEach((id) => result.add(id));
							}
							return [...result];
						};
						let getLastPostInNestToSatisfyQuery = (topLvlPostIdObj: IdObj) =>
							getAllIdsInNest(getIdStr(topLvlPostIdObj))
								.map((s) => getIdStrAsIdObj(s))
								.sort((a, b) => (newFirst ? b.ms - a.ms : a.ms - b.ms))
								.find((o) => {
									let s = getIdStr(o);
									let post = gs.idToPostMap[s];
									let lastHistoryLayer = post?.history?.[getLastVersion(post)!];
									if (!post || !lastHistoryLayer) return false;
									return (
										(!parsedQ.eitherByMss.length ||
											parsedQ.eitherByMss.some((byMs) => post.by_ms === byMs)) &&
										(!parsedQ.eitherAtByMss.length ||
											parsedQ.eitherAtByMss.some((atByMs) => post.at_by_ms === atByMs)) &&
										(!parsedQ.requiredTags.length ||
											parsedQ.requiredTags.every((requiredTag) =>
												(lastHistoryLayer.tags || []).includes(requiredTag),
											)) &&
										(!parsedQ.eitherTags.length ||
											parsedQ.eitherTags.some((eitherTag) =>
												(lastHistoryLayer.tags || []).includes(eitherTag),
											)) &&
										(!parsedQ.requiredTagStarts.length ||
											parsedQ.requiredTagStarts.every((requiredTagStart) =>
												(lastHistoryLayer.tags || []).find((tag) =>
													tag.toLowerCase().startsWith(requiredTagStart.toLowerCase()),
												),
											)) &&
										(!parsedQ.eitherTagStarts.length ||
											parsedQ.eitherTagStarts.some((eitherTagStart) =>
												(lastHistoryLayer.tags || []).find((tag) =>
													tag.toLowerCase().startsWith(eitherTagStart.toLowerCase()),
												),
											)) &&
										(!parsedQ.requiredTagEnds.length ||
											parsedQ.requiredTagEnds.every((requiredTagEnd) =>
												(lastHistoryLayer.tags || []).find((tag) =>
													tag.toLowerCase().endsWith(requiredTagEnd.toLowerCase()),
												),
											)) &&
										(!parsedQ.eitherTagEnds.length ||
											parsedQ.eitherTagEnds.some((eitherTagEnd) =>
												(lastHistoryLayer.tags || []).find((tag) =>
													tag.toLowerCase().endsWith(eitherTagEnd.toLowerCase()),
												),
											)) &&
										(!parsedQ.requiredCoreIncludes.length ||
											parsedQ.requiredCoreIncludes.every((requiredCoreInclude) =>
												lastHistoryLayer.core
													?.toLowerCase()
													.includes(requiredCoreInclude.toLowerCase()),
											)) &&
										(!parsedQ.eitherCoreIncludes.length ||
											parsedQ.eitherCoreIncludes.some((eitherCoreInclude) =>
												lastHistoryLayer.core
													?.toLowerCase()
													.includes(eitherCoreInclude.toLowerCase()),
											))
									);
								})!;
						let lastPostInLastNestToSatisfyQuery =
							getLastPostInNestToSatisfyQuery(lastTopLvlPostIdObj);
						mainPostFeedSection[newFirst ? 'msLte' : 'msGte'] = lastPostInLastNestToSatisfyQuery.ms;
						mainPostFeedSection.postIdObjsExclude = (lastSectionTopLvlPostIdStrs || [])
							.flatMap((s) => getAllIdsInNest(s))
							.map((s) => getIdStrAsIdObj(s))
							.filter((o) =>
								newFirst
									? o.ms <= lastPostInLastNestToSatisfyQuery.ms
									: o.ms >= lastPostInLastNestToSatisfyQuery.ms,
							);
					}
					// console.log('mainPostFeedSection.msGte:', mainPostFeedSection.msGte);
				}
			}
			// console.log('mainPostFeedSection:', mainPostFeedSection);
			let setLastViewMsInMs =
				spaceContext &&
				!postFeed &&
				callerMs !== urlInMs &&
				page.route.id === '/[spaceSlug=spaceSlug]'
					? urlInMs //
					: undefined;
			console.time('getPostFeed');
			let postFeedUpdate = await getPostFeed(
				[
					extensionSearchPostFeedSection,
					forYouPostFeedSection,
					pinnedPostFeedSection,
					mainPostFeedSection,
				].filter((s) => !!s),
				useLocalDb,
				setLastViewMsInMs,
			);
			console.timeEnd('getPostFeed');
			if (setLastViewMsInMs) {
				updateLocalCache((lc) => {
					lc.accounts[0].msToJoinedSpaceContextMap[setLastViewMsInMs]!.accentCode =
						accentCodes.none;
					return lc;
				});
			}
			let { topLvlPostIdStrsSections: newTopLvlPostIdStrsSections = [] } = postFeedUpdate;
			// console.log('postFeedUpdate:', postFeedUpdate);
			// TODO: add account and space names to to local db using msToAccountNameTxtMap and msToSpaceNameTxtMap
			mergePostFeedUpdate(postFeedUpdate);
			let lastSectionTopLvlPostIdStrs = newTopLvlPostIdStrsSections?.at(-1) || [];
			lastSectionTopLvlPostIdStrs.length && e.detail.loaded();
			let endReached =
				!getParsedQPaginates(mainPostFeedSection) ||
				lastSectionTopLvlPostIdStrs.length < mainPostFeedSection.topLvlPostLimit;
			endReached && e.detail.complete();

			let newSectionObjs: typeof sectionObjs = [];
			if (firstLoad) {
				newSectionObjs = newTopLvlPostIdStrsSections.map((newTopLvlPostIdStrsSection, i) => {
					return {
						...sectionHeadings[i],
						topLvlPostIdStrs: newTopLvlPostIdStrsSection,
					};
				});
			} else {
				newSectionObjs = [...sectionObjs];
				newSectionObjs.at(-1)!.topLvlPostIdStrs.push(...newTopLvlPostIdStrsSections[0]);
			}
			gs.identifierToPostFeedMap = {
				...gs.identifierToPostFeedMap,
				[identifier]: {
					endReached,
					sectionObjs: newSectionObjs,
				},
			};
		} catch (error) {
			console.error(error);
			gs.identifierToPostFeedMap = {
				...gs.identifierToPostFeedMap,
				[identifier]: {
					error: makeErrorReadable(error),
				},
			};
			e.detail.error();
		}
	};

	// TODO: go through fetched idToPostMap and hydrate any posts with history === null with locally saved posts
	let getLocallySavedPost = async (postIdObj: IdObj) =>
		(
			await getPostFeed(
				[{ ...getDefaultSection(), postIdObjsInclude: [getIdObj(postIdObj)] }],
				true,
			)
		).idToPostMap?.[getIdStr(postIdObj)];

	let viewPostToastId = $state('');
	let submitPost = async (tags: string[], core: string) => {
		if (!gs.accounts || !sectionObjs.length) return;
		let editPostIdStr = gs.writingEditFor && getIdStr(gs.writingEditFor);
		let atPostIdStr = gs.writingReplyTo && getIdStr(gs.writingReplyTo);
		let atPostIdObj = gs.writingReplyTo && getIdObj(gs.writingReplyTo);
		let writingNewPost = !!gs.writingNewPost;
		resetBottomOverlay();
		gs.writerTags = [];
		gs.writerTagVal = '';
		gs.writerCore = '';
		try {
			((editPostIdStr && !editPostIdStr?.startsWith('0_')) ||
				(writingNewPost && urlInMs) ||
				atPostIdObj?.in_ms) && //
				assertCallerIsOwnerOrInGlobal();
			updateSavedTags(tags, []);
			let post: Post;
			if (editPostIdStr) {
				let postToEdit = gs.idToPostMap[editPostIdStr]!;
				let newLastVersion = getLastVersion(postToEdit)! + 1;
				gs.idToPostMap[editPostIdStr] = {
					...postToEdit,
					history: {
						...postToEdit.history,
						[newLastVersion]: {
							ms: Date.now(),
							tags,
							core,
						},
					},
				};
				post = {
					...postToEdit,
					history: {
						...postToEdit.history,
						[newLastVersion]: {
							ms: 0,
							tags,
							core,
						},
					},
				};
				post.history![newLastVersion]!.ms = (await editPost(post, false, false)).ms;
				if (0 && !useLocalDb) {
					// TODO:
					let locallySavedPost = getLocallySavedPost(post);
					if (!locallySavedPost) await addPost(post, true, true, []);
					await editPost(post, true, true);
				}
			} else {
				post = {
					in_ms: urlInMs ?? atPostIdObj!.in_ms,
					ms: 0,
					by_ms: gs.accounts[0].ms,
					...(atPostIdObj
						? {
								at_ms: atPostIdObj.ms,
								at_by_ms: atPostIdObj.by_ms,
							}
						: {}),
					childCount: 0,
					history: {
						1: {
							ms: 0,
							tags: cleanTags(tags),
							core,
						},
					},
				};
				let tempPost = { ...post, ms: Date.now(), pending: true };
				let tempPostIdStr = getIdStr(tempPost);
				gs.idToPostMap = { ...gs.idToPostMap, [tempPostIdStr]: tempPost };
				if (flatView && newFirst) sectionObjs.at(-1)!.topLvlPostIdStrs.unshift(tempPostIdStr);
				if (atPostIdStr) {
					gs.idToPostMap[atPostIdStr]!.childCount!++;
					gs.postIdToSubIdsMap[atPostIdStr] ??= [];
					gs.postIdToSubIdsMap[atPostIdStr].unshift(tempPostIdStr);
				}
				let res = await addPost(
					post,
					useLocalDb,
					false,
					getCitedPostIds(core)
						.filter((s) => gs.idToPostMap[s] === undefined)
						.map((s) => getIdStrAsIdObj(s)),
				);
				post.ms = post.history![1]!.ms = res.ms;
				mergePostFeedUpdate(res);
				gs.idToPostMap[tempPostIdStr] = null;
				let strPostId = getIdStr(post);
				gs.idToPostMap = { ...gs.idToPostMap, [strPostId]: post };
				if (writingNewPost || atPostIdStr) {
					if (atPostIdStr) gs.postIdToSubIdsMap[getAtIdStr(post)]!.unshift(strPostId);
					if (flatView && newFirst) sectionObjs.at(-1)!.topLvlPostIdStrs.unshift(strPostId);
					viewPostToastId = strPostId;
					setTimeout(() => (viewPostToastId = ''), 3000);
				}
				// 	if (!locallySavedPost) await addPost(post, true, true, []);
				// !useLocalDb && (await addPost(post, true, true, []));
			}
		} catch (error) {
			return alertError(error);
		}
	};

	let makeParams = (willBeFlatView: boolean, willBeNewFirst: boolean) => {
		return getAlteredSearchParams({
			...{
				flat: null,
				nested: null,
				new: null,
				old: null,
			},
			...(willBeFlatView ? {} : { nested: undefined }),
			...(willBeNewFirst ? {} : { old: undefined }),
		});
	};
	// TODO: when clicking to a page with the feed already cached, it takes noticeably
	// longer to render presumably cuz it's rendering the whole feed. Get rid of this
	// delay without taking away the ability to command-f the whole page. Scroll height
	// mustn't change so to maintain same scroll position when switching between space and post feeds.
	let topLvlPostCount = $derived(sectionObjs.flatMap((o) => o.topLvlPostIdStrs).length);
	let lastScrolledToPostId = $state('');
	$effect(() => {
		if (topLvlPostCount && idSlug && lastScrolledToPostId !== idSlug) {
			lastScrolledToPostId = idSlug;
			scrollToHighlight(idSlug);
		}
	});

	onMount(() => {
		let handler = (e: KeyboardEvent) => {
			if (!textInputFocused()) {
				// TODO: press n to sort feed by new
				// TODO: press o to sort feed by old
				// TODO: press f to sort feed by first

				// TODO: press r to reply to current highlighted or hovered post
				// TODO: press e to edit to current highlighted or hovered post
				// TODO: press c to cite current highlighted or hovered post

				// TODO: press left/right to highlight next adjacent post
				// TODO: press shift left/right to highlight next depth 0 post
				if (canPost && e.key === 'n') {
					e.preventDefault();
					resetBottomOverlay();
					gs.writingNewPost = true;
				}
			}
		};
		window.addEventListener('keydown', handler);
		return () => {
			resetBottomOverlay();
			window.removeEventListener('keydown', handler);
		};
	});
	let ownerViewingPosts = $derived(
		isOwnerView &&
			page.url.searchParams.get('accounts') === null &&
			page.url.searchParams.get('spaces') === null,
	);
	let endingPanelClass = $derived(
		`text-lg text-fg2 ${
			isMergedView || ownerViewingPosts
				? 'h-[calc(100vh-64px-36px)]' //
				: 'h-[calc(100vh-32px-36px)]'
		}`,
	);
</script>

<!-- {#if callerMs === undefined || (urlInMs === undefined ? !viewable : !gs.accountMsToSpaceMsToCheckedMap[callerMs]?.[urlInMs])} -->
{#if callerMs === undefined}
	<!--  -->
{:else if promptSignIn}
	<PromptSignIn />
{:else if promptEnableLocalSpace}
	<PromptEnableLocalSpace />
{:else if !viewable}
	{#if callerCheckedSpace}
		<p class="m-2 text-lg text-fg2 text-center">
			{m.spaceNotFound()}
		</p>
	{/if}
{:else}
	<div class="flex flex-col pb-9">
		<div class={isMergedView || (isOwnerView && ownerViewingPosts) ? 'pt-16' : 'pt-8'}>
			<div
				class={`z-50 fixed ${isMergedView || isOwnerView ? 'top-8' : 'top-0'} bg-bg1 flex w-full xs:w-[calc(100vw-var(--w-sidebar))] text-fg2 shrink-0 h-8 ${idSlug ? 'hidden' : ''}`}
			>
				<div class="flex overflow-x-scroll">
					<a
						href={makeParams(true, newFirst)}
						class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${flatView ? 'text-fg1' : ''}`}
					>
						<IconList stroke={2.5} class="h-4" />{m.flat()}
					</a>
					<a
						href={makeParams(false, newFirst)}
						class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${flatView ? '' : 'text-fg1'}`}
					>
						<IconListTree stroke={2.5} class="h-4" />{m.nested()}
					</a>
					<div class="xy mr-0.5">
						<IconSquareFilled class="h-1.5 w-1.5" />
					</div>
					<a
						href={makeParams(flatView, true)}
						class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${newFirst ? 'text-fg1' : ''}`}
					>
						<IconClockUp stroke={2.5} class="h-4" />{m.new()}
					</a>
					<a
						href={makeParams(flatView, false)}
						class={`fx pr-1.5 hover:bg-bg4 hover:text-fg1 ${newFirst ? '' : 'text-fg1'}`}
					>
						<IconArchive stroke={2.5} class="h-4" />{m.old()}
					</a>
				</div>
				<TimeRangePicker
					{msGte}
					{msLte}
					onChange={(newMsGte, newMsLte) => {
						gotoIfNeeded(
							getAlteredSearchParams({
								msGte: newMsGte,
								msLte: newMsLte,
							}),
						);
					}}
				/>
			</div>
			{#each sectionObjs as sectionObj, i (i)}
				<div>
					{#if sectionObj.heading}
						<div
							class={`h-8 flex w-full text-nowrap overflow-scroll xs:w-[calc(100vw-var(--w-sidebar))] pl-2 font-semibold fx bg-bg1 ${sectionObj.heading === 'post' ? 'z-50 fixed top-0' : ''}`}
						>
							{#if sectionObj.heading === 'post'}
								{m.post()}
								<a
									class="font-medium pl-2 h-full flex-1 fx text-fg2 hover:bg-bg4 hover:text-fg1"
									href={`/merged-view?q="${idSlug}"`}
								>
									{m.citedIn()}
									<IconChevronRight />
								</a>
							{:else if sectionObj.heading === 'search'}
								{m.search()}
								<p class="font-medium pl-2 h-full flex-1 fx text-fg2">
									{sectionObj.secondaryTxt}
								</p>
							{:else if sectionObj.heading === 'forYou'}
								{m.forYou()}
								{#if sectionObj.topLvlPostIdStrs.length > 2}
									<a
										class="font-medium pl-2 h-full flex-1 fx text-fg2 justify-between hover:bg-bg4 hover:text-fg1"
										href={`?q=@__${callerMs}`}
									>
										{m.showMore()}
										<IconChevronRight />
									</a>
								{/if}
							{:else}
								{#if sectionObj.heading === 'nextUp'}
									{m.nextUp()}
								{:else if sectionObj.heading === 'extSearch'}
									{m.extensionSearch()}
								{:else if sectionObj.heading === 'pinned'}
									{m.pinned()}
								{/if}
								{#if sectionObj.secondaryTxt}
									<a
										class="font-medium pl-2 h-full flex-1 fx text-fg2 justify-between hover:bg-bg4 hover:text-fg1"
										href={`?q=${sectionObj.secondaryTxt}`}
									>
										{sectionObj.secondaryTxt}
										<IconChevronRight />
									</a>
								{/if}
							{/if}
						</div>
						{#if i !== sectionObjs.length - 1 && !sectionObj.topLvlPostIdStrs.length}
							<p class="pl-2 text-fg2">{m.nothingFound()}</p>
						{/if}
					{/if}
					{#each sectionObj.topLvlPostIdStrs as s (s)}
						{#if gs.idToPostMap[s]}
							<PostBlock
								post={gs.idToPostMap[s]}
								depth={0}
								nested={!flatView && i === sectionObjs.length - 1}
							/>
						{:else if gs.idToPostMap[s] === undefined}
							<div class="text-sm font-bold text-fg2">
								{(console.warn(m.idNotFound({ id: s })), m.idNotFound({ id: s }))}
							</div>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
		{#if viewable}
			<InfiniteLoading {identifier} spinner="spiral" on:infinite={loadMorePosts}>
				<div slot="error" class={endingPanelClass}>
					{error}
				</div>
				<div slot="noResults" class={endingPanelClass}>
					<!-- noResults slot shows even after adding the first post -->
					{hasAnyPosts ? m.theEnd() : m.noPostsFound()}
				</div>
				<div slot="noMore" class={endingPanelClass}>
					{m.theEnd()}
				</div>
			</InfiniteLoading>
		{/if}
		<div class="z-50 flex fixed left-18 xs:left-[var(--w-sidebar)] right-0 bottom-0">
			<SearchBar />
			{#if idSlug}
				<a
					href={`/${urlInMs}__`}
					onclick={() => {
						gs.lastScrollY && setTimeout(() => window.scrollTo({ top: gs.lastScrollY }), 1);
					}}
					class="xy h-9 w-9 bg-bg6 hover:bg-bg8 hover:text-fg3 hover:border-hl2"
				>
					<IconX class="w-8" />
				</a>
			{:else if canPost}
				<button
					class="xy h-9 w-9 text-bg1 bg-fg1 hover:bg-fg3 hover:border-hl2"
					onclick={() => (gs.writingNewPost = true)}
				>
					<IconPencilPlus class="h-7 w-7" />
				</button>
			{/if}
		</div>
		<div class="flex-1"></div>
		{#if viewPostToastId}
			<a
				href={'/' + viewPostToastId}
				class="z-50 fixed bottom-2 self-center fx h-10 pl-2 font-semibold bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2"
			>
				{m.viewPost()}
				<IconChevronRight class="h-5" stroke={3} />
			</a>
		{/if}
	</div>
{/if}
<div
	class={`fixed bottom-0 z-50 left-0 xs:left-[var(--w-sidebar)] right-0 h-[var(--h-post-writer)] ${getBottomOverlayShown() ? '' : 'hidden'}`}
>
	{#if gs.showReactionHistory}
		<ReactionHistory />
	{:else}
		<PostWriter onSubmit={submitPost} />
	{/if}
</div>
