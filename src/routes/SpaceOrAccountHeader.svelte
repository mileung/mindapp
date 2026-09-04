<script lang="ts">
	import {
		assertCallerIsOwnerOrInGlobal,
		getCallerIsOwner,
		getSpaceContext,
		getWhoObj,
		getWhoWhereObj,
		gs,
		msToAccountItalic,
		msToAccountNameTxt,
		msToSpaceItalic,
		msToSpaceNameTxt,
		toggleAccountBan,
	} from '$lib/global-state.svelte';
	import { alertError, deepClone, identikana } from '$lib/js';
	import { m } from '$lib/paraglide/messages';
	import { formatMs } from '$lib/time';
	import { trpc } from '$lib/trpc/client';
	import { type PublicProfile } from '$lib/types/accounts';
	import { updateLocalCache } from '$lib/types/local-cache';
	import { getUrlInMs } from '$lib/types/parts/partIds';
	import { permissionCodes, roleCodes, type Space } from '$lib/types/spaces';
	import {
		IconBan,
		IconDeviceFloppy,
		IconEdit,
		IconPin,
		IconTrash,
		IconUserPlus,
		IconX,
	} from '@tabler/icons-svelte';
	import AccountIcon from './AccountIcon.svelte';
	import SpaceIcon from './SpaceIcon.svelte';

	type Changes = {
		nameTxt?: string;
		bioTxt?: string;
		descriptionTxt?: string;
		pinnedQueryTxt?: string;
		isPublicNum?: number;
		newMemberPermissionCodeNum?: number;
	};

	let p: {
		account?: PublicProfile;
		space?: Space;
	} = $props();
	let currentSettings = $derived({
		isPublicNum: p.space?.isPublic?.num ?? 0,
		nameTxt: (p.space || p.account)?.name?.txt ?? '',
		bioOrDescriptionTxt: p.space?.description?.txt ?? p.account?.bio?.txt ?? '',
		pinnedQueryTxt: p.space?.pinnedQuery?.txt ?? '',
		newMemberPermissionCodeNum: p.space?.newMemberPermissionCode?.num ?? 0,
	});
	let editing = $state(false);
	let draftSettings = $state((() => deepClone(currentSettings))());

	$effect(() => {
		draftSettings = deepClone(currentSettings);
	});

	$effect(() => {
		if (p.space) editing = false;
	});

	let accountOrSpaceMs = $derived(p.account?.ms ?? p.space!.ms);

	let callerMs = $derived(gs.accounts?.[0].ms);
	let spaceContext = $derived(p.space ? getSpaceContext(getUrlInMs()) : undefined);
	let callerIsAdmin = $derived(spaceContext?.roleCode?.num === roleCodes.admin);
	let userCanEdit = $derived.by(() => {
		if (p.space) return callerIsAdmin;
		if (p.account) return callerMs && callerMs === p.account.ms;
		return false;
	});

	let spaceNote = $derived(
		p.space &&
			(gs.lastSeenInMs === gs.accounts?.[0].ms
				? m.personalSpaceNote()
				: gs.lastSeenInMs === 1
					? m.globalSpaceNote()
					: !gs.lastSeenInMs && m.localSpaceNote()),
	);

	let callerIsOwner = $derived(getCallerIsOwner());

	let visibilityAndNewMembersCan = $derived.by(() => {
		if (
			p.space?.ms &&
			p.space?.ms !== callerMs &&
			draftSettings.isPublicNum !== undefined &&
			draftSettings.newMemberPermissionCodeNum !== undefined
		) {
			let visibilityTxt = draftSettings.isPublicNum ? m.public() : m.private();
			let newMemberPermissionTxt = {
				[permissionCodes.viewOnly]: m.newMembersCanOnlyView(),
				[permissionCodes.reactOnly]: m.newMembersCanReact(),
				[permissionCodes.postOnly]: m.newMembersCanPost(),
				[permissionCodes.reactAndPost]: m.newMembersCanReactPost(),
			}[draftSettings.newMemberPermissionCodeNum];
			return `${visibilityTxt} - ${newMemberPermissionTxt}`;
		}
	});
