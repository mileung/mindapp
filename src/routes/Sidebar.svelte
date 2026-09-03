<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { gotoIfNeeded, setGlobalCssVariable, textInputFocused } from '$lib/dom';
	import {
		getBottomOverlayShown,
		getCallerIsOwner,
		getSpaceContext,
		getWhoObj,
		gs,
		msToAccountItalic,
		msToAccountNameTxt,
		msToSpaceItalic,
		msToSpaceNameTxt,
		resetBottomOverlay,
	} from '$lib/global-state.svelte';
	import { isIosOrIpadOs, isTouchScreen } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { trpc } from '$lib/trpc/client';
	import { signOut, unsaveAccount, updateLocalCache } from '$lib/types/local-cache';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import { accentCodes } from '$lib/types/spaces';
	import {
		IconArrowMergeBoth,
		IconBook2,
		IconDotsVertical,
		IconLogout,
		IconPuzzle,
		IconSettings,
		IconSquarePlus2,
		IconTags,
		IconUserPlus,
		IconUserSquare,
		IconView360,
		IconX,
	} from '@tabler/icons-svelte';
	import { onMount } from 'svelte';
	import type { LayoutServerData } from './$types';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	let draggingSpaceIndex = $state<null | number>(null);
	let dragStartY: number;
	let draggedSpaceIndexOffset = $state(0);
	let disableClickAfterDrag = $state(false);
	let callerIsOwner = $derived(getCallerIsOwner());
	let showAccountMenu = $state(false);
	let hideExtensionLink = $state(isIosOrIpadOs);
	let showSpaceMenu = $state(false);
	let isEmbed = $derived(page.url.pathname.startsWith('/embed'));

	let highlightLastSeenInMs = $derived(
		(page.params.idSlug || page.params.spaceSlug)?.startsWith(`${gs.lastSeenInMs}_`),
	);
	let caller = $derived(gs.accounts?.[0]);
	let callerMs = $derived(caller?.ms);
	let pageData = $derived(page.data as LayoutServerData);
	let sqlocalOk = $derived(pageData.sqlocalOk);
	let urlInMs = $derived(getUrlInMs());
	let sidebarSpaceMss = $derived<number[]>([
		// local space ms - everything private in OPFS
		...(callerMs !== undefined &&
		urlInMs !== undefined &&
		gs.accountMsToSpaceMsToCheckedMap[callerMs]?.[urlInMs] &&
		urlInMs !== 0 &&
		urlInMs !== callerMs &&
		urlInMs !== 8 &&
		urlInMs !== 1 &&
		!getSpaceContext(urlInMs)
			? [urlInMs]
			: []),
		...(sqlocalOk ? [0] : []),
		// personal space ms placeholder - everything private in cloud
		callerMs || 8,
		// global space ms - everything public in cloud
		1,
		...Object.values(caller?.msToJoinedSpaceContextMap || {})
			.sort((a, b) => b!.sidePriority - a!.sidePriority)
			.map((c) => c!.ms)
			.filter((ms) => ms !== 1),
	]);
	let globalIndex = $derived(sidebarSpaceMss.indexOf(1));
	let indexAfterGlobal = $derived(globalIndex + 1);
	let targetIndex = $derived(
		Math.min(
			sidebarSpaceMss.length - 1,
			Math.max(indexAfterGlobal, (draggingSpaceIndex ?? 0) + draggedSpaceIndexOffset),
		),
	);

	onMount(() => {
		if (isEmbed) return;
		let onKeyDown = (e: KeyboardEvent) => {
			if (
				!textInputFocused() &&
				gs.lastSeenInMs !== undefined &&
				!e.shiftKey &&
				!e.metaKey &&
				!e.altKey &&
				!e.ctrlKey // needed this stuff to stop conflicting with cmd shift d
			) {
				// setTimeout prevents inputting '/' on focus
				e.key === 'a' && (showAccountMenu = !showAccountMenu);
				// TODO: shortcut(s) to switch accounts
				e.key === 'h' && gotoIfNeeded(`/${gs.lastSeenInMs}__`);
				e.key === 'd' && gotoIfNeeded(`/${gs.lastSeenInMs}__/dots`);
				e.key === 't' && gotoIfNeeded(`/${gs.lastSeenInMs}__/tags`);
				e.key === 'p' && gotoIfNeeded(`/__${callerMs}`);
				(e.key === 'u' || e.key === '?') && gotoIfNeeded(`/user-guide`);
				e.key === 's' && gotoIfNeeded(`/settings`);

				// TODO: e.key === 'r' to refresh/empty cache for current page

				if (e.key === 'Escape') {
					if (getBottomOverlayShown()) resetBottomOverlay();
					else if (showAccountMenu || showSpaceMenu) showAccountMenu = showSpaceMenu = false;
					else window.scrollTo({ top: 0 });
				}
			} else if (
				e.metaKey &&
				e.ctrlKey &&
				(e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
				gs.accounts
			) {
				let lastSeenInMsIndex = sidebarSpaceMss.findIndex((ms) => ms === gs.lastSeenInMs);
				let newSpaceMsIndex = lastSeenInMsIndex + (e.key === 'ArrowUp' ? -1 : 1);
				if (newSpaceMsIndex < 0) newSpaceMsIndex = 0;
				if (newSpaceMsIndex >= sidebarSpaceMss.length) newSpaceMsIndex = sidebarSpaceMss.length - 1;
				goto(`/${sidebarSpaceMss[newSpaceMsIndex]}__`, { keepFocus: true });
			}
		};
		let onDrag = (clientY: number) => {
			if (draggingSpaceIndex === null) return;
			let deltaY = clientY - dragStartY;
			setGlobalCssVariable('--y-space-drag', `${deltaY}px`);
			draggedSpaceIndexOffset = Math.round(deltaY / 40);
			if (!disableClickAfterDrag) disableClickAfterDrag = Math.abs(deltaY) > 8;
		};
		let onMouseMove = (e: MouseEvent) => onDrag(e.clientY);
		let onTouchMove = (e: TouchEvent) => {
			e.preventDefault(); // Stops page scrolling
			let touch = e.touches[0];
			onDrag(touch.clientY);
		};
		let onDragEnd = async () => {
			if (
				caller &&
				draggingSpaceIndex !== null &&
				draggingSpaceIndex > globalIndex &&
				draggingSpaceIndex !== targetIndex
			) {
				let draggedSpaceMs = sidebarSpaceMss[draggingSpaceIndex];
				let nextAboveSpaceMs =
					sidebarSpaceMss[targetIndex + (draggedSpaceIndexOffset < 0 ? -1 : 0)];
				let nextBelowSpaceMs = sidebarSpaceMss[targetIndex + (draggedSpaceIndexOffset < 0 ? 0 : 1)];
				let aboveSidePriority = getSpaceContext(nextAboveSpaceMs)?.sidePriority;
				let belowSidePriority = getSpaceContext(nextBelowSpaceMs)?.sidePriority;
				let nextDraggedSpaceSidePriority = 0;
				let spaceMsToSidePriorityMap: Record<string, number> = {};
				if (targetIndex === indexAfterGlobal)
					nextDraggedSpaceSidePriority = (belowSidePriority ?? 0) + 8 ** 8;
				else if (aboveSidePriority === undefined)
					nextDraggedSpaceSidePriority = belowSidePriority! + 8 ** 8;
				else if (belowSidePriority === undefined)
					nextDraggedSpaceSidePriority = aboveSidePriority! - 8 ** 8;
				else nextDraggedSpaceSidePriority = Math.round((aboveSidePriority + belowSidePriority) / 2);
				if (
					nextDraggedSpaceSidePriority === aboveSidePriority ||
					nextDraggedSpaceSidePriority === belowSidePriority
				) {
					let newSidebarSpaceMss = [...sidebarSpaceMss];
					newSidebarSpaceMss.splice(
						targetIndex,
						0,
						newSidebarSpaceMss.splice(draggingSpaceIndex, 1)[0],
					);
					for (let i = indexAfterGlobal; i < newSidebarSpaceMss.length; i++) {
						spaceMsToSidePriorityMap[newSidebarSpaceMss[i]] = (i - indexAfterGlobal) * -(8 ** 8);
					}
				} else spaceMsToSidePriorityMap[draggedSpaceMs] = nextDraggedSpaceSidePriority;
				updateLocalCache((lc) => {
					Object.entries(spaceMsToSidePriorityMap).map(([msStr, sidePriority]) => {
						lc.accounts[0].msToJoinedSpaceContextMap[msStr]!.sidePriority = sidePriority;
					});
					return lc;
				});
				trpc().updateSidePriority.mutate({
					...(await getWhoObj()),
					spaceMsToSidePriorityMap,
				});
			}
			setGlobalCssVariable('--y-space-drag', `0px`);
			draggedSpaceIndexOffset = 0;
			draggingSpaceIndex = null;
		};

		window.addEventListener('keydown', onKeyDown);
		if (!isTouchScreen) {
			// TODO: long press to rearrange sidebar spaces on mobile
			window.addEventListener('mousemove', onMouseMove);
			window.addEventListener('mouseup', onDragEnd);
			window.addEventListener('touchmove', onTouchMove, { passive: false }); // passive: false needed for preventDefault to work
			window.addEventListener('touchend', onDragEnd);
		}
		return () => {
			window.removeEventListener('keydown', onKeyDown);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onDragEnd);
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('touchend', onDragEnd);
		};
	});

	let getSpaceTranslateY = (spaceIndex: number) => {
		if (draggingSpaceIndex !== null) {
			if (spaceIndex === draggingSpaceIndex) return 'z-50';
			if (spaceIndex < indexAfterGlobal || draggingSpaceIndex < indexAfterGlobal) return '';
			let targetIndex = draggingSpaceIndex + draggedSpaceIndexOffset;
			if (
				draggedSpaceIndexOffset < 0 &&
				spaceIndex >= targetIndex &&
				spaceIndex < draggingSpaceIndex
			)
				return 'translate-y-10';
			if (
				draggedSpaceIndexOffset > 0 &&
				spaceIndex <= targetIndex &&
				spaceIndex > draggingSpaceIndex
			)
				return '-translate-y-10';
		}
		return '';
	};
	let getAccentBg = (spaceMs: number) => {
		let { accentCode } = caller?.msToJoinedSpaceContextMap[spaceMs] || {};
		if (page.route.id !== '/[spaceSlug=spaceSlug]' || urlInMs !== spaceMs) {
			if (accentCode === accentCodes.newPostsForCaller) return 'bg-yellow-300';
			if (accentCode === accentCodes.newPosts) return 'bg-fg2';
		}
		return '';
	};
