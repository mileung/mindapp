<script lang="ts">
	import { page } from '$app/state';
	import { gotoIfNeeded, textInputFocused } from '$lib/dom';
	import {
		getSavedTagsSet,
		getSpacePermissions,
		getSuggestedTags,
		gs,
	} from '$lib/global-state.svelte';
	import { getAlteredSearchParams, isTouchScreen } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { updateSavedTags } from '$lib/types/local-cache';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import { searchGuideArr } from '$lib/types/posts/parseSearchQuery';
	import { IconArrowsMaximize, IconSearch, IconX } from '@tabler/icons-svelte';
	import { onMount } from 'svelte';

	let searchIpt: HTMLInputElement;
	let tagSuggestionsRefs = $state<(undefined | HTMLButtonElement)[]>([]);
	let unsaveTagXRefs = $state<(undefined | HTMLButtonElement)[]>([]);

	let searchVal = $state((() => page.url.searchParams.get('q') ?? '')());
	let trimmedSearchVal = $derived(searchVal.trim());

	let urlInMs = $derived(getUrlInMs());
	let { canPost } = $derived(getSpacePermissions(urlInMs));
	let searchUrl = $derived(
		getAlteredSearchParams(
			{
				flat: null,
				nested: null,
				new: null,
				old: null,
				q: trimmedSearchVal,
			},
			urlInMs ? `/${urlInMs}__` : page.url.pathname,
		),
	);

	let searchGuideExpanded = $state(false);
	let searchIptFocused = $state(false);
	let tagXFocused = $state(false);
	let tagIndex = $state(-1);
	let tagFilter = $derived(
		trimmedSearchVal
			.replace(/\[([^\[\]]+)]!?/g, '')
			.replace(/\s\s+/g, ' ')
			.trim(),
	);
	let savedTagsSet = $derived(getSavedTagsSet());
	let showSuggestedTags = $derived(searchIptFocused && tagFilter);
	let suggestedTags = $derived(showSuggestedTags ? getSuggestedTags(tagFilter, savedTagsSet) : []);

	$effect(() => {
		!savedTagsSet.size && (tagXFocused = false);
	});
	let addTagToSearchInput = (tag: string) => {
		searchVal = `${searchVal
			.replace(/\s\s+/g, ' ')
			.trim()
			.replace(new RegExp(tagFilter + '$'), '')
			.trim()} [${tag}]`.trimStart();
		setTimeout(() => searchIpt!.scrollTo({ left: Number.MAX_SAFE_INTEGER }), 0);
	};

	onMount(() => {
		let handler = (e: KeyboardEvent) => {
			if (!textInputFocused()) {
				e.key === '/' && setTimeout(() => searchIpt.focus(), 0);
			}
		};
		window.addEventListener('keydown', handler);
		return () => {
			window.removeEventListener('keydown', handler);
		};
	});

	let hoveringTopDiv = $state(false);

	$effect(() => {
		if (urlInMs !== undefined && gs.lastSeenInMs !== urlInMs) searchVal = '';
	});
</script>

<div
	class={`bg-bg3 fixed flex flex-col ${searchGuideExpanded ? 'max-h-[80vh]' : 'max-h-38'} ${searchGuideExpanded || (hoveringTopDiv && !isTouchScreen) || searchIptFocused ? '' : 'hidden'} left-0 xs:left-[var(--w-sidebar)] right-0 bottom-9 text-nowrap overflow-scroll`}
	onmouseenter={() => !isTouchScreen && (hoveringTopDiv = true)}
	onmouseleave={() => (hoveringTopDiv = false)}
