<script lang="ts">
	import { page } from '$app/state';
	import { gs } from '$lib/global-state.svelte';
	import { getSystemTheme } from '$lib/theme';
	import { getIdStr, isIdStr } from '$lib/types/parts/partIds';

	let p: {
		postIdStr?: string;
		class?: string;
		noScrollId?: boolean;
		main?: boolean;
		noOverlay?: boolean;
		evenBg?: boolean;
		red?: boolean;
	} = $props();

	let urlId = $derived.by(() => {
		let pathname = page.url.pathname;
		let s = pathname.slice(1);
		let slashIndex = s.indexOf('/');
		if (slashIndex > 0) s = s.slice(0, slashIndex);
		if (isIdStr(s)) return s;
	});
	let spotId = $derived(urlId?.endsWith('__') ? '' : urlId);
	let moreOpaque = $derived(
		p.evenBg ||
			gs.theme === 'light' || //
			(gs.theme === 'system' && getSystemTheme() === 'light'),
	);

	let [lineColor, overlayColor] = $derived.by(() => {
		if (p.red) return ['bg-red-500', moreOpaque ? 'bg-red-500/10' : 'bg-red-500/5'];
		if (!p.postIdStr) return ['bg-hl2', moreOpaque ? 'bg-hl2/10' : 'bg-hl2/5'];
		let post = gs.showReactionHistory || gs.writingReplyTo || gs.writingEditFor;
		if (post && getIdStr(post) === p.postIdStr) {
			return gs.showReactionHistory
				? ['bg-hl-spot', moreOpaque ? 'bg-hl-spot/10' : 'bg-hl-spot/5']
				: gs.writingReplyTo
					? ['bg-hl-link', moreOpaque ? 'bg-hl-link/10' : 'bg-hl-link/5']
					: gs.writingEditFor
						? ['bg-hl-edit', moreOpaque ? 'bg-hl-edit/10' : 'bg-hl-edit/5']
						: [];
		}
		if (spotId === p.postIdStr)
			return ['bg-hl-spot', moreOpaque ? 'bg-hl-spot/10' : 'bg-hl-spot/5'];
		return [];
	});
</script>

{#if lineColor}
	<div
		{...!p.noScrollId && p.main ? { id: 'hl-' + p.postIdStr } : {}}
		class={`${p.main ? '' : 'hl-' + p.postIdStr} z-20 absolute pointer-events-none inset-0 ${p.noOverlay ? '' : overlayColor} ${p.class}`}
	>
		<div class="w-0.5 h-full {lineColor}"></div>
	</div>
{/if}
