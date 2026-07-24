<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import { getYtVideoId } from '$lib/dom';
	import { isTouchScreen, supportsCredentiallessIframe } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { IconArrowsMaximize, IconArrowsMinimize } from '@tabler/icons-svelte';
	import type { LayoutServerData } from './$types';
	import CredentiallessIframe from './CredentiallessIframe.svelte';

	// TODO: detect when an embedded YouTube video finishes and play next vid
	// TODO: player controls in sidebar?
	// https://developers.google.com/youtube/iframe_api_reference

	let p: {
		url?: string;
		imageUrl?: string;
		alt?: string;
	} = $props();
	let toggleBtn = $state<HTMLButtonElement>();
	let { imgSrc, iframeSrc, iframeType } = $derived.by(() => {
		if (!supportsCredentiallessIframe && (page.data as LayoutServerData).sqlocalOk) return {};
		if (p.imageUrl) return { imgSrc: p.imageUrl };
		if (!p.url) return {};

		if (/\.(jpg|jpeg|png|webp|avif|gif|svg)(\?.*)?$/i.test(p.url)) return { imgSrc: p.url };
		let urlObj = new URL(p.url);
		let pathnameSlugs = urlObj.pathname.split('/').slice(1);
		let imgSrc = '';
		let iframeSrc = '';
		let iframeType: undefined | 'ig-post' | 'reddit' | 'sc' | 'tt-vid' | 'x-post' | 'yt-vid';
		let tldToSldToScraperMap: Record<string, undefined | Record<string, undefined | (() => void)>> =
			{
				com: {
					instagram: () => {
						if (pathnameSlugs[0] === 'p') {
							iframeSrc = `https://www.instagram.com/p/${pathnameSlugs[1]}/embed/`;
							iframeType = 'ig-post';
						} else if (pathnameSlugs[0] === 'reels') {
						}
					},
					reddit: () => {
						if (pathnameSlugs[0] === 'r') {
							iframeType = 'reddit';
							iframeSrc = `https://rebed.redditmedia.com/embed?url=${encodeURIComponent(p.url!)}`;
						}
					},
					soundcloud: () => {
						if (pathnameSlugs.length === 2) {
							iframeType = 'sc';
							let params = {};
							let query = new URLSearchParams({
								url: p.url!,
								...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
							});
							iframeSrc = `https://w.soundcloud.com/player/?${query.toString()}`;
						}
					},
					tiktok: () => {
						if (pathnameSlugs[1] === 'video') {
							iframeSrc = `https://www.tiktok.com/embed/v2/${pathnameSlugs[2]}`;
							iframeType = 'tt-vid';
						}
					},
					x: () => {
						if (pathnameSlugs[1] === 'status') {
							iframeSrc = `https://platform.twitter.com/embed/Tweet.html?id=${pathnameSlugs[2]}`;
							iframeType = 'x-post';
						}
					},
					youtube: () => {
						let ytVideoId = getYtVideoId(p.url!);
						if (ytVideoId) {
							let ytVidStartTime = p.url!.match(/[?&](?:t|start)=([0-9]+)/)?.[1];
							imgSrc = `https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`;
							iframeSrc = `https://www.youtube.com/embed/${ytVideoId}?start=${ytVidStartTime}`;
							iframeType = 'yt-vid';
						}
					},
				},
			};
		let [tld, sld] = urlObj.hostname.split('.', 3).reverse();
		tldToSldToScraperMap[tld]?.[sld]?.();
		return { imgSrc, iframeSrc, iframeType };
	});

	let noImgWidgetsOpenInDev = false;
	noImgWidgetsOpenInDev = true;
	let open = $state(
		(() =>
			dev
				? imgSrc
					? false //
					: noImgWidgetsOpenInDev
				: iframeSrc
					? !imgSrc
					: false)(),
	);

	let openImg = $state<HTMLImageElement>();
	let openImgStyle = $state('');
	$effect(() => {
		if (isTouchScreen) {
			if (!open) openImgStyle = '';
			else if (!openImgStyle && openImg) {
				openImgStyle = `max-height: ${Math.round(window.innerHeight * 0.8)}px;`;
			}
		}
	});
</script>

{#if imgSrc || iframeSrc}{#if iframeSrc}<button
			bind:this={toggleBtn}
			class="h-6 w-6 bg-bg5 hover:bg-bg7 hover:text-fg3 xy inline-flex translate-y-1"
			onclick={() => (open = !open)}
			onkeydown={(e) => {
				if (e.key === 'Escape' && open) {
					e.stopPropagation();
					open = false;
				}
			}}
			>{#if open}<IconArrowsMinimize class="absolute h-5 w-5" />{:else}<IconArrowsMaximize
					class="absolute h-5 w-5"
				/>{/if}</button
		>{#if open && iframeType}<span
				class={`flex overflow-clip flex-col mr-8 max-h-[64vh] ${
					(
						{
							reddit: isTouchScreen ? 'h-80' : 'min-h-80 max-w-md aspect-[8/7]',
							sc: 'max-w-[80vw]',
							'yt-vid': 'aspect-video',
						} as Record<typeof iframeType, string>
					)[iframeType] || (isTouchScreen ? 'h-80' : 'aspect-[3/4]')
				}`}
				><span
					class={`flex-1 flex flex-col ${
						(
							{
								reddit: '-mt-64',
							} as Record<typeof iframeType, string>
						)[iframeType] || ''
					}`}
					>{#if supportsCredentiallessIframe}<CredentiallessIframe
							allowfullscreen
							class="flex-1"
							src={iframeSrc}
						/>{:else}<iframe allowfullscreen class="flex-1" src={iframeSrc}></iframe>{/if}</span
				></span
			>{/if}{/if}{#if imgSrc}{#if !iframeSrc}<button
				class={`block ${open ? '' : 'hidden'}`}
				onclick={() => (open = false)}
				><img
					bind:this={openImg}
					loading="lazy"
					crossorigin="anonymous"
					src={imgSrc}
					alt={p.alt ?? m.thumbnail()}
					class={`min-h-42 ${openImgStyle ? '' : 'max-h-[80vh]'} bg-bg3 object-contain`}
					style={openImgStyle}
				/></button
			>{/if}<button
			class={`block ${open ? 'hidden' : ''}`}
			onclick={() => {
				open = true;
				toggleBtn?.focus();
			}}
			><img
				loading="lazy"
				crossorigin="anonymous"
				class="h-42 bg-bg3 aspect-video object-cover"
				src={imgSrc}
				alt={p.alt || m.thumbnail()}
			/></button
		>{/if}{/if}
