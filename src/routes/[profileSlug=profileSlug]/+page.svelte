<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		getWhoObj,
		gs,
		mergeMsToAccountNameTxtMap,
		msToSpaceNameTxt,
	} from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { trpc } from '$lib/trpc/client';
	import { signOut } from '$lib/types/local-cache';
	import { IconChevronRight, IconLogout2, IconMail } from '@tabler/icons-svelte';
	import { untrack } from 'svelte';
	import SpaceIcon from '../SpaceIcon.svelte';
	import SpaceOrAccountHeader from '../SpaceOrAccountHeader.svelte';

	let caller = $derived(gs.accounts?.[0]);
	let callerMs = $derived(caller?.ms);
	let profileMs = $derived(+page.params.profileSlug!.slice(2));
	let publicProfile = $derived(gs.msToProfileMap[profileMs]);
	let mutualSpaceMsToJoinMsMap = $derived(
		publicProfile?.callerMsToMutualSpaceMsToJoinMsMap?.[callerMs!],
	);
	let mutualSpaceMsAndJoinMsArr = $derived(
		callerMs === undefined || callerMs === profileMs
			? []
			: Object.entries(mutualSpaceMsToJoinMsMap || {}).map(
					([a, b]) => [+a, b], //
				),
	);
	$effect(() => {
		if (callerMs === undefined || mutualSpaceMsToJoinMsMap || publicProfile === null) return;
		untrack(async () => {
			let whoObj = await getWhoObj();
			try {
				if (!profileMs) {
					//
				} else if (profileMs === callerMs) {
					gs.msToProfileMap[profileMs] = {
						...caller!,
						callerMsToMutualSpaceMsToJoinMsMap: {
							...publicProfile?.callerMsToMutualSpaceMsToJoinMsMap,
							[callerMs]: {},
						},
					};
				} else {
					let res = await trpc().getPublicProfile.mutate({
						...whoObj,
						profileMs,
						possibleMutualSpaceMss: Object.values(
							gs.accounts?.[0].msToJoinedSpaceContextMap || {},
						).map((c) => c!.ms),
					});
					// console.log('res:', res);
					if (res.banned) {
						mergeMsToAccountNameTxtMap({ [res.banned.by_ms]: res.banned.bannerNameTxt });
					}
					gs.msToProfileMap[profileMs] = {
						ms: profileMs,
						banned: res.banned,
						email: res.email,
						name: res.name,
						bio: res.bio,
						callerMsToMutualSpaceMsToJoinMsMap: {
							...publicProfile?.callerMsToMutualSpaceMsToJoinMsMap,
							[callerMs!]: res.mutualSpaceMsToJoinMsMap || {},
						},
					};
				}
			} catch (error) {
				gs.msToProfileMap[profileMs] = null;
			}
		});
	});
</script>

<div class="p-2 max-w-lg">
	{#if publicProfile === null}
		<p class="text-xl font-bold">{m.profileNotFound()}</p>
	{:else if publicProfile}
		<SpaceOrAccountHeader account={publicProfile} />
		{#if publicProfile.ms}
			{#if publicProfile.ms === callerMs}
				<div class="h-0.5 mt-2 w-full bg-bg8"></div>
				<p class="text-sm text-fg2">{m.private()}</p>
				<button
					class="px-2 h-9 xy bg-bg4 border-b-2 border-emerald-400 dark:border-emerald-500 hover:bg-bg7 hover:text-fg3 hover:border-emerald-500 dark:hover:border-emerald-400"
					onclick={() => alert(caller?.email?.txt)}
				>
					<IconMail class="w-5 mr-1" />
					{m.showEmail()}
				</button>
				<button
					class="px-2 h-9 xy bg-bg4 border-b-2 border-orange-400 dark:border-orange-500 hover:bg-bg7 hover:text-fg3 hover:border-orange-500 dark:hover:border-orange-400"
					onclick={() => signOut(gs.accounts![0].ms, true)}
				>
					<IconLogout2 class="w-5 mr-1" />
					{m.signOutEverywhere()}
				</button>
				<a
					href="/reset-password"
					onclick={(e) => {
						if (!e.metaKey && !e.metaKey && !e.metaKey) {
							e.preventDefault();
							goto('/reset-password', { state: { prefilledEmail: caller!.email!.txt } });
						}
					}}
					class="inline-flex pl-2 h-9 xy bg-bg4 border-b-2 border-slate-400 dark:border-slate-500 hover:bg-bg7 hover:text-fg3 hover:border-slate-500 dark:hover:border-slate-400"
					>{m.resetPassword()}
					<IconChevronRight class="w-5 ml-1" />
				</a>
			{/if}
			{#if mutualSpaceMsAndJoinMsArr?.length}
				<div class="h-0.5 mt-2 w-full bg-bg8"></div>
				<p class="text-xl font-bold">{m.mutualSpaces()}</p>
				{#each mutualSpaceMsAndJoinMsArr as [spaceMs, joinMs]}
					<a href={`/${spaceMs}__?q=${page.params.profileSlug}`} class="h-9 fx hover:bg-bg3 w-full">
						<SpaceIcon ms={spaceMs} class="h-8 w-8" />
						<p class="ml-2 text-lg font-bold">{msToSpaceNameTxt(spaceMs)}</p>
						<p class="ml-auto">{m.joinedD({ d: formatMs(joinMs, 'day') })}</p>
					</a>
				{/each}
			{:else if profileMs !== callerMs}
				<p class="text-fg2">{@html callerMs ? m.noMutualSpaces() : m.signInToSeeMutualSpaces()}</p>
			{/if}
		{/if}
	{/if}
</div>
