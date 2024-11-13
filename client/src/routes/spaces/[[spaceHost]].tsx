import { Title } from '@solidjs/meta';
import { A, useNavigate, useParams } from '@solidjs/router';
import { Icon } from 'solid-heroicons';
import { globeAlt } from 'solid-heroicons/solid-mini';
import { createEffect, createMemo } from 'solid-js';
import { Button } from '~/components/Button';
import DeterministicVisualId from '~/components/DeterministicVisualId';
import { LabelVal } from '~/components/LabelVal';
import TextInput from '~/components/TextInput';
import { buildUrl, hostedLocally, localApiHost } from '~/utils/api';
import { clone } from '~/utils/js';
import { sendMessage } from '~/utils/signing';
import {
	drawerOpen,
	drawerOpenSet,
	fetchedSpaces,
	fetchedSpacesSet,
	personas,
	personasSet,
	retryJoiningHostSet,
	useActiveSpace,
} from '~/utils/state';
import { formatTimestamp } from '~/utils/time';
import { createTitle } from '..';
import Drawer from '~/components/Drawer';
import { check } from 'solid-heroicons/solid-mini';

export default function ManageSpaces() {
	let hostIpt: undefined | HTMLInputElement;
	const spaceHost = createMemo(() => useParams().spaceHost);
	createTitle(() => spaceHost() || 'Spaces');
	const navigate = useNavigate();
	const fetchedSpace = createMemo(() =>
		spaceHost() ? fetchedSpaces[spaceHost()] || { host: spaceHost() } : undefined,
	);
	createEffect(() => {
		if (spaceHost() && !personas[0].spaceHosts.includes(spaceHost())) {
			navigate('/spaces');
		}
	});

	const joinSpace = () => {
		const newSpaceHost = hostIpt?.value.trim().toLowerCase();
		if (
			!newSpaceHost ||
			newSpaceHost === localApiHost ||
			personas[0].spaceHosts.find((h) => h == newSpaceHost)
		) {
			return alert('Host already added');
		}
		personasSet((old) => {
			old[0].spaceHosts.unshift(newSpaceHost);
			return clone(old);
		});
		setTimeout(() => navigate(`/spaces/${newSpaceHost}`), 0);
	};

	const SpaceList = () => {
		return (
			<div class="flex-1 relative w-52">
				<div class="sticky top-12 h-full sm:p-3 flex flex-col max-h-[calc(100vh-3rem)] overflow-scroll">
					<div class="overflow-scroll border-b border-mg1 mb-1">
						{personas[0].spaceHosts
							.filter((h) => !!h && h !== localApiHost)
							.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
							.map((host) => {
								return (
									<A
										href={`/spaces/${host}`}
										class={`rounded h-14 fx transition hover:bg-mg1 pl-2 py-1 ${
											host === spaceHost() ? 'bg-mg1' : ''
										}`}
										onClick={() => drawerOpenSet(false)}
									>
										<DeterministicVisualId
											input={fetchedSpaces[host] || { host }}
											class="h-6 w-6 overflow-hidden rounded"
										/>
										<div class="flex-1 mx-2 truncate">
											<p
												class={`text-lg font-semibold leading-5 truncate ${
													!fetchedSpaces[host]?.name && 'text-fg2'
												}`}
											>
												{fetchedSpaces[host]?.fetchedSelf
													? fetchedSpaces[host]?.name || 'No name'
													: '...'}
											</p>
											<p class="font-mono text-fg2 leading-5 truncate">{host}</p>
										</div>
										<div class="ml-auto mr-1 xy w-5">
											{useActiveSpace().host === personas[0].spaceHosts[0] && (
												<Icon path={check} class="h-5 w-5" />
											)}
										</div>
									</A>
								);
							})}
					</div>
					<A
						href={'/spaces'}
						class={`rounded h-10 fx transition hover:bg-mg1 px-2 py-1 ${!spaceHost() && 'bg-mg1'}`}
						onClick={() => drawerOpenSet(false)}
					>
						<div class="h-6 w-6 xy">
							{/* <div class="h-4 w-4 rounded-sm bg-fg1" /> */}
							<Icon path={globeAlt} class="h-6 w-6" />
						</div>
						<p class="ml-1.5 text-lg font-semibold">Join space</p>
					</A>
				</div>
			</div>
		);
	};

	return (
		<div class="flex">
			<Title>Spaces | Mindapp</Title>
			<Drawer
				width="w-52"
				hideWidth="sm:hidden"
				isOpen={drawerOpen}
				onClose={() => drawerOpenSet(false)}
			>
				<div>
					<SpaceList />
				</div>
			</Drawer>
			<div class="hidden sm:block">
				<SpaceList />
			</div>
			<div class="flex-1 space-y-3 p-3">
				{fetchedSpace() ? (
					!fetchedSpace()?.fetchedSelf ? (
						<div class="space-y-2">
							<p class="text-2xl font-semibold">Unable to join {fetchedSpace()!.host}</p>
							<Button label="Try again" onClick={() => retryJoiningHostSet(spaceHost())} />
							<Button
								label="Remove space"
								onClick={() => {
									navigate(`/spaces/${spaceHost()}`);
									personasSet((old) => {
										old[0].spaceHosts = old[0].spaceHosts.filter((sh) => sh !== spaceHost());
										return clone(old);
									});
									// // @ts-ignore
									// fetchedSpacesSet(spaceHost(), undefined);
									// console.log('spaceHost():', spaceHost());
									fetchedSpacesSet((old) => {
										delete old[spaceHost()];
										return old;
									});
								}}
							/>
						</div>
					) : (
						<>
							<div class="flex gap-3">
								<DeterministicVisualId
									input={fetchedSpace()}
									class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg"
								/>
								<div>
									<p class={`leading-7 font-bold text-2xl ${!fetchedSpace()?.name && 'text-fg2'} `}>
										{/* {fetchedSpace()?.name || 'No name'} */}
										{fetchedSpace()?.fetchedSelf! ? fetchedSpace()!.name || 'No name' : '...'}
									</p>
									<p class="text-lg text-fg2 font-semibold break-all">{spaceHost()}</p>
								</div>
							</div>
							<p class="text-2xl font-semibold">Space info</p>
							{/* <LabelVal label="Downvote address" value={fetchedSpace()?.downvoteAddress} /> */}
							<div class="">
								<p class="text-xl font-semibold text-fg2">Owner</p>
								<NameTag id={fetchedSpace()?.owner?.id} name={fetchedSpace()?.owner?.name} />
							</div>
							<div class="">
								<p class="text-2xl font-semibold">Self info</p>
								<NameTag
									id={fetchedSpace()?.fetchedSelf?.id}
									name={fetchedSpace()?.fetchedSelf?.name}
								/>
							</div>
							{fetchedSpace()?.fetchedSelf && fetchedSpace()?.fetchedSelf?.id && (
								<>
									<LabelVal
										label="Add date"
										value={formatTimestamp(fetchedSpace()?.fetchedSelf!.addDate!, false)}
									/>
									{/* {fetchedSpace()?.fetchedSelf.addedBy?.id && (
											<div class="">
												<p class="text-xl font-semibold text-fg2">Added by</p>
												<NameTag
													id={fetchedSpace()?.fetchedSelf.addedBy?.id}
													name={fetchedSpace()?.fetchedSelf.addedBy?.name}
												/>
											</div>
										)} */}
									<LabelVal
										label="Frozen"
										value={fetchedSpace()!.fetchedSelf!.frozen ? 'True' : 'False'}
									/>
									<LabelVal
										label="Wallet address"
										value={fetchedSpace()!.fetchedSelf!.walletAddress}
									/>
								</>
							)}
							<p class="text-2xl font-semibold mb-1">Danger zone</p>
							<Button
								label="Leave space"
								onClick={async () => {
									if (personas[0].id) {
										await sendMessage({
											from: personas[0].id,
											to: buildUrl({ host: spaceHost(), path: 'leave-space' }),
										});
									}
									personasSet((old) => {
										old[0].spaceHosts = old[0].spaceHosts.filter((sh) => sh !== spaceHost());
										return clone(old);
									});
									fetchedSpacesSet((old) => {
										return { ...old, [spaceHost()]: undefined };
									});
									navigate('/spaces');
								}}
							/>
						</>
					)
				) : (
					!spaceHost() && (
						<>
							<div class="">
								<p class="font-bold text-2xl">Join a global space</p>
								<p class="font-semibold text-xl text-fg2">
									Plug into different communities and expand your horizons
								</p>
							</div>
							{personas[0].frozen ? (
								<p class="font-semibold text-fg2 text-xl">Persona frozen</p>
							) : (
								<>
									<TextInput
										required
										autofocus
										showCheckX={false}
										defaultValue={hostedLocally ? 'localhost:8080' : ''}
										ref={(t) => (hostIpt = t)}
										label="Host"
										onSubmit={joinSpace}
									/>
									<Button label="Join space" onClick={joinSpace} />
									<A
										target="_blank"
										class="inline-block font-semibold leading-4 text-fg2 transition hover:text-fg1"
										href="TODO"
									>
										Create a new space
									</A>
								</>
							)}
						</>
					)
				)}
			</div>
		</div>
	);
}

function NameTag(props: { id?: string; name?: string }) {
	return props.id === '' ? (
		<p class="text-xl text-fg2 font-semibold leading-5">Anon</p>
	) : (
		<div class="flex gap-3 mt-1">
			<DeterministicVisualId
				input={props.id}
				class="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full"
			/>
			<div>
				<p class={`leading-5 font-bold text-xl ${!props.name && 'text-fg2'} `}>
					{props.name || 'No name'}
				</p>
				<p class="text-lg text-fg2 font-semibold break-all">{props.id}</p>
			</div>
		</div>
	);
}