</script>

<div class="w-full max-w-lg">
	<div class="flex justify-between h-10">
		{#if p.account}
			<AccountIcon isUser class="h-10 w-10" ms={accountOrSpaceMs} />
		{:else}
			<SpaceIcon class="h-10 w-10" ms={accountOrSpaceMs} />
		{/if}
		{#if editing}
			<div class="flex h-8">
				<button
					class="w-8 xy hover:bg-bg3 text-fg2 hover:text-fg1"
					onclick={() => {
						draftSettings = { ...currentSettings };
						editing = false;
					}}
				>
					<IconX class="w-5" />
				</button>
				<button
					class="relative xy pl-0.5 pr-1 border-b-2 border-hl1 hover:border-hl2 bg-bg2 hover:bg-bg4 hover:text-fg3"
					onclick={async () => {
						try {
							assertCallerIsOwnerOrInGlobal();
							editing = false;
							let changes: Changes = {};
							if (draftSettings.nameTxt.trim() !== currentSettings.nameTxt)
								changes.nameTxt = draftSettings.nameTxt.trim();
							if (
								draftSettings.bioOrDescriptionTxt.trim() !== currentSettings.bioOrDescriptionTxt
							) {
								if (p.account) changes.bioTxt = draftSettings.bioOrDescriptionTxt.trim();
								else changes.descriptionTxt = draftSettings.bioOrDescriptionTxt.trim();
							}
							if (draftSettings.pinnedQueryTxt !== currentSettings.pinnedQueryTxt)
								changes.pinnedQueryTxt = draftSettings.pinnedQueryTxt.trim();
							if (draftSettings.isPublicNum !== currentSettings.isPublicNum)
								changes.isPublicNum = draftSettings.isPublicNum;
							if (
								draftSettings.newMemberPermissionCodeNum !==
								currentSettings.newMemberPermissionCodeNum
							)
								changes.newMemberPermissionCodeNum = draftSettings.newMemberPermissionCodeNum;
							if (Object.keys(changes).length) {
								let update = (ms: number) =>
									updateLocalCache((lc) => {
										if (p.account) {
											if (changes.nameTxt !== undefined) {
												lc.accounts[0].name = {
													ms,
													txt: changes.nameTxt,
												};
												gs.msToProfileMap[accountOrSpaceMs]!.name = lc.accounts[0].name;
											}
											if (changes.bioTxt !== undefined) {
												lc.accounts[0].bio = {
													ms,
													txt: changes.bioTxt,
												};
												gs.msToProfileMap[accountOrSpaceMs]!.bio = lc.accounts[0].bio;
											}
										}
										if (p.space) {
											if (changes.nameTxt !== undefined) {
												lc.msToSpaceMap[p.space.ms]!.name = { ms, txt: changes.nameTxt };
												gs.msToSpaceMap[accountOrSpaceMs]!.name = lc.msToSpaceMap[p.space.ms]!.name;
											}
											if (changes.descriptionTxt !== undefined) {
												lc.msToSpaceMap[p.space.ms]!.description = {
													ms,
													txt: changes.descriptionTxt,
												};
												gs.msToSpaceMap[accountOrSpaceMs]!.description =
													lc.msToSpaceMap[p.space.ms]!.description;
											}
											if (changes.pinnedQueryTxt !== undefined) {
												lc.msToSpaceMap[p.space.ms]!.pinnedQuery = {
													ms,
													txt: changes.pinnedQueryTxt,
												};
												gs.msToSpaceMap[accountOrSpaceMs]!.pinnedQuery =
													lc.msToSpaceMap[p.space.ms]!.pinnedQuery;
											}
											if (changes.isPublicNum !== undefined) {
												lc.msToSpaceMap[p.space.ms]!.isPublic = { ms, num: changes.isPublicNum };
												gs.msToSpaceMap[accountOrSpaceMs]!.isPublic =
													lc.msToSpaceMap[p.space.ms]!.isPublic;
											}
											if (changes.newMemberPermissionCodeNum !== undefined) {
												lc.msToSpaceMap[p.space.ms]!.newMemberPermissionCode = {
													ms,
													num: changes.newMemberPermissionCodeNum,
												};
												gs.msToSpaceMap[accountOrSpaceMs]!.newMemberPermissionCode =
													lc.msToSpaceMap[p.space.ms]!.newMemberPermissionCode;
											}
										}
										return lc;
									});
								(p.space?.ms || p.account?.ms) && update(Date.now());
								let newMs =
									p.space?.ms || p.account?.ms
										? (p.space
												? await trpc().changeSpaceAttributes.mutate({
														...(await getWhoWhereObj()),
														...changes,
													})
												: await trpc().changeMyAccountAttributes.mutate({
														...(await getWhoObj()),
														...changes,
													})
											).ms
										: 0;
								update(newMs);
							}
						} catch (error) {
							alertError(error);
						}
					}}
				>
					<IconDeviceFloppy class="w-5 mr-1" />
					{m.save()}
				</button>
			</div>
		{:else if userCanEdit}
			<button
				class="h-8 xy pl-0.5 pr-1 hover:bg-bg4 text-fg2 hover:text-fg1"
				onclick={() => (editing = true)}
			>
				<IconEdit class="w-5 mr-1" />
				{m.edit()}
			</button>
		{/if}
	</div>
	{#if p.account?.banned}
		<p class="text-red-500">
			{m.thisAccountWasBannedByNOnD({
				by_ms: p.account.banned.by_ms!,
				n: msToAccountNameTxt(p.account.banned.by_ms!),
				d: formatMs(p.account.banned.ms, 'min'),
			})}
		</p>
	{/if}
	{#if p.account && callerIsOwner && p.account.ms !== callerMs}
		<div class="flex">
			<a
				target="_blank"
				href={`mailto:${p.account!.email!.txt}`}
				class="flex-1 fx hover:text-fg3 hover:bg-bg4"
			>
				{p.account!.email!.txt}
			</a>
			<button
				class="h-8 xy pl-0.5 pr-1 hover:bg-bg4 text-fg2 hover:text-fg1"
				onclick={() => toggleAccountBan(p.account!.ms)}
			>
				{#if p.account?.banned}
					<IconUserPlus class="h-5 w-5" />
				{:else}
					<IconBan class="h-5 w-5" />
				{/if}
				<p class="ml-1">{p.account?.banned ? m.unban() : m.ban()}</p>
			</button>
		</div>
	{/if}
	{#if editing}
		{#if p.space ? p.space.ms > 1 && p.space.ms !== callerMs : true}
			<p class="font-bold">{m.name()}</p>
			<input bind:value={draftSettings.nameTxt} class="w-full px-2 text-lg bg-bg2 hover:bg-bg4" />
		{:else}
			<p class="text-xl font-bold">
				{msToSpaceNameTxt(accountOrSpaceMs)}
			</p>
		{/if}
		<p class="mt-1 font-bold">{p.account ? m.bio() : m.description()}</p>
		<textarea
			bind:value={draftSettings.bioOrDescriptionTxt}
			class="resize-y w-full px-2 py-0.5 text-lg bg-bg2 hover:bg-bg4 block"
		></textarea>
		{#if p.space}
			<p class="font-bold">{m.pinnedQuery()}</p>
			<input
				bind:value={draftSettings.pinnedQueryTxt}
				class="w-full px-2 text-lg bg-bg2 hover:bg-bg4"
			/>
		{/if}
		{#if p.space && p.space.ms && p.space.ms !== callerMs}
			<div class="mt-2 flex">
				<div class="flex-1">
					<p class="text-sm font-bold">{m.visibility()}</p>
					<select
						name={m.visibility()}
						class="h-9 font-normal text-lg mt-1 w-full p-2 bg-bg2 hover:bg-bg4 text-fg1"
						bind:value={draftSettings.isPublicNum}
					>
						<option value={0} disabled={p.space.ms === 1}>{m.private()}</option>
						<option value={1} disabled={p.account?.ms === gs.accounts?.[0].ms}>{m.public()}</option>
					</select>
				</div>
				<div class="flex-1">
					<p class="text-sm font-bold">{m.newMembers()}</p>
					<div class="flex">
						<select
							class="h-9 font-normal text-lg mt-1 w-full p-2 bg-bg2 hover:bg-bg4 text-fg1"
							bind:value={draftSettings.newMemberPermissionCodeNum}
						>
							<option value={permissionCodes.viewOnly}>{m.viewOnly()}</option>
							<option value={permissionCodes.reactOnly}>{m.canReact()}</option>
							<option value={permissionCodes.postOnly}>{m.canPost()}</option>
							<option value={permissionCodes.reactAndPost}>{m.canReactAndPost()}</option>
						</select>
					</div>
				</div>
			</div>
			{#if callerIsAdmin || callerIsOwner}
				<div class="h-0.5 mt-2 w-full bg-bg8"></div>
				<button
					class="relative mt-2 px-2 h-9 xy bg-bg4 border-b-2 border-red-400 dark:border-red-500 hover:bg-bg7 hover:text-fg3 hover:border-red-500 dark:hover:border-red-400"
					onclick={async () => {
						try {
							updateLocalCache((lc) => {
								delete lc.msToSpaceMap[accountOrSpaceMs];
								lc.accounts.forEach((a) => {
									delete a.msToJoinedSpaceContextMap[accountOrSpaceMs];
								});
								return lc;
							});
							await trpc().deleteSpace.mutate(await getWhoWhereObj());
						} catch (error) {
							alertError(error);
						}
					}}
				>
					<IconTrash class="w-5 mr-1" />
					{m.deleteSpace()}
				</button>
			{/if}
		{/if}
	{:else}
		<div class="flex">
			<p
				class={`text-xl font-bold ${(p.account ? msToAccountItalic : msToSpaceItalic)(accountOrSpaceMs)}`}
			>
				{(p.account ? msToAccountNameTxt : msToSpaceNameTxt)(accountOrSpaceMs)}
			</p>
			{#if draftSettings.nameTxt}
				<p class="self-end ml-1 text-fg2">
					{(accountOrSpaceMs > 8
						? identikana
						: p.space //
							? msToSpaceNameTxt
							: msToAccountNameTxt)(accountOrSpaceMs)}
				</p>
			{/if}
		</div>
		<p class="whitespace-pre-wrap">{draftSettings.bioOrDescriptionTxt}</p>
		<div class="flex text-nowrap">
			{#if draftSettings.pinnedQueryTxt}
				<a
					class="flex-1 fx overflow-hidden text-fg1 hover:text-fg3 underline decoration-fg1 hover:bg-bg4 hover:decoration-fg3"
					href={`/${accountOrSpaceMs}__?q=${draftSettings.pinnedQueryTxt}`}
				>
					<IconPin class="shrink-0 w-4 mr-1" />
					<div class="flex-1 overflow-scroll">
						{draftSettings.pinnedQueryTxt}
					</div>
				</a>
			{:else if p.space}
				<p class="flex-1 text-fg2">{m.nothingPinned()}</p>
			{/if}
			{#if accountOrSpaceMs > 1}
				<p class="text-fg2">
					{m.createdD({ d: formatMs(accountOrSpaceMs, 'day') })}
				</p>
			{/if}
		</div>
		{#if visibilityAndNewMembersCan}
			<p class="text-fg2">{visibilityAndNewMembersCan}</p>
		{/if}
		{#if spaceNote}<p class="text-fg2">{spaceNote}</p>{/if}
	{/if}
</div>
