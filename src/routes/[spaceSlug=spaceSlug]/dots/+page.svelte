<script lang="ts">
	import { page } from '$app/state';
	import {
		getCallerIsOwner,
		getCallerIsOwnerOrInGlobal,
		getPromptSigningIn,
		getSpaceContext,
		getWhoWhereObj,
		gs,
		mergeMsToAccountNameTxtMap,
		mergeSpaceMsToAccountMsToMembershipMap,
	} from '$lib/global-state.svelte';
	import { alertError, isStrInt, makeErrorReadable } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { day, formatMs, hour, minute, week } from '$lib/time';
	import { trpc } from '$lib/trpc/client';
	import { updateLocalCache } from '$lib/types/local-cache';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import { getDefaultSpace, roleCodes, type Membership, type Space } from '$lib/types/spaces';
	import { membersPerLoad } from '$lib/types/spaces/_getSpaceDots';
	import {
		IconCheck,
		IconCopy,
		IconLinkMinus,
		IconLinkPlus,
		IconShare2,
	} from '@tabler/icons-svelte';
	import InfiniteLoading, { type InfiniteEvent } from 'svelte-infinite-loading';
	import PromptSignIn from '../../PromptSignIn.svelte';
	import SpaceOrAccountHeader from '../../SpaceOrAccountHeader.svelte';
	import SpinnerOverlay from '../../SpinnerOverlay.svelte';
	import MembershipBlock from './MembershipBlock.svelte';

	// TODO: use a less rounded icon set with the same dx as @tabler/icons-svelte
	// Lucide, Lucide, Phosphor, Remix Icon, idk

	let copiedInviteSlugTimeout: NodeJS.Timeout;
	let validFor = $state(week);
	let maxUsesStr = $state('1');
	let copiedInviteMs = $state(0);
	let loading = $state(false);

	let callerMs = $derived(gs.accounts?.[0].ms);
	let urlInMs = $derived(getUrlInMs()!);
	let identifier = $derived(callerMs + '_' + urlInMs);
	let space = $derived(gs.msToSpaceMap[urlInMs]);
	let spaceContext = $derived(getSpaceContext(urlInMs));
	let callerIsOwner = $derived(getCallerIsOwner());
	let viewable = $derived(callerIsOwner || space?.isPublic.num || spaceContext?.permissionCode);
	let myDots = $derived(gs.accountMsToSpaceMsToDots[callerMs!]?.[urlInMs]);
	let dotsFeed = $derived(gs.spaceMsToDotsFeed[urlInMs]);
	let accountMsToMembershipMap = $derived(gs.spaceMsToAccountMsToMembershipMap[urlInMs]);
	let memberMss = $derived(
		Object.entries(accountMsToMembershipMap || {})
			.filter(([_, m]) => m)
			.sort((a, b) => {
				if (+a[0] === callerMs) return -1;
				if (+b[0] === callerMs) return 1;
				let aRoleCode = a[1]!.roleCode!;
				let bRoleCode = b[1]!.roleCode!;
				return bRoleCode.num === aRoleCode.num
					? bRoleCode.ms! - aRoleCode.ms!
					: bRoleCode.num - aRoleCode.num;
			})
			.map(([k]) => +k),
	);
	// $effect(() => {
	// 	console.log('dots', JSON.stringify(dots, null, 2));
	// });
	let memberships = $derived(
		spaceContext && !myDots?.invites
			? [] // this [] is needed to retrigger on:infinite...
			: (memberMss
					.filter((ms) => accountMsToMembershipMap?.[ms]?.accept)
					.map((ms) => accountMsToMembershipMap![ms]) as Membership[]),
	);

	let loadMoreDots = async (e: InfiniteEvent) => {
		if (
			!viewable || //
			!gs.accounts ||
			urlInMs === undefined ||
			callerMs === undefined
		)
			return;
		if (
			(spaceContext?.roleCode.num === roleCodes.mod ||
				spaceContext?.roleCode.num === roleCodes.admin) &&
			myDots?.invites
		) {
		}
		if (urlInMs < 1 || (myDots && dotsFeed?.endReached)) {
			e.detail.loaded();
			return e.detail.complete();
		}

		let lastMembership = memberships.at(-1);
		let lastAcceptByMssWithSameRoleMs: number[] = [];
		let lastMembershipRole = lastMembership?.roleCode;
		if (lastMembership) {
			lastAcceptByMssWithSameRoleMs = [lastMembership.accept.by_ms!];
			for (let i = memberships.length - 2; i >= 0; i--) {
				let membership = memberships[i];
				let membershipRole = accountMsToMembershipMap?.[membership.accept.by_ms!]?.roleCode!;
				if (
					membershipRole.ms === lastMembershipRole?.ms &&
					!lastAcceptByMssWithSameRoleMs.includes(membership.accept.by_ms!)
				)
					lastAcceptByMssWithSameRoleMs.push(membership.accept.by_ms!);
				else break;
			}
		}
		let excludeMemberMss = [
			...(dotsFeed?.callerMemberMss || []),
			...lastAcceptByMssWithSameRoleMs, //
		];
		try {
			let res = await trpc().getSpaceDots.mutate({
				...(await getWhoWhereObj()),
				memberCount: space?.memberCount,
				description: space?.description,
				newMemberPermissionCode: space?.newMemberPermissionCode,
				getCallerMembership:
					urlInMs > 0 && //
					urlInMs !== callerMs &&
					!gs.accountMsToSpaceMsToDots?.[callerMs]?.[urlInMs],
				msLte: lastMembershipRole?.ms,
				excludeMemberMss: excludeMemberMss,
				lastMemberListRoleCodeNum: lastMembershipRole?.num,
			});
			let { spaceUpdate, invites = [] } = res;
			// console.log('res', JSON.stringify(res, null, 2));
			// console.log('spaceUpdate', JSON.stringify(spaceUpdate, null, 2));

			updateLocalCache((lc) => {
				spaceUpdate &&
					(lc.msToSpaceMap = {
						...lc.msToSpaceMap,
						[spaceUpdate.ms]: spaceUpdate
							? ({
									...getDefaultSpace(),
									...lc.msToSpaceMap[spaceUpdate!.ms]!,
									...spaceUpdate,
									// TODO: why do I need this satisfies for correct type checking?
								} satisfies Space)
							: undefined,
					});
				return lc;
			});

			mergeMsToAccountNameTxtMap(res.msToAccountNameTxtMap);
			mergeSpaceMsToAccountMsToMembershipMap({ [urlInMs]: res.accountMsToMembershipMap ?? {} });

			e.detail.loaded();
			let endReached = Object.keys(res.accountMsToMembershipMap ?? {}).length < membersPerLoad;

			gs.accountMsToSpaceMsToDots = {
				...gs.accountMsToSpaceMsToDots,
				[callerMs]: {
					...gs.accountMsToSpaceMsToDots[callerMs],
					[urlInMs]: { invites },
				},
			};
			gs.spaceMsToDotsFeed = {
				...gs.spaceMsToDotsFeed,
				[urlInMs]: {
					callerMemberMss: [...new Set([callerMs, ...(dotsFeed?.callerMemberMss || [])])],
					endReached,
				},
			};
			endReached && e.detail.complete();
		} catch (error) {
			gs.accountMsToSpaceMsToDots = {
				...gs.accountMsToSpaceMsToDots,
				[callerMs]: {
					...gs.accountMsToSpaceMsToDots[callerMs],
					[urlInMs]: {
						invites: myDots?.invites || [],
						error: makeErrorReadable(error),
					},
				},
			};
		}
	};

	// TODO: member search?
