import { A } from '@solidjs/router';
import { Icon } from 'solid-heroicons';
import { chevronDoubleDown, chevronDoubleUp } from 'solid-heroicons/solid-mini';
import { createEffect, createSignal } from 'solid-js';
import { useActiveSpace, authors, personas, authorsSet } from '~/utils/state';
import { Vote } from '../types/Vote';
import DeterministicVisualId from './DeterministicVisualId';
import { sendMessage } from '~/utils/signing';
import { SignedAuthor } from '~/types/Author';
import { buildUrl, localApiHost } from '~/utils/api';

export default function Voters(props: { thoughtId: string }) {
	const { thoughtId } = props;
	const [votes, votesSet] = createSignal<(null | Vote)[]>([]);
	const [oldToNew, oldToNewSet] = createSignal(false);
	let pinging = false;

	const loadMoreVotes = async () => {
		const lastVote = votes().slice(-1)[0];
		if (lastVote === null || !useActiveSpace()) return;
		pinging = true;
		const votesBeyond = lastVote?.voteDate || (oldToNew() ? 0 : Number.MAX_SAFE_INTEGER);
		sendMessage<{
			authors: Record<string, SignedAuthor>;
			votes: Vote[];
		}>({
			from: personas[0].id,
			to: buildUrl({ host: useActiveSpace().host || localApiHost, path: 'get-votes' }),
			thoughtId,
			oldToNew: oldToNew(),
			votesBeyond,
		})
			.then((data) => {
				authorsSet((old) => ({ ...old, ...data.authors }));
				votesSet((old) => {
					const votesPerLoad = 333;
					old.push(...data.votes);
					data.votes.length < votesPerLoad && old.push(null);
					return [...old];
				});
			})
			.catch((err) => console.error(err))
			.finally(() => (pinging = false));
	};

	const handleScroll = () => {
		// TODO: paginate
		let votesLengthLastLoad: number;
		const scrollPosition = window.innerHeight + window.scrollY;
		const documentHeight = document.body.offsetHeight;

		// console.log('scrollPosition:', scrollPosition);
		// if (votes().slice(-1)[0] !== null && scrollPosition >= documentHeight - 100) {
		// 	if (votes().length !== votesLengthLastLoad) {
		// 		votesLengthLastLoad = votes().length;
		// 		loadMoreVotes();
		// 	}
		// }
	};

	createEffect(() => {
		if (!votes().length && !pinging) {
			loadMoreVotes();
		}
	});

	return (
		<div class="space-y-1.5 relative">
			<div class="max-h-60 overflow-scroll" onScroll={handleScroll}>
				{!votes()[0] && (
					<p class="font-semibold mx-1">{votes()[0] === null ? 'None' : 'Loading...'}</p>
				)}
				{votes().map((vote, i) => {
					return (
						vote && (
							<A
								target="_blank"
								href={`/?${new URLSearchParams({ q: `@${vote.voterId || ''}` }).toString()}`}
								class={`fx gap-1 font-bold transition text-fg2 hover:text-fg1 ${
									authors[vote.voterId || ''] ? '' : 'italic'
								}`}
							>
								{vote.up ? (
									<Icon path={chevronDoubleUp} class="text-orange-500 w-5" />
								) : (
									<Icon path={chevronDoubleDown} class="text-blue-400 w-5" />
								)}
								<DeterministicVisualId
									input={vote.voterId}
									class="rounded-full overflow-hidden h-4 w-4 mr-1"
								/>
								<p class="whitespace-nowrap">
									{vote.voterId ? authors[vote.voterId]?.name || 'No name' : 'Anon'}
								</p>
							</A>
						)
					);
				})}
			</div>
		</div>
	);
}
