<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import {
		getCallerIsOwner,
		getSpacePermissions,
		gs,
		msToAccountItalic,
		msToAccountNameTxt,
		msToSpaceItalic,
		msToSpaceNameTxt,
		onCite,
		resetBottomOverlay,
	} from '$lib/global-state.svelte';
	import { alertError, copyToClipboard, deepClone, is1Emoji, isTouchScreen } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs, minute } from '$lib/time';
	import { hasParent } from '$lib/types/parts';
	import { getAtIdStr, getIdObj, getIdStr, getUrlInMs } from '$lib/types/parts/partIds';
	import { getLastVersion, type Post } from '$lib/types/posts';
	import { deletePost } from '$lib/types/posts/deletePost';
	import { getPostHistory } from '$lib/types/posts/getPostHistory';
	import type { RxnEmoji } from '$lib/types/reactions';
	import { toggleReaction } from '$lib/types/reactions/toggleReaction';
	import { roleCodes } from '$lib/types/spaces';
	import {
		IconBrowserMinus,
		IconBrowserPlus,
		IconCaretLeft,
		IconCaretRight,
		IconChartBarPopular,
		IconCheck,
		IconCopy,
		IconCrownFilled,
		IconCube,
		IconCube3dSphere,
		IconDots,
		IconLibraryPlus,
		IconMessage2,
		IconMessage2Plus,
		IconMinus,
		IconMoodPlus,
		IconPencil,
		IconPlus,
		IconShare2,
		IconShieldFilled,
		IconTrash,
		IconX,
	} from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import CoreParser from './CoreParser.svelte';
	import Highlight from './Highlight.svelte';
	import Self from './PostBlock.svelte';
	import SpaceIcon from './SpaceIcon.svelte';
	// TODO: speak posts? Doesn't work for all languages... オープンソースソフトウェア
	// let utterance = new SpeechSynthesisUtterance('Hello world!');
	// utterance.rate = 3;
	// speechSynthesis.speak(utterance);

	let p: {
		post: Post;
		isEmbed?: boolean;
		nested?: boolean;
		cited?: boolean;
		depth: number;
		boldTags?: string[];
		boldCore?: string[];
	} = $props();
	let container: HTMLDivElement;
	let reactionMenuDiv: HTMLDivElement;
	let moreOptionsMenuDiv: HTMLDivElement;
	let lastMenuOpen = $state<'' | 'reaction' | 'moreOptions'>('');
	let reactionMenuRight = $state(0);
	let moreOptionsMenuRight = $state(0);
	let open = $state(true);
	let parsed = $state(true);
	let loading = $state(false);
	let postIdStr = $derived(getIdStr(p.post));
	let postIdObj = $derived(getIdObj(p.post));
	let subIds = $derived.by(() => {
		let arr = (gs.postIdToSubIdsMap[postIdStr] || []).filter((s) => gs.idToPostMap[s]);
		if (p.nested && p.post.childCount !== arr.length)
			console.warn(
				`nested ${postIdStr} childCount is ${p.post.childCount} but subIds.length is ${arr.length}`,
			);
		return arr;
	});
	let evenBg = $derived(!(p.depth % 2));
	let atPostIdStr = $derived(getAtIdStr(p.post));
	let atPost = $derived.by(() => {
		if (atPostIdStr) {
			let atPost = gs.idToPostMap[atPostIdStr];
			if (atPost) return atPost;
			else if (!p.cited) console.warn(`atPost ${atPostIdStr} dne for ${postIdStr}`);
		}
	});
	let atPostDeleted = $derived(atPost?.history === null);
	let deleted = $derived(p.post.history === null);
	let atPostTxt = $derived.by(() => {
		if (atPost) {
			if (atPostDeleted) return m.deleted();
			return atPost.history![getLastVersion(atPost)!]!.core;
		}
	});
	let lastVersion = $derived(getLastVersion(p.post));
	let version = $state((() => lastVersion)());
	let layer = $derived(version === null ? null : p.post.history![version]);
	let core = $derived(layer?.core);
	let tags = $derived(layer?.tags || []);
	let { canPost, canReact } = $derived(getSpacePermissions(p.post.in_ms));

	let rxnEmojiCountEntries = $derived(
		Object.entries(p.post.rxnEmojiCount || {}).sort(([, a], [, b]) => b - a) as [
			RxnEmoji,
			number,
		][],
	);
	let changeVersion = async (v: number) => {
		version = v;
		if (!p.post.history![v]) {
			loading = true;
			try {
				let { history } = await getPostHistory(postIdObj, v);
				if (!history) return;
				Object.keys(history).forEach((key) => history[key]?.tags?.sort());
				gs.idToPostMap[postIdStr] = {
					...gs.idToPostMap[postIdStr]!,
					history: {
						...gs.idToPostMap[postIdStr]!.history,
						...history,
					},
				};
			} catch (error) {
				alertError(error);
			} finally {
				loading = false;
			}
		}
	};

	let oldLastVersion = (() => lastVersion)();
	$effect(() => {
		if (lastVersion !== null && oldLastVersion !== lastVersion) {
			changeVersion(lastVersion);
			oldLastVersion = lastVersion;
		}
	});

	let moreOptionsOpen = $state(false);
	let versionMs = $derived(
		(version === null || p.post.history === null ? null : p.post.history[version]?.ms) ?? p.post.ms,
	);
	let showVersionControls = $derived(lastVersion && lastVersion > 1 && version);
	let msLabel = $derived(
		version === null
			? formatMs(p.post.ms)
			: `${formatMs(versionMs, 'ago')} / ${formatMs(versionMs, 'day')}${showVersionControls ? ` (${version} / ${lastVersion})` : ''}`,
	);
	let isoMsLabel = $derived(formatMs(versionMs || p.post.ms, 'ms'));
	let urlInMs = $derived(getUrlInMs());
	let copyClicked = $state(false);
	let handleCopyClick = () => {
		copyToClipboard(version === null ? '' : (p.post.history?.[version]?.core ?? ''));
		copyClicked = true;
		setTimeout(() => (copyClicked = false), 1000);
	};
	let callerMs = $derived(gs.accounts?.[0].ms);
	let callerIsAuthor = $derived(callerMs === p.post.by_ms);
	let postIsInLocal = $derived(p.post.in_ms === 0);
	let callerIsOwner = $derived(getCallerIsOwner());
	let isMergedView = $derived(page.url.pathname === '/merged-view');
	let isOwnerView = $derived(callerIsOwner && page.url.pathname === '/owner-view');
	let tallPostFeedHeader = $derived(isMergedView || isOwnerView);
	let callerCanDelete = $derived(
		(lastVersion !== null || !p.post.childCount) &&
			(postIsInLocal || callerIsAuthor || callerIsOwner),
	);
	let callerCanEdit = $derived(lastVersion !== null && (postIsInLocal || callerIsAuthor));
	let authorRole = $derived(
		gs.spaceMsToAccountMsToMembershipMap[p.post.in_ms]?.[p.post.by_ms]?.roleCode,
	);
	let savedLocally = $derived(gs.postIdToLocallySavedMap[postIdStr]);
	let toggleSavedLocally = () => {
		if (savedLocally) delete gs.postIdToLocallySavedMap[postIdStr];
		else gs.postIdToLocallySavedMap[postIdStr] = true;
	};
	let hasAtPostHeader = $derived(!p.nested && atPost);
	let stickyMenuTop = $derived(
		`sticky ${
			hasAtPostHeader
				? tallPostFeedHeader
					? 'top-16'
					: 'top-8'
				: tallPostFeedHeader
					? 'top-24'
					: 'top-16'
		}`,
	);
	let target = $derived(p.isEmbed ? '_blank' : undefined);
	let typedEmoji = $state('');
	$effect(() => {
		if (typedEmoji) {
			is1Emoji(typedEmoji) //
				? (async () =>
						await toggleReaction({
							postIdObj,
							emoji: typedEmoji,
						}))()
				: alert(m.useYourDevicesEmojiKeyboard());
		}
		typedEmoji = '';
	});
	let hoveringReactionInput = $state(false);
	let hoveringReactionMenu = $state(false);
	let reactionIptFocused = $state(false);
	let hoveringMoreOptionsBtn = $state(false);
	let hoveringMoreOptionsMenu = $state(false);
	let showMoreOptionsMenu = $derived(
		moreOptionsOpen || hoveringMoreOptionsBtn || hoveringMoreOptionsMenu,
	);
	let showReactionMenu = $derived(
		reactionIptFocused || hoveringReactionInput || hoveringReactionMenu,
	);

	let calcMenuRight = (triggerEl: HTMLElement, menuEl: HTMLElement) => {
		let triggerRect = triggerEl.getBoundingClientRect();
		let menuRect = menuEl.getBoundingClientRect();
		let rightSpace = window.innerWidth - triggerRect.right;
		let leftSpace = window.innerWidth - rightSpace - menuRect.width;
		if (leftSpace < 0) rightSpace += leftSpace;
		return Math.max(0, rightSpace);
	};
