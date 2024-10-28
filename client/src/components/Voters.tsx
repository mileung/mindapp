import { ChevronDoubleDownIcon, ChevronDoubleUpIcon } from '@heroicons/react/16/solid';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SignedAuthor } from '../types/Author';
import { Vote } from '../types/Vote';
import { buildUrl, localApiHost } from '../utils/api';
import {
	defaultSpaceHost,
	useActiveSpace,
	useAuthors,
	usePersonas,
	useSendMessage,
} from '../utils/state';
import DeterministicVisualId from './DeterministicVisualId';

export default function Voters({ thoughtId }: { thoughtId: string }) {
	const activeSpace = useActiveSpace();
	const sendMessage = useSendMessage();
	const [personas] = usePersonas();
	const [authors, authorsSet] = useAuthors();
	const [votes, votesSet] = useState<(null | Vote)[]>([]);
	const [oldToNew, oldToNewSet] = useState(false);
	const pinging = useRef(false);

	const loadMoreVotes = useCallback(async () => {
		const lastVote = votes.slice(-1)[0];
		if (lastVote === null || !activeSpace) return;
		pinging.current = true;
		const votesBeyond = lastVote?.voteDate || (oldToNew ? 0 : Number.MAX_SAFE_INTEGER);
		sendMessage<{
			authors: Record<string, SignedAuthor>;
			votes: Vote[];
		}>({
			from: personas[0].id,
			to: buildUrl({ host: activeSpace.host || localApiHost, path: 'get-votes' }),
			thoughtId,
			oldToNew,
			votesBeyond,
		})
			.then((data) => {
				// console.log('data:', data);
				authorsSet((old) => ({ ...old, ...data.authors }));
				votesSet((old) => {
					const votesPerLoad = 333;
					old.push(...data.votes);
					data.votes.length < votesPerLoad && old.push(null);
					return [...old];
				});
			})
			.catch((err) => console.error(err))
			.finally(() => (pinging.current = false));
	}, [votes, activeSpace, sendMessage, thoughtId, personas[0], oldToNew]);

	const handleScroll = useCallback(() => {
		// TODO: paginate
		let votesLengthLastLoad: number;
		const scrollPosition = window.innerHeight + window.scrollY;
		const documentHeight = document.body.offsetHeight;

		// console.log('scrollPosition:', scrollPosition);
		// if (votes.slice(-1)[0] !== null && scrollPosition >= documentHeight - 100) {
		// 	if (votes.length !== votesLengthLastLoad) {
		// 		votesLengthLastLoad = votes.length;
		// 		loadMoreVotes();
		// 	}
		// }
	}, [votes, loadMoreVotes]);

	useEffect(() => {
		if (!votes.length && !pinging.current) {
			loadMoreVotes();
		}
	}, [oldToNew, votes, loadMoreVotes]);

	return (
		<div className="space-y-1.5 relative">
			<div className="max-h-60 overflow-scroll" onScroll={handleScroll}>
				{!votes[0] && (
					<p className="font-semibold mx-1">{votes[0] === null ? 'None' : 'Loading...'}</p>
				)}
				{votes.map((vote, i) => {
					return (
						vote && (
							<Link
								key={i}
								target="_blank"
								to={`/search?${new URLSearchParams({ q: `@${vote.voterId || ''}` }).toString()}`}
								className={`fx gap-1 font-bold transition text-fg2 hover:text-fg1 ${authors[vote.voterId || ''] ? '' : 'italic'}`}
							>
								{vote.up ? (
									<ChevronDoubleUpIcon className="text-orange-500 w-5" />
								) : (
									<ChevronDoubleDownIcon className="text-blue-400 w-5" />
								)}
								<DeterministicVisualId
									input={vote.voterId}
									className="rounded-full overflow-hidden h-4 w-4 mr-1"
								/>
								<p className="whitespace-nowrap">
									{vote.voterId ? authors[vote.voterId]?.name || 'No name' : 'Anon'}
								</p>
							</Link>
						)
					);
				})}
			</div>
		</div>
	);
}