>
	{#if showSuggestedTags}
		{#each suggestedTags as tag, i (tag)}
			<div
				class={`group/tag fx hover:bg-bg6 ${tagIndex === i ? 'bg-bg6' : ''}`}
				onmousedown={(e) => e.preventDefault()}
			>
				{#if tagIndex === i && !tagXFocused}
					<div class="absolute z-10 h-8 w-0.5 bg-hl1 group-hover/tag:bg-hl2"></div>
				{/if}
				<button
					bind:this={tagSuggestionsRefs[i]}
					class={`h-8 flex-1 text-left px-2 text-lg text-nowrap whitespace-pre overflow-scroll`}
					onclick={() => addTagToSearchInput(tag)}
				>
					{tag}
				</button>
				{#if savedTagsSet.has(tag)}
					<button
						bind:this={unsaveTagXRefs[i]}
						class={`${tagIndex !== i ? 'pointer-fine:hidden' : ''} group-hover/tag:flex xy h-8 w-8 hover:bg-bg7 hover:text-fg1 ${tagXFocused && tagIndex === i ? 'text-fg1 border-2 border-hl1' : 'text-fg2'}`}
						onclick={() => {
							tagXFocused = false;
							updateSavedTags([], [tag]);
						}}
					>
						<IconX class="h-5 w-5" />
					</button>
				{/if}
			</div>
		{/each}
	{:else}
		<div class="px-2 pb-2 text-wrap space-y-2">
			<div class="-mr-2 fx justify-between sticky top-0 bg-bg3">
				<p class="text-lg font-semibold">{m.searchGuide()}</p>
				<button
					class="xy h-8 w-8 hover:bg-bg6"
					onclick={() => {
						if (!(searchGuideExpanded = !searchGuideExpanded)) hoveringTopDiv = false;
					}}
				>
					{#if searchGuideExpanded}
						<IconX class="h-5 w-5" />
					{:else}
						<IconArrowsMaximize class="h-5 w-5" />
					{/if}
				</button>
			</div>
			{#each searchGuideArr as section}
				<p class="font-semibold">{section.title}</p>
				{#each section.syntax as [syntax, explanation]}
					<div class="fx items-start">
						<p class="font-mono text-nowrap min-w-38">{syntax}</p>
						<p class="text-fg2 flex-1 whitespace-break-spaces">
							{explanation}
						</p>
					</div>
				{/each}
				<p class="font-semibold">Examples</p>
				{#each section.examples as [example, explanation]}
					<div class="">
						<p class="font-mono">{example}</p>
						<p class="text-fg2">
							{explanation}
						</p>
					</div>
				{/each}
			{/each}
		</div>
	{/if}
</div>
<div class="flex-1 flex">
	<input
		bind:this={searchIpt}
		bind:value={searchVal}
		enterkeyhint="search"
		class="font-mono h-9 flex-1 pl-2 pr-9 bg-bg3 hover:bg-bg5"
		placeholder={m.search()}
		onfocus={() => {
			searchIptFocused = true;
		}}
		onblur={() => (searchIptFocused = false)}
		oninput={(e) => (tagIndex = -1)}
		onkeydown={(e) => {
			if (e.key === 'Escape') setTimeout(() => searchIpt.blur(), 0);
			if (e.key === 'Enter') {
				let tag = suggestedTags[tagIndex];
				if (tagXFocused) {
					updateSavedTags([], [tag]);
					tagXFocused = false;
				} else if (tag) addTagToSearchInput(tag);
				else if (trimmedSearchVal) {
					e.metaKey ? open(searchUrl, '_blank') : gotoIfNeeded(searchUrl);
				}
			}
			if (e.key === 'Tab' && !tagFilter) return;
			if ((e.key === 'Tab' && e.shiftKey) || e.key === 'ArrowUp') {
				if (e.key === 'Tab' && tagIndex === -1) return;
				e.preventDefault();
				if (e.key === 'Tab') {
					tagXFocused = !tagXFocused;
					if (!tagXFocused) return;
				} else tagXFocused = false;
				let index = Math.max(tagIndex - 1, -1);
				tagSuggestionsRefs[index]?.focus();
				tagIndex = index;
				searchIpt.focus();
			}
			if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'ArrowDown') {
				if (e.key === 'Tab') {
					if (tagIndex === suggestedTags.length - 1) {
						if (savedTagsSet.has(suggestedTags[tagIndex])) {
							if (tagXFocused) return;
						} else return;
					}
				}
				e.preventDefault();
				if (e.key === 'Tab' && !tagXFocused && tagIndex > -1) {
					tagXFocused = true;
				} else {
					tagXFocused = false;
					let index = Math.min(tagIndex + 1, suggestedTags.length - 1);
					tagSuggestionsRefs[index]?.focus();
					tagIndex = index;
				}
				searchIpt.focus();
			}
		}}
	/>
	{#if searchIptFocused}
		{#if trimmedSearchVal}
			<button
				class={`xy -ml-9 w-9 group ${trimmedSearchVal ? 'text-fg1 hover:text-fg3' : 'text-fg2 pointer-events-none'}`}
				onmousedown={(e) => e.preventDefault()}
				onclick={() => (searchVal = '')}
			>
				<div class={`xy ${searchIptFocused ? 'h-8 w-8' : 'h-9 w-9'} group-hover:bg-bg6`}>
					<IconX class="h-6 w-6" />
				</div>
			</button>
		{/if}
	{:else}
		<a
			class={`xy -ml-9 w-9 group ${trimmedSearchVal ? 'text-fg1 hover:text-fg3' : 'text-fg2 pointer-events-none'}`}
			href={searchUrl}
		>
			<div class={`xy ${searchIptFocused ? 'h-8 w-8' : 'h-9 w-9'} group-hover:bg-bg6`}>
				<IconSearch class="h-6 w-6" />
			</div>
		</a>
	{/if}
</div>
{#if searchIptFocused && trimmedSearchVal}
	<a
		href={searchUrl}
		onmousedown={(e) => e.preventDefault()}
		class={`z-50 xy h-9 w-9 text-bg1 bg-fg1 hover:bg-fg3 ${canPost ? '-mr-9' : ''}`}
	>
		<IconSearch class="h-6 w-6" />
	</a>
{/if}