</script>

{#if urlInMs === undefined || callerMs === undefined || !gs.accountMsToSpaceMsToCheckedMap[callerMs]?.[urlInMs]}
	<!--  -->
{:else if getPromptSigningIn()}
	<PromptSignIn />
{:else if !space || !viewable}
	<p class="m-2 text-lg text-fg2 text-center">{m.spaceNotFound()}</p>
{:else}
	<div class="p-2 pb-9 xs:pb-0 w-full max-w-lg">
		<SpaceOrAccountHeader {space} />
		{#if gs.devMode && space.ms && spaceContext}
			<div class="h-0.5 mt-2 w-full bg-bg8"></div>
			<p class="text-xl font-black">{m.yourApiKeys()}</p>
			<a
				target="_blank"
				class="text-fg1 hover:text-fg3 underline decoration-hl1 hover:decoration-hl2"
				href="https://github.com/search?q=repo%3Amileung%2Fmindapp%20TODO&type=code"
			>
				TODO
			</a>
		{/if}
		{#if urlInMs && gs.accounts && urlInMs !== gs.accounts[0].ms}
			{#if spaceContext?.roleCode?.num === roleCodes.mod || spaceContext?.roleCode?.num === roleCodes.admin}
				<div class="h-0.5 mt-2 w-full bg-bg8"></div>
				<p class="text-xl font-black">{m.yourInviteLinks()}</p>
				<div class="flex">
					<div class="flex-1">
						<p class="text-sm font-bold">{m.validFor()}</p>
						<select
							disabled={loading}
							name={m.validFor()}
							class="h-9 font-normal text-lg mt-1 w-full p-2 bg-bg2 hover:bg-bg5 text-fg1"
							bind:value={validFor}
						>
							<option value={0}>{m.forever()}</option>
							<option value={week}>{m.oneWeek()}</option>
							<option value={day}>{m.oneDay()}</option>
							<option value={12 * hour}>{m.twelveHours()}</option>
							<option value={6 * hour}>{m.sixHours()}</option>
							<option value={hour}>{m.oneHour()}</option>
							<option value={30 * minute}>{m.thirtyMinutes()}</option>
							<option value={5 * minute}>{m.fiveMinutes()}</option>
						</select>
					</div>
					<div class="flex-1">
						<div class="fx justify-between">
							<p class="text-sm font-bold">{m.maxUses()}</p>
							<button
								class="text-sm text-fg2 hover:text-fg1"
								type="button"
								onclick={() => (maxUsesStr = m.unlimited())}
							>
								{m.unlimited()}
							</button>
						</div>
						<input
							disabled={loading}
							required
							inputmode="numeric"
							autocomplete="off"
							name={m.maxUses()}
							class="h-9 font-normal text-lg mt-1 w-full p-2 bg-bg2 hover:bg-bg5 text-fg1"
							bind:value={maxUsesStr}
							minlength={1}
							oninput={(e) => {
								let { value } = e.currentTarget;
								if (value === '0' || value.length > 8 || value.startsWith(m.unlimited())) {
									maxUsesStr = m.unlimited();
								} else if (/[^0-9]/.test(value)) {
									maxUsesStr = '1';
								} else {
									let v = value.replace(/[^0-9]/g, '');
									v = v.replace(/^0+/, '');
									maxUsesStr = v;
								}
							}}
						/>
					</div>
				</div>
				{#each myDots?.invites || [] as invite}
					<div class="mt-2">
						<div class="fx">
							<button
								class="flex-1 fx text-fg1 group hover:text-fg3 hover:bg-bg4"
								onclick={() => {
									navigator.clipboard.writeText(
										`${page.url.origin}/invite/${invite.ms}_${invite.slugEnd}`,
									);
									copiedInviteMs = invite.ms;
									clearTimeout(copiedInviteSlugTimeout);
									copiedInviteSlugTimeout = setTimeout(() => {
										if (copiedInviteMs === invite.ms) copiedInviteMs = 0;
									}, 888);
								}}
							>
								{#if copiedInviteMs === invite.ms}
									<IconCheck class="h-4" />
								{:else}
									<IconCopy class="h-4" />
								{/if}
								{m.copy()}
								<p class="ml-1 text-fg2 group-hover:text-fg1">
									{page.url.protocol}//...{invite.slugEnd}
								</p>
							</button>
							<button
								class="fx pr-1 hover:text-fg3 hover:bg-bg4"
								onclick={() =>
									navigator.share({
										url: `${page.url.origin}/invite/${invite.ms}_${invite.slugEnd}`,
									})}
							>
								<IconShare2 class="h-4" />
								{m.share()}
							</button>
						</div>
						<div class="fx justify-between text-fg2">
							{#if invite.expiryMs}
								<p>{m.expiresD({ d: formatMs(invite.expiryMs, 'min') })}</p>
							{:else}
								<p>{m.neverExpires()}</p>
							{/if}
							{#if invite.maxUses}
								<p>
									{invite.maxUses === 1
										? m.one1UseLeft()
										: m.nmUsesLeft({
												n: invite.maxUses - invite.useCount,
												m: invite.maxUses,
											})}
								</p>
							{:else}
								<p>
									{invite.useCount === 1 ? m.used1Time() : m.usedNTimes({ n: invite.useCount })}
								</p>
							{/if}
						</div>
						<button
							class="fx text-fg2 hover:text-fg1 hover:bg-bg4 w-full"
							onclick={async () => {
								if (confirm('Are you sure you want to revoke this invite link?')) {
									try {
										myDots!.invites = myDots!.invites.filter(
											(i) => i.ms !== invite.ms || i.slugEnd !== invite.slugEnd,
										);
										await trpc().revokeInviteLink.mutate({
											...(await getWhoWhereObj()),
											inviteMs: invite.ms,
											slugEnd: invite.slugEnd,
										});
									} catch (error) {
										console.error(error);
									}
								}
							}}
						>
							<IconLinkMinus class="h-4 " />
							{m.revoke()}
						</button>
					</div>
				{/each}
				<button
					class="relative mt-2 h-8 xy px-2 py-1 bg-bg5 hover:bg-bg7 hover:text-fg3 border-b-2 border-hl1 hover:border-hl2"
					onclick={async (e) => {
						loading = true;
						try {
							e.preventDefault();
							let maxUses = isStrInt(maxUsesStr) ? +maxUsesStr : 0;
							let inviteProps = await trpc().createInviteLink.mutate({
								...(await getWhoWhereObj()),
								validFor,
								maxUses,
							});

							gs.accountMsToSpaceMsToDots = {
								...gs.accountMsToSpaceMsToDots,
								[callerMs]: {
									...gs.accountMsToSpaceMsToDots[callerMs],
									[urlInMs]: {
										...gs.accountMsToSpaceMsToDots[callerMs]![urlInMs],
										invites: [
											...(myDots?.invites || []),
											{
												by_ms: callerMs,
												in_ms: urlInMs,
												...inviteProps,
												useCount: 0,
												maxUses,
											},
										],
									},
								},
							};
						} catch (error) {
							alertError(error);
						} finally {
							loading = false;
						}
					}}
				>
					<IconLinkPlus class="w-5 mr-1" />
					{m.createLink()}
					<SpinnerOverlay on={loading} />
				</button>
			{/if}
			<div class="h-0.5 mt-2 w-full bg-bg8"></div>
			{#if getCallerIsOwnerOrInGlobal()}
				<p class="text-xl font-black">
					{space.memberCount === 1 ? m.oneMember() : m.nMembers({ n: space.memberCount })}
				</p>
				{#each memberships as membership (membership.accept.by_ms)}
					<MembershipBlock {membership} />
				{/each}
			{/if}
		{/if}
		{#if viewable}
			<InfiniteLoading {identifier} spinner="spiral" on:infinite={loadMoreDots}>
				<p slot="error" class="m-2 text-lg text-fg2">{myDots?.error}</p>
				<div slot="noMore" class="h-[calc(100vh-36px)] xs:h-screen">
					<p class="m-2 text-lg text-fg2">{m.theEnd()}</p>
				</div>
			</InfiniteLoading>
		{/if}
	</div>
{/if}
