import { A } from '@solidjs/router';
import { AccountBlockBlock } from '@vite/vitejs/es5';
import { Icon } from 'solid-heroicons';
import {
	arrowTopRightOnSquare,
	chevronDoubleDown,
	chevronDoubleUp,
	ellipsisHorizontal,
	minus,
	pencil,
	plus,
	trash,
	xMark,
} from 'solid-heroicons/solid-mini';
import { createEffect, createMemo, createSignal, For, JSX } from 'solid-js';
import { buildUrl, hostedLocally, makeUrl, ping, post } from '~/utils/api';
import { getThoughtId, Thought } from '~/utils/ClientThought';
import { clone, isStringifiedRecord, makeReadable } from '~/utils/js';
import { getSignature, sendMessage } from '~/utils/signing';
import { useActiveSpace, authors, personas } from '~/utils/state';
import { minute, second } from '../utils/time';
import ContentParser from './ContentParser';
import ThoughtBlockHeader from './ThoughtBlockHeader';
import { ThoughtWriter } from './ThoughtWriter';
import Voters from './Voters';

export default function ThoughtBlock(props: {
	thought: () => Thought;
	roots: (null | Thought)[];
	onRootsChange: (newRoots: (null | Thought)[]) => void;
	onNewRoot?: () => void;
	rootsIndices: number[];
	depth?: number;
	initiallyLinking?: boolean;
	highlightedId?: string;
}) {
	const {
		thought,
		roots,
		onRootsChange,
		onNewRoot = () => {},
		rootsIndices,
		depth = 0,
		initiallyLinking,
		highlightedId,
	} = props;
	const [moreOptionsOpen, moreOptionsOpenSet] = createSignal(false);
	const [editing, editingSet] = createSignal(false);
	const [open, openSet] = createSignal(true);
	const [linking, linkingSet] = createSignal(!!initiallyLinking);
	const [parsed, parsedSet] = createSignal(true);
	const [showVoters, showVotersSet] = createSignal(false);
	const personaId = createMemo(() => personas[0].id);
	const walletAddress = createMemo(() => personas[0].walletAddress);
	const thoughtId = createMemo(() => getThoughtId(thought()));
	const highlighted = createMemo(() => highlightedId === thoughtId());
	let linkingThoughtId = '';
	let linkingDiv: undefined | HTMLDivElement;
	let xBtn: undefined | HTMLButtonElement;
	let trashBtn: undefined | HTMLButtonElement;
	let pencilBtn: undefined | HTMLButtonElement;
	let votesBtn: undefined | HTMLButtonElement;
	let votesDv: undefined | HTMLDivElement;
	let voteTimer: ReturnType<typeof setTimeout>;
	const [upvoted, upvotedSet] = createSignal<undefined | boolean>(thought().votes?.own);
	let currentVote: undefined | boolean = thought().votes?.own;
	const voteCount = createMemo(() => {
		const votes = { up: thought().votes?.up || 0, down: thought().votes?.down || 0 };
		if (upvoted() !== undefined) upvoted() ? votes.up++ : votes.down++;
		if (thought().votes?.own !== undefined) {
			thought().votes?.own ? votes.up-- : votes.down--;
		}
		return votes;
	});
	const onShowMoreBlur = () => {
		// TODO: This doesn't work in Safari
		// setTimeout(() => {
		// 	if (![xBtn, trashBtn, pencilBtn].find((e) => e === document.activeElement)) {
		// 		moreOptionsOpenSet(false);
		// 	}
		// }, 0);
	};
	const onShowVotersBlur = () => {
		setTimeout(() => {
			if (![xBtn, votesBtn, votesDv].find((e) => e === document.activeElement)) {
				showVotersSet(false);
			}
		}, 0);
	};

	const debouncedSwitchVote = async (up?: true) => {
		if (!useActiveSpace().host) return alert('Cannot vote in local space');
		if (!personaId) return alert('Anon cannot vote');
		if (useActiveSpace().host !== thought().spaceHost) {
			return alert('Cannot vote on thoughts created outside of the current space');
		}
		if (useActiveSpace().host !== thought().spaceHost) {
			return alert('Cannot vote on thoughts created outside of the current space');
		}
		if (!useActiveSpace().deletableVotes && currentVote !== undefined) {
			// return alert('Votes are finalized 3 seconds after submitting');
			return alert('Votes cannot be undone');
		}
		clearTimeout(voteTimer);
		let newVote: undefined | boolean;
		if (up) {
			newVote = upvoted() === true ? undefined : true;
		} else {
			newVote = upvoted() === false ? undefined : false;
		}
		upvotedSet(newVote);
		voteTimer = setTimeout(async () => {
			if (newVote === currentVote) return;
			const lastVote = currentVote;
			currentVote = newVote;
			if (newVote === undefined) {
				return sendMessage({
					from: personaId(),
					to: buildUrl({ host: useActiveSpace().host, path: 'delete-vote' }),
					thoughtId: thoughtId(),
				});
			}
			const [createDate, authorId, spaceHost] = thoughtId().split('_', 3);
			const unsignedVote: UnsignedVote = {
				thoughtCreateDate: +createDate,
				thoughtAuthorId: authorId,
				thoughtSpaceHost: spaceHost,
				up: newVote,
				voterId: personaId(),
				voteDate: Date.now(),
			};
			// TODO: If the user has no tokens in their wallet, do a weak vote.
			// Else do a strong vote
			// Weak votes are free to make and have 1 chevron colored
			// Strong votes are backed by 1 $VIBE and have 2 chevrons colored
			if (useActiveSpace().tokenId) {
				if (!walletAddress) return alert('Persona missing walletAddress');
				const toAddress = newVote
					? authors[thought().authorId || '']?.walletAddress
					: useActiveSpace().downvoteAddress;
				if (!toAddress) {
					return newVote
						? alert('author missing walletAddress')
						: alert('space missing downvoteAddress');
				}
				try {
					// const privateKey = getMnemonic(personas[0].id);
					// const block = await tokenNetwork.sendToken(
					// 	walletAddress(),
					// 	privateKey,
					// 	toAddress,
					// 	useActiveSpace().tokenId,
					// 	'1',
					// );
					// unsignedVote.txHash = block.hash;
				} catch (error) {
					upvotedSet(lastVote);
					currentVote = lastVote;
					return alert(makeReadable(error));
				}
			}
			const signedVote: SignedVote = {
				...unsignedVote,
				signature: (await getSignature(unsignedVote, unsignedVote.voterId))!,
			};
			sendMessage({
				from: personaId(),
				to: buildUrl({ host: useActiveSpace().host, path: 'vote-on-thought' }),
				replace: lastVote !== undefined,
				signedVote,
			}).catch((err) => {
				alert(JSON.stringify(err));
				upvotedSet(lastVote);
				currentVote = lastVote;
			});
		}, 0 * second);
	};

	return (
		<Highlight on={highlighted()} depth={depth}>
			<div
				class={`flex rounded ${!depth ? 'shadow max-w-full' : ''} ${
					depth % 2 === 0 ? 'bg-bg2' : 'bg-bg1'
				}`}
			>
				<button
					class="w-5 fy transition rounded text-fg2 hover:text-fg1 hover:bg-mg2"
					onClick={() => openSet(!open())}
				>
					<div class="my-0.5 h-5 xy">
						{open() ? <Icon path={minus} class="w-4" /> : <Icon path={plus} class="w-4" />}
					</div>
				</button>
				<div class="mt-0.5 flex-1 max-w-[calc(100%-1.25rem)]">
					<ThoughtBlockHeader
						thought={thought}
						parsedSet={parsedSet}
						parsed={parsed}
						onLink={
							open()
								? undefined
								: () => {
										openSet(true);
										linkingSet(true);
									}
						}
					/>
					<div class={`z-10 pb-1 pr-1 ${open() ? '' : 'hidden'}`}>
						{editing() ? (
							<div class="mt-1">
								<ThoughtWriter
									editId={thoughtId()}
									parentId={thought().parentId}
									onContentBlur={() => editingSet(false)}
									initialContent={thought().content}
									initialTags={thought().tags}
									onWrite={({ thought }, ctrlKey, altKey) => {
										editingSet(false);
										moreOptionsOpenSet(false);
										ctrlKey && linkingSet(true);
										altKey && onNewRoot(); // TODO: link parent tag
										const newRoots = clone(roots);
										let pointer = newRoots;
										for (let i = 0; i < rootsIndices.length - 1; i++) {
											pointer = pointer[rootsIndices[i]]!.children!;
										}
										const editedThought = pointer[rootsIndices.slice(-1)[0]]!;
										editedThought.content = thought.content;
										editedThought.tags = thought.tags;
										onRootsChange(newRoots);
									}}
								/>
							</div>
						) : (
							<>
								{thought().content ? (
									parsed() ? (
										<ContentParser thought={thought} />
									) : (
										<p class="whitespace-pre-wrap break-all font-thin font-mono">
											{isStringifiedRecord(thought().content)
												? JSON.stringify(JSON.parse(thought().content!), null, 2)
												: thought().content}
										</p>
									)
								) : (
									<p class="font-semibold text-fg2 italic">No content</p>
								)}
								{!!thought().tags?.length && (
									<div class="flex flex-wrap gap-x-2">
										{thought().tags!.map((tag) => (
											<A
												target="_blank"
												href={`/?q=[${encodeURIComponent(tag)}]`}
												class="font-bold leading-5 transition text-fg2 hover:text-fg1"
											>
												{tag}
											</A>
										))}
									</div>
								)}
							</>
						)}
						<div class="z-0 mt-2 flex gap-2 text-fg2 max-w-full justify-between">
							{useActiveSpace().host && (
								<div class="fx h-4 relative">
									<button
										class={`xy -ml-2 h-7 w-7 transition hover:text-orange-500 ${
											upvoted() ? 'text-orange-500' : ''
										}`}
										onClick={() => debouncedSwitchVote(true)}
									>
										<Icon path={chevronDoubleUp} class="w-5" />
									</button>
									<button
										class="fx h-7"
										ref={votesBtn}
										onClick={() => showVotersSet(!showVoters())}
										onBlur={onShowVotersBlur}
										onKeyDown={(e) => e.key === 'Escape' && showVotersSet(false)}
									>
										<p class="leading-4 text-sm font-bold font-mono transition hover:text-fg1">
											{voteCount().up}-{voteCount().down}
										</p>
									</button>
									<button
										class={`xy -mr-2 h-7 w-7 transition hover:text-blue-400 ${
											upvoted() === false ? 'text-blue-400' : ''
										}`}
										onClick={() => debouncedSwitchVote()}
									>
										<Icon path={chevronDoubleDown} class="w-5" />
									</button>
									{showVoters() && (
										<div
											ref={votesDv}
											tabIndex={0}
											onBlur={onShowVotersBlur}
											onKeyDown={(e) => e.key === 'Escape' && showVotersSet(false)}
											class="z-10 absolute top-4 mt-0.5 left-0 w-48 rounded bg-mg1 shadow"
										>
											<div class="fx justify-between pl-1">
												<p class="font-semibold">Voters</p>
												<button
													ref={xBtn}
													class="h-5 w-5 hover:text-fg1 transition"
													onClick={() => showVotersSet(false)}
												>
													<Icon path={xMark} />
												</button>
											</div>
											<Voters thoughtId={thoughtId()} />
										</div>
									)}
								</div>
							)}
							<div class="flex-1 h-4 fx">
								<button
									class="flex-1 min-w-4 h-7 fx hover:text-fg1 transition"
									onClick={() => linkingSet(!linking())}
								>
									<Icon path={arrowTopRightOnSquare} class="absolute rotate-90 w-5" />
								</button>
							</div>
							<div class="fx gap-1 flex-wrap">{/*  */}</div>
							{(!personas[0].spaceHosts[0] ||
								(thought().authorId === personas[0].id &&
									(thought().spaceHost || !!thought().content))) &&
								(moreOptionsOpen() ? (
									<div class="fx gap-2">
										<button
											ref={xBtn}
											class="h-4 w-4 xy hover:text-fg1 transition"
											onClick={() => moreOptionsOpenSet(false)}
											onKeyDown={(e) => e.key === 'Escape' && moreOptionsOpenSet(false)}
											onBlur={onShowMoreBlur}
										>
											<Icon path={xMark} class="absolute h-6 w-6" />
										</button>
										<button
											ref={trashBtn}
											class="h-4 w-4 xy hover:text-fg1 transition"
											onClick={async () => {
												const ok =
													Date.now() - thought().createDate < minute ||
													(!!thought().spaceHost
														? confirm(
																'This thought may have been saved by other users in the space; delete it anyways?',
															)
														: confirm(
																'This thought has already been archived in the Git snapshot history; delete it anyways?',
															));
												if (!ok) return;
												const newRoots = clone(roots);
												let pointer = newRoots;
												for (let i = 0; i < rootsIndices.length - 1; i++) {
													pointer = pointer[rootsIndices[i]]!.children!;
												}
												const deletedThought = pointer[rootsIndices.slice(-1)[0]]!;
												sendMessage<{ softDelete?: true }>({
													from: personas[0]!.id,
													to: buildUrl({ host: useActiveSpace().host, path: 'delete-thought' }),
													thoughtId: thoughtId(),
												})
													.then(({ softDelete }) => {
														if (softDelete) {
															deletedThought.content = '';
															deletedThought.tags = [];
														} else {
															pointer.splice(rootsIndices.slice(-1)[0], 1);
														}
														onRootsChange(newRoots);
													})
													.catch((err) => alert(err));
											}}
											onKeyDown={(e) => e.key === 'Escape' && moreOptionsOpenSet(false)}
											onBlur={onShowMoreBlur}
										>
											<Icon path={trash} class="absolute h-4 w-4" />
										</button>
										<button
											ref={pencilBtn}
											class="h-4 w-4 xy hover:text-fg1 transition"
											onClick={() => editingSet(!editing())}
											onKeyDown={(e) => e.key === 'Escape' && moreOptionsOpenSet(false)}
											onBlur={onShowMoreBlur}
										>
											<Icon path={pencil} class="absolute h-4 w-4" />
										</button>
									</div>
								) : (
									<button
										class="h-4 w-4 xy hover:text-fg1 transition"
										onClick={() => {
											moreOptionsOpenSet(true);
											setTimeout(() => xBtn?.focus(), 0);
										}}
									>
										<Icon path={ellipsisHorizontal} class="absolute h-4 w-5" />
									</button>
								))}
						</div>
						{linking() && (
							<div ref={linkingDiv} class="bg-bg1 p-1 rounded mt-1">
								<ThoughtWriter
									parentId={thoughtId()}
									onContentBlur={() => linkingSet(false)}
									onWrite={({ thought }, ctrlKey, altKey) => {
										altKey ? onNewRoot() : linkingSet(false);
										ctrlKey && (linkingThoughtId = thoughtId());
										const newRoots = clone(roots);
										let pointer = newRoots;
										for (let i = 0; i < rootsIndices.length; i++) {
											if (!pointer[rootsIndices[i]]!.children) {
												pointer[rootsIndices[i]]!.children = [];
											}
											pointer = pointer[rootsIndices[i]]!.children!;
										}
										pointer.unshift(thought);
										onRootsChange(newRoots);
									}}
								/>
							</div>
						)}
						{thought().children && (
							<div class="z-0 mt-1 space-y-1">
								<For each={thought().children}>
									{(childThought, i) =>
										childThought && (
											<ThoughtBlock
												initiallyLinking={linkingThoughtId === getThoughtId(childThought)}
												highlightedId={highlightedId}
												roots={roots}
												onRootsChange={onRootsChange}
												rootsIndices={[...rootsIndices, i()]}
												thought={() => childThought}
												depth={depth + 1}
											/>
										)
									}
								</For>
							</div>
						)}
					</div>
				</div>
			</div>
		</Highlight>
	);
}

function Highlight(props: { depth: number; on: boolean; children: JSX.Element }) {
	const { depth, on, children } = props;
	let scrolledTo = false;
	return on ? (
		<div
			ref={(r) => {
				// !scrolledTo &&
				// 	r &&
				// 	setTimeout(() => {
				// 		const yOffset = -50; // so header doesn't cover thought block
				// 		window.scrollTo({ top: r.getBoundingClientRect().top + window.scrollY + yOffset });
				// 		scrolledTo = true;
				// 	}, 0);
			}}
			class={`${
				!depth && 'shadow max-w-full'
			} rounded bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 p-0.5`}
		>
			{children}
		</div>
	) : (
		<>{children}</>
	);
}
type UnsignedVote = {
	thoughtCreateDate: number;
	thoughtAuthorId: string;
	thoughtSpaceHost: string;
	up: boolean;
	voteDate: number;
	voterId: string;
	txHash?: string;
};

type SignedVote = UnsignedVote & {
	signature: string;
};