</script>

<!-- TODO: remember PostDrop states (open, parsed, etc) when switching spaces -->

<aside class="z-50 xs:z-0 bottom-0 fixed w-screen xs:h-screen xs:w-[var(--w-sidebar)] bg-bg2">
	<!-- <div
		class="hidden xs:block z-50 absolute right-0 h-screen cursor-col-resize w-0.5 hover:w-4"
		onmousedown={() => {
			// TODO: resizable sidebar. Might be better to just make the whole sidebar draggable.
			// If dragging on button or a tag, disable so it doesn't fire on moue up
			// Or just make the Search Icon draggable? IconGripHorizontal on hover an no text input?
		}}
	></div> -->
	<div class="h-full flex flex-col-reverse xs:flex-col">
		<div class="flex h-9">
			<button
				class="w-9 xs:w-full xy text-fg1 hover:text-fg3 hover:bg-bg5"
				onclick={() => {
					// onmousedown={(e) => showSuggestedTags && e.preventDefault()}
					// 	if (showSuggestedTags) searchVal = '';
					// 	else {
					showSpaceMenu = false;
					showAccountMenu = !showAccountMenu;
					// }
				}}
			>
				{#if showAccountMenu}
					<!-- {#if showAccountMenu || showSuggestedTags} -->
					<IconX class="h-6 w-6" />
				{:else if callerMs !== undefined}
					<div class="w-9 xy">
						<AccountIcon isUser ms={callerMs} class="h-6 w-6" />
					</div>
					<div class="hidden xs:block flex-1 pr-2">
						<p class={`text-left ${msToAccountItalic(callerMs)}`}>
							{msToAccountNameTxt(callerMs)}
						</p>
					</div>
				{/if}
			</button>
			<button
				class="xs:hidden h-9 w-9 xy hover:bg-bg5 text-fg1"
				onclick={() => {
					showAccountMenu = false;
					showSpaceMenu = !showSpaceMenu;
				}}
			>
				{#if showSpaceMenu}
					<IconX class="h-6 w-6" />
				{:else if gs.accounts}
					<SpaceIcon ms={gs.lastSeenInMs!} class="h-6 w-6" />
				{/if}
			</button>
		</div>
		<div
			class={`${showAccountMenu || showSpaceMenu ? '' : 'hidden'} max-h-68 xs:max-h-none relative flex-1 xs:flex flex-col text-nowrap overflow-scroll`}
			onclick={(e) => {
				setTimeout(() => {
					if (!e.metaKey) {
						showAccountMenu = false;
						showSpaceMenu = false;
					}
				}, 0);
			}}
		>
			{#if showAccountMenu}
				<a href="/sign-in" class={`fx shrink-0 h-10 px-2 gap-2 hover:bg-bg5`}>
					<IconUserPlus class="h-6 w-6" />
					{gs.accounts?.length === 1 ? m.signIn() : m.addAccount()}
				</a>
				{#each gs.accounts || [] as a, i (a.ms)}
					<div class={`h-10 max-w-full group flex ${!i ? 'bg-bg5' : ''} hover:bg-bg5`}>
						<button
							class="fx flex-1 overflow-scroll px-2 gap-2"
							onclick={() => {
								if (a.signedIn || !a.ms) {
									gs.identifierToPostFeedMap = {};
									delete gs.accountMsToSpaceMsToCheckedMap[a.ms];
									updateLocalCache((lc) => ({
										...lc,
										accounts: [a, ...lc.accounts.filter((acc) => acc.ms !== a.ms)],
									}));
								} else goto('/sign-in', { state: { prefilledEmail: a.email.txt } });
							}}
						>
							{#if !i}
								<div class="absolute left-0 h-10 w-0.5 bg-hl1"></div>
							{/if}
							<div class="xy h-6 w-6">
								<AccountIcon isUser ms={a.ms} class="h-6 w-6" />
							</div>
							<div
								class={`flex-1 text-nowrap overflow-scroll h-full fx ${msToAccountItalic(a.ms)}`}
							>
								{msToAccountNameTxt(a.ms)}
							</div>
							{#if a.ms && !a.signedIn}
								<p class="group-hover:hidden text-nowrap text-fg2 text-sm">
									{m.signedOut()}
								</p>
							{/if}
						</button>
						{#if a.ms}
							<button
								class={`xy min-w-8 ${0 === i && a.signedIn ? '' : 'pointer-fine:hidden'} group-hover:flex hover:bg-bg7 text-fg2 hover:text-fg1`}
								onclick={(e) => {
									e.stopPropagation();
									(a.signedIn ? signOut : unsaveAccount)(a.ms);
								}}
							>
								{#if a.signedIn}
									<IconLogout class="h-5 w-5" />
									<!-- {m.signOut()} -->
								{:else}
									<IconX class="h-5 w-5" />
									<!-- {m.remove()} -->
								{/if}
							</button>
						{/if}
					</div>
				{/each}
			{:else if gs.accounts}
				<div
					id="mindapp-extension"
					class={`flex text-black font-semibold bg-hl1 hover:bg-hl2 ${hideExtensionLink ? 'hidden' : ''}`}
				>
					<a
						target="_blank"
						href="https://chromewebstore.google.com/detail/mindapp/cjhokcciiimochdgkicpifkkhndegkep?authuser=0&hl=en"
						class="flex-1 overflow-hidden h-12 fx pl-2 gap-2 leading-4.5"
					>
						<IconPuzzle class="shrink-0 w-6" />
						<p class="text-nowrap overflow-scroll">{m.extension()}</p>
					</a>
					<button
						class="xy w-8"
						onclick={(e) => {
							hideExtensionLink = true;
							e.stopPropagation();
						}}
					>
						<IconX class="h-5" />
					</button>
				</div>
				<a
					href="/create-space"
					class={`fx shrink-0 h-10 px-2 gap-2 hover:bg-bg5 ${page.url.pathname === '/create-space' ? 'bg-bg5' : ''}`}
				>
					<IconSquarePlus2 class="shrink-0 w-6" />
					<p class="text-nowrap overflow-scroll">{m.createSpace()}</p>
				</a>
				{#each sidebarSpaceMss as spaceMs, i (spaceMs)}
					<div
						class={`flex group/space hover:bg-bg5 ${
							highlightLastSeenInMs && spaceMs === gs.lastSeenInMs
								? 'bg-bg5' //
								: ''
						} ${getSpaceTranslateY(i)}`}
						style={`${i === draggingSpaceIndex ? 'transform: translateY(var(--y-space-drag));' : ''}`}
						ontouchstart={(e) => {
							draggingSpaceIndex = i;
							dragStartY = e.changedTouches[0].clientY;
						}}
						onmousedown={(e) => {
							e.preventDefault();
							draggingSpaceIndex = i;
							dragStartY = e.clientY;
						}}
					>
						<a
							data-sveltekit-keepfocus
							href={`/${spaceMs}__`}
							class={`pl-2 relative flex-1 fx h-10 gap-2 overflow-hidden active:cursor-grabbing`}
							onclick={(e) => disableClickAfterDrag && e.preventDefault()}
						>
							{#if spaceMs === gs.lastSeenInMs}
								<div
									class={`absolute left-0 h-full w-0.5 ${page.params.idSlug || page.params.spaceSlug ? 'bg-hl1' : 'bg-fg2'}`}
								></div>
							{/if}
							{#if caller?.msToJoinedSpaceContextMap[spaceMs]?.accentCode !== undefined}
								<div class={`absolute left-0 h-full w-0.5 ${getAccentBg(spaceMs)}`}></div>
							{/if}
							<SpaceIcon ms={spaceMs} class="shrink-0 w-6" />
							<p class={`text-nowrap overflow-scroll ${msToSpaceItalic(spaceMs)}`}>
								{msToSpaceNameTxt(spaceMs)}
							</p>
						</a>
						<a
							href={`/${spaceMs}__/tags`}
							class={`xy w-8 group-hover/space:flex hover:bg-bg7 hover:text-fg1 ${spaceMs !== gs.lastSeenInMs ? 'pointer-fine:hidden' : ''} ${page.url.pathname === `/${spaceMs}__/tags` ? 'bg-bg7 text-fg1' : 'text-fg2'} active:cursor-grabbing`}
							onclick={(e) => disableClickAfterDrag && e.preventDefault()}
						>
							<IconTags class="h-5" />
						</a>
						<a
							href={`/${spaceMs}__/dots`}
							class={`xy w-8 group-hover/space:flex hover:bg-bg7 hover:text-fg1 ${spaceMs !== gs.lastSeenInMs ? 'pointer-fine:hidden' : ''} ${page.url.pathname === `/${spaceMs}__/dots` ? 'bg-bg7 text-fg1' : 'text-fg2'} active:cursor-grabbing`}
							onclick={(e) => disableClickAfterDrag && e.preventDefault()}
						>
							<IconDotsVertical class="h-5" />
						</a>
					</div>
				{/each}
				{#if gs.accounts}
					<a
						href="/merged-view"
						class={`fx shrink-0 h-10 px-2 gap-2 hover:bg-bg5 ${page.url.pathname === '/merged-view' ? 'bg-bg5' : ''}`}
					>
						<IconArrowMergeBoth class="shrink-0 w-6" />
						<p class="text-nowrap overflow-scroll">{m.mergedView()}</p>
					</a>
				{/if}
				{#if callerIsOwner}
					<a
						href="/owner-view"
						class={`fx shrink-0 h-10 px-2 gap-2 hover:bg-bg5 ${page.url.pathname === '/owner-view' ? 'bg-bg5' : ''}`}
					>
						<IconView360 class="shrink-0 w-6" />
						<p class="text-nowrap overflow-scroll">{m.ownerView()}</p>
					</a>
				{/if}
			{/if}
			<div class="flex-1" onclick={(e) => e.stopPropagation()}></div>
			<div class={`${showAccountMenu ? '' : 'hidden xs:block'}`}>
				{#if gs.accounts}
					<a
						href={`/__${callerMs}`}
						class={`fx shrink-0 h-10 px-2 gap-2 hover:bg-bg5 ${page.url.pathname === `/__${callerMs}` ? 'bg-bg5' : ''}`}
					>
						<IconUserSquare class="shrink-0 w-6" />
						<p class="text-nowrap overflow-scroll">{m.profile()}</p>
					</a>
				{/if}
				<a
					href="/user-guide"
					class={`fx shrink-0 h-10 px-2 gap-2 hover:bg-bg5 ${page.url.pathname === '/user-guide' ? 'bg-bg5' : ''}`}
				>
					<IconBook2 class="shrink-0 w-6" />
					<p class="text-nowrap overflow-scroll">{m.userGuide()}</p>
				</a>
				<a
					href="/settings"
					class={`fx shrink-0 h-10 px-2 gap-2 hover:bg-bg5 ${page.url.pathname === '/settings' ? 'bg-bg5' : ''}`}
				>
					<IconSettings class="shrink-0 w-6" />
					<p class="text-nowrap overflow-scroll">{m.settings()}</p>
				</a>
			</div>
		</div>
	</div>
</aside>