</script>

{#snippet reactionInput()}
	<div
		class={`fx relative px-1 gap-1 text-fg2 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
	>
		<IconMoodPlus class="h-4.5 w-4.5" />
		{m.react()}
		<input
			bind:value={typedEmoji}
			class="absolute inset-0 p-1"
			onfocus={(e) => {
				reactionIptFocused = true;
				lastMenuOpen = 'reaction';
				reactionMenuRight = calcMenuRight(e.currentTarget, reactionMenuDiv);
			}}
			onblur={() => (reactionIptFocused = false)}
			onmouseenter={(e) => {
				if (isTouchScreen) return;
				hoveringReactionInput = true;
				reactionMenuRight = calcMenuRight(e.currentTarget, reactionMenuDiv);
				lastMenuOpen = 'reaction';
			}}
			onmouseleave={() => (hoveringReactionInput = false)}
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.stopPropagation();
					e.currentTarget.blur();
				}
			}}
		/>
	</div>
{/snippet}
{#snippet reactionMenu()}
	<div
		class={`${stickyMenuTop} ${lastMenuOpen === 'reaction' ? 'z-30' : 'z-20'}`}
		onmouseenter={() => !isTouchScreen && (hoveringReactionMenu = true)}
		onmouseleave={() => (hoveringReactionMenu = false)}
	>
		<div
			bind:this={reactionMenuDiv}
			class={`h-8 absolute flex ${showReactionMenu ? '' : 'invisible'}`}
			style={`right:${reactionMenuRight}px`}
		>
			{#each ['😂', '👍', '👀', '❤️'] as emoji}
				<button
					class={`w-8 xy ${evenBg ? 'bg-bg3 hover:bg-bg6' : 'bg-bg4 hover:bg-bg7'} ${
						p.post.myRxnEmojis?.includes(emoji) ? 'border-b border-hl1' : ''
					}`}
					onmousedown={(e) => e.preventDefault()}
					onclick={async () => {
						await toggleReaction({
							postIdObj,
							emoji,
						});
					}}
				>
					{emoji}
				</button>
			{/each}
		</div>
	</div>
{/snippet}
{#snippet moreOptionsBtn()}
	<button
		class={`z-0 xy px-1 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
		onclick={(e) => {
			moreOptionsOpen = !moreOptionsOpen;
			lastMenuOpen = 'moreOptions';
			moreOptionsMenuRight = calcMenuRight(e.currentTarget, moreOptionsMenuDiv);
			moreOptionsMenuDiv.scrollTo({
				top: 0,
				left: Number.MAX_SAFE_INTEGER,
				behavior: 'instant',
			});
		}}
		onmouseenter={(e) => {
			if (isTouchScreen) return;
			hoveringMoreOptionsBtn = true;
			moreOptionsMenuRight = calcMenuRight(e.currentTarget, moreOptionsMenuDiv);
			lastMenuOpen = 'moreOptions';
			moreOptionsMenuDiv.scrollTo({
				top: 0,
				left: Number.MAX_SAFE_INTEGER,
				behavior: 'instant',
			});
		}}
		onmouseleave={() => (hoveringMoreOptionsBtn = false)}
	>
		<div class="min-w-5 xy mr-0.5">
			{#if moreOptionsOpen}
				<IconX class="w-5" />
			{:else}
				<IconDots stroke={3} class="w-4" />
			{/if}
		</div>
		{m.more()}
	</button>
{/snippet}
{#snippet moreOptionsMenu()}
	<div
		class={`${stickyMenuTop} ${lastMenuOpen === 'moreOptions' ? (showMoreOptionsMenu ? 'z-40' : 'z-30') : 'z-20'}`}
		onmouseenter={() => !isTouchScreen && (hoveringMoreOptionsMenu = true)}
		onmouseleave={() => (hoveringMoreOptionsMenu = false)}
	>
		<div
			bind:this={moreOptionsMenuDiv}
			class={` max-w-screen overflow-x-scroll flex flex-col items-end absolute ${
				showMoreOptionsMenu ? '' : 'invisible'
			} ${evenBg ? 'bg-bg3' : 'bg-bg4'}`}
			style={`right:${moreOptionsMenuRight}px`}
		>
			<div class="h-8 flex">
				{#if core}
					<button
						class={`xy gap-1 px-1 group hover:text-fg3 ${evenBg ? 'hover:bg-bg6' : 'hover:bg-bg7'}`}
						onclick={() => (parsed = !parsed)}
					>
						{#if parsed}
							<IconCube3dSphere class="h-4 w-4" />
						{:else}
							<IconCube class="h-4 w-4" />
						{/if}
						<p class="text-fg2 group-hover:text-fg1">
							{parsed ? m.unparse() : m.parse()}
						</p>
					</button>
					<button
						class={`xy gap-1 px-1 group hover:text-fg3 ${evenBg ? 'hover:bg-bg6' : 'hover:bg-bg7'}`}
						onclick={handleCopyClick}
					>
						{#if copyClicked}
							<IconCheck class="h-4 w-4" />
						{:else}
							<IconCopy class="h-4 w-4" />
						{/if}
						<p class="text-fg2 group-hover:text-fg1">
							{m.copy()}
						</p>
					</button>
				{/if}
				<!-- TODO: toggle saving posts -->
				{#if 0 && p.post.in_ms !== 0}
					<button
						class={`xy gap-1 px-1 group hover:text-fg3 ${evenBg ? 'hover:bg-bg6' : 'hover:bg-bg7'}`}
						onclick={toggleSavedLocally}
					>
						{#if savedLocally}
							<IconBrowserMinus class="h-4.5 w-4.5" />
						{:else}
							<IconBrowserPlus class="h-4 w-4" />
						{/if}
						<p class="text-fg2 group-hover:text-fg1">
							{savedLocally ? m.unsave() : m.save()}
						</p>
					</button>
				{/if}
				<button
					class={`xy gap-1 px-1 group hover:text-fg3 ${evenBg ? 'hover:bg-bg6' : 'hover:bg-bg7'}`}
					onclick={() => {
						if (!navigator.share) return alert(m.webShareApiNotSupported());
						navigator
							.share({
								url: '/test',
								title: 'title',
								text: 'text',
							})
							.catch((error) => {
								// user cancelled or share failed
								if (error && error.name !== 'AbortError') console.error('Share failed:', error);
							});
					}}
				>
					<IconShare2 class="h-4 w-4" />
					<p class="text-fg2 group-hover:text-fg1">
						{m.share()}
					</p>
				</button>
			</div>
			{#if callerCanDelete || callerCanEdit || showVersionControls}
				<div class="h-8 flex">
					{#if callerCanDelete}
						<button
							class={`xy gap-1 px-1 group hover:text-fg3 ${evenBg ? 'hover:bg-bg6' : 'hover:bg-bg7'}`}
							onclick={async () => {
								let ok =
									dev ||
									Date.now() - versionMs! < minute ||
									confirm(m.areYouSureYouWantToDeleteThisPost());
								if (ok) {
									let postIdObjClone = deepClone(postIdObj);
									version = null;
									if (gs.writingEditFor && getIdStr(gs.writingEditFor) === postIdStr)
										gs.writingEditFor = null;
									if (p.post.childCount) gs.idToPostMap[postIdStr]!.history = null;
									else {
										let parentPostIdStr = getAtIdStr(p.post);
										if (hasParent(p.post) && gs.idToPostMap[parentPostIdStr]) {
											gs.idToPostMap[parentPostIdStr].childCount!--;
											gs.postIdToSubIdsMap[parentPostIdStr] = gs.postIdToSubIdsMap[
												parentPostIdStr
											]!.filter((id) => id !== postIdStr);
										}
										gs.idToPostMap[postIdStr] = null;
									}
									try {
										await deletePost(postIdObjClone, !urlInMs);
									} catch (error) {
										alertError(error);
									}
								}
							}}
						>
							<IconTrash class="w-4.5" />
							<p class="text-fg2 group-hover:text-fg1">
								{m.delete()}
							</p>
						</button>
					{/if}
					{#if callerCanEdit}
						<button
							class={`xy gap-1 px-1 group hover:text-fg3 ${evenBg ? 'hover:bg-bg6' : 'hover:bg-bg7'}`}
							onclick={() => {
								gs.showReactionHistory = gs.writingNewPost = gs.writingReplyTo = null;
								gs.writingEditFor =
									gs.writingEditFor && getIdStr(gs.writingEditFor) === postIdStr ? null : p.post;
								showMoreOptionsMenu = false;
							}}
						>
							<IconPencil class="w-4.5" />
							<p class="text-fg2 group-hover:text-fg1">
								{m.edit()}
							</p>
						</button>
					{/if}
					{#if showVersionControls}
						<button
							class={`xy pr-1 group hover:text-fg3 ${evenBg ? 'hover:bg-bg6' : 'hover:bg-bg7'}`}
							onclick={() => changeVersion(Math.max(1, version! - 1))}
						>
							<IconCaretLeft class="w-5.5" />
							<p class="text-fg2 group-hover:text-fg1">
								{m.previous()}
							</p>
						</button>
						<button
							class={`xy pr-1 group hover:text-fg3 ${evenBg ? 'hover:bg-bg6' : 'hover:bg-bg7'}`}
							onclick={() => changeVersion(Math.min(lastVersion!, version! + 1))}
						>
							<IconCaretRight class="w-5.5" />
							<p class="text-fg2 group-hover:text-fg1">
								{m.next()}
							</p>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/snippet}
<div
	bind:this={container}
	class={`flex ${evenBg ? 'bg-bg1' : 'bg-bg2'} ${p.isEmbed ? 'border-l-2 border-hl1 pl-2' : ''}`}
>
	{#if !p.cited && !p.isEmbed}
		<button
			class={`w-5 fy bg-inherit text-fg2 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
			onclick={() => {
				let distanceFromTop = container.getBoundingClientRect().top;
				let willBeOpen = !open;
				let headerHeight = page.url.pathname === '/merged-view' ? 64 : 32;
				if (!willBeOpen && distanceFromTop < headerHeight)
					window.scrollBy({
						top: distanceFromTop - headerHeight,
						behavior: 'instant',
					});
				open = willBeOpen;
			}}
		>
			<div class={`bg-inherit z-10 h-8 w-5 xy sticky ${tallPostFeedHeader ? 'top-16' : 'top-8'}`}>
				{#if open}
					<!-- TODO: color -/+ with author's identicon color? -->
					<IconMinus stroke={2.5} class="w-4" />
				{:else}
					<IconPlus stroke={2.5} class="w-4" />
				{/if}
			</div>
		</button>
	{/if}
	<div class={`flex-1 ${p.cited || p.isEmbed ? 'max-w-full' : 'max-w-[calc(100%-20px)]'}`}>
		<div
			class={`z-10 ${evenBg ? 'bg-bg1' : 'bg-bg2'} ${
				p.cited
					? ''
					: `sticky ${
							hasAtPostHeader
								? tallPostFeedHeader
									? 'top-8'
									: 'top-0' //
								: tallPostFeedHeader
									? 'top-16'
									: 'top-8'
						}`
			}`}
		>
			{#if open && !p.nested && !p.cited && atPost}
				<div
					class={`relative h-8 flex group text-sm border-l-2 border-fg2 ${evenBg ? 'bg-bg2' : 'bg-bg1'}`}
				>
					<div class="flex-1 flex h-full text-nowrap overflow-scroll">
						<a
							href={`/__${atPost.by_ms}`}
							class={`pl-2 pr-1 fx text-fg2 hover:text-fg1 ${evenBg ? 'hover:bg-bg5' : 'hover:bg-bg4'} ${msToAccountItalic(atPost.by_ms)}`}
						>
							{msToAccountNameTxt(atPost.by_ms)}
						</a>
						<a
							href={`/${getIdStr(atPost)}`}
							class={`flex-1 fx ${atPostDeleted || !atPostTxt ? 'text-fg2 italic' : 'text-fg1 hover:text-fg3'} ${evenBg ? 'hover:bg-bg5' : 'hover:bg-bg4'}`}
						>
							{atPostTxt || m.blank()}
						</a>
					</div>
					{#if !p.isEmbed}
						<button
							class={`px-2 xy text-fg2 pointer-fine:hidden group-hover:flex hover:text-fg1 ${evenBg ? 'hover:bg-bg5' : 'hover:bg-bg4'}`}
							onmousedown={(e) => e.preventDefault()}
							onclick={() => onCite(atPost)}
						>
							<IconLibraryPlus class="w-4 mr-1" />
							{m.cite()}
						</button>
					{/if}
					{#if canPost}
						<button
							class={`px-2 fx text-fg2 text-nowrap pointer-fine:hidden group-hover:flex hover:text-fg1 ${evenBg ? 'hover:bg-bg5' : 'hover:bg-bg4'}`}
							onclick={() => {
								resetBottomOverlay('wt');
								gs.writingReplyTo =
									gs.writingReplyTo && getIdStr(gs.writingReplyTo) === atPostIdStr ? null : atPost;
							}}
						>
							<IconMessage2Plus class="w-4.5 mr-1" />
							{m.replyC({ c: '' + atPost.childCount })}
						</button>
					{/if}
					{#if canReact && 0}
						<!-- TODO: react to atPostHeaders -->
						{@render reactionInput()}
					{/if}
					{#if gs.devMode}
						<p class="max-w-18 truncate self-center text-fg2">{atPostIdStr}</p>
					{/if}
					<Highlight {evenBg} postIdStr={atPostIdStr} class="-left-0.5" />
				</div>
			{/if}
			<div
				class={`flex bg-inherit text-sm text-nowrap font-bold text-fg2 h-8 w-full overflow-x-scroll overflow-y-hidden`}
			>
				{#if p.post.pending}
					<div class="fx">{m.pending()}</div>
				{:else}
					<a
						{target}
						href={`/${postIdStr}`}
						class={`px-1 fx hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
						title={isoMsLabel}
						onclick={(e) => {
							if (
								!e.metaKey &&
								!e.shiftKey &&
								!e.ctrlKey //
							) {
								if (postIdStr === page.params.idSlug) return e.preventDefault();
								if (page.params.spaceSlug) gs.lastScrollY = window.scrollY;
								let getRootIdStr = (idStr: string) => {
									let rootPostIdStr = idStr;
									while (hasParent(gs.idToPostMap[rootPostIdStr]!))
										rootPostIdStr = getAtIdStr(gs.idToPostMap[rootPostIdStr]!);
									return rootPostIdStr;
								};
								if (
									page.params.idSlug &&
									getRootIdStr(postIdStr) === getRootIdStr(page.params.idSlug)
								) {
									// TODO: don't load again if nest is already loaded. Same for clicking on posts in nested view
									// e.preventDefault();
								}
							}
						}}
					>
						{msLabel}
					</a>
				{/if}
				<a
					{target}
					href={`/__${p.post.by_ms}`}
					class={`px-1 fx text-fg1 hover:text-fg3 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'} ${msToAccountItalic(p.post.by_ms)}`}
				>
					{#if authorRole?.num === roleCodes.admin}
						<IconCrownFilled class="w-4" />
					{:else if authorRole?.num === roleCodes.mod}
						<IconShieldFilled class="w-4" />
					{/if}
					<AccountIcon ms={p.post.by_ms} class="mx-0.5 shrink-0 w-4" />
					<p class="pr-1">
						{msToAccountNameTxt(p.post.by_ms)}
					</p>
				</a>
				{#if p.post.in_ms !== urlInMs}
					<a
						{target}
						href={`/${p.post.in_ms}__`}
						class={`fx hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'} ${msToSpaceItalic(p.post.in_ms)}`}
					>
						<SpaceIcon ms={p.post.in_ms} class="mx-0.5 shrink-0 w-4" />
						<p class="pr-0.5">
							{msToSpaceNameTxt(p.post.in_ms)}
						</p>
					</a>
				{/if}
				{#if !p.post.pending}
					{#if !p.isEmbed}
						<button
							class={`fx px-1 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
							onmousedown={(e) => e.preventDefault()}
							onclick={() => onCite(p.post)}
						>
							<IconLibraryPlus stroke={2.5} class="w-4 mr-1" />
							{m.cite()}
						</button>
						{#if canPost}
							<button
								class={`fx px-1 flex-1 text-nowrap  hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
								onclick={() => {
									resetBottomOverlay('wt');
									gs.writingReplyTo =
										gs.writingReplyTo && getIdStr(gs.writingReplyTo) === postIdStr ? null : p.post;
								}}
							>
								<IconMessage2Plus class="w-4.5 mr-1" />
								{m.replyC({ c: '' + p.post.childCount })}
							</button>
						{:else}
							<div class="fx flex-1 text-nowrap">
								<IconMessage2 class="w-4.5 mr-1" />
								{p.post.childCount === 1 ? m.oneReply() : m.nReplies({ n: '' + p.post.childCount })}
							</div>
						{/if}
						{#if canReact}
							{@render reactionInput()}
						{/if}
					{/if}
					{#each rxnEmojiCountEntries as [emoji, count], i}
						<button
							class={`group fx h-8 px-1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'} ${
								p.post.myRxnEmojis?.includes(emoji)
									? 'text-fg1 border-b border-hl1 hover:text-fg3'
									: 'hover:text-fg1'
							}`}
							onclick={async () => {
								await toggleReaction({
									postIdObj,
									emoji,
								});
							}}
						>
							{emoji}
							<p class="ml-1.5 font-bold">
								{count}
							</p>
						</button>
						{#if i === rxnEmojiCountEntries.length - 1}
							<div class="h-8 xy">
								<button
									class={`group xy h-8 w-7 text-fg2 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
									onclick={() => {
										resetBottomOverlay('rh');
										gs.showReactionHistory =
											gs.showReactionHistory && postIdStr === getIdStr(gs.showReactionHistory)
												? null
												: p.post;
									}}
								>
									<IconChartBarPopular stroke={2.5} class="w-3.5" />
								</button>
							</div>
						{/if}
					{/each}
					{#if !p.isEmbed}
						{@render moreOptionsBtn()}
					{/if}
					{#if gs.devMode}
						<p class="self-center text-fg2">{postIdStr}</p>
					{/if}
				{/if}
			</div>
			<!-- TODO: horizontal scroll progress bar for the height of PostBlocks taller than 100vh? What if the PostBlock is nested? Just for 0 depth PostBlocks? vertical scroll progress bar on PostBlocks taller than the page  -->
		</div>
		<div class="relative">
			{#if !open && !p.nested && hasParent(p.post)}
				<Highlight {evenBg} postIdStr={atPostIdStr} />
			{/if}
			<Highlight
				main={!p.cited}
				{postIdStr}
				{evenBg}
				noOverlay={p.cited}
				class={`-top-8 ${p.cited ? '-left-2.5' : `-left-5 w-5`}`}
			/>
			{@render reactionMenu()}
			{@render moreOptionsMenu()}
			{#if open}
				<div class={`${p.cited || p.isEmbed ? '' : 'pb-2'}`}>
					{#if tags.length}
						<div class="flex flex-wrap text-sm">
							{#each tags as tag (tag)}
								<a
									href={`/${p.post.in_ms}__?q=${encodeURIComponent(`[${tag}]`)}`}
									class={`h-6 pb-1 xy whitespace-pre text-fg2 px-1 hover:text-fg1 ${evenBg ? 'hover:bg-bg4' : 'hover:bg-bg5'}`}
								>
									{tag}
								</a>
							{/each}
						</div>
					{/if}
					<div class="px-1">
						{#if core}
							{#if parsed}
								<CoreParser {core} miniCites={p.cited} depth={p.depth} />
							{:else}
								<p class="whitespace-pre-wrap break-all font-thin font-mono leading-4">{core}</p>
							{/if}
						{:else}
							<p class={`text-fg2 font-bold italic`}>
								{loading ? m.loading() : deleted ? m.deleted() : m.blank()}
							</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>
		{#if p.nested && subIds.length}
			<div class={open ? '' : 'hidden'}>
				{#each subIds as id (id)}
					{#if gs.idToPostMap[id]}
						<Self {...p} depth={p.depth + 1} post={gs.idToPostMap[id]} />
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>
