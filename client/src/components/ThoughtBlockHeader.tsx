import {
	CubeIcon,
	CubeTransparentIcon,
	FingerPrintIcon,
	PlayCircleIcon,
} from '@heroicons/react/16/solid';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Thought, getThoughtId } from '../utils/ClientThought';
import { copyToClipboardAsync } from '../utils/js';
import { useFetchedSpaces, useAuthors, useSavedFileThoughtIds } from '../utils/state';
import { formatTimestamp } from '../utils/time';
import DeterministicVisualId from './DeterministicVisualId';
import { localClientHost } from '../utils/api';

export default function ThoughtBlockHeader({
	thought,
	parsed,
	parsedSet,
}: {
	thought: Thought;
	parsed: boolean;
	parsedSet: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	const [authors] = useAuthors();
	const [fetchedSpaces] = useFetchedSpaces();
	const [savedFileThoughtIds, savedFileThoughtIdsSet] = useSavedFileThoughtIds();
	const thoughtId = useMemo(() => getThoughtId(thought), [thought]);
	const filedSaved = useMemo(
		() => savedFileThoughtIds[thoughtId],
		[savedFileThoughtIds[thoughtId]],
	);
	const spaceUrl = useMemo(() => {
		const { protocol, host } = new URL(
			`http${thought.spaceHost && !thought.spaceHost.startsWith('localhost') ? 's' : ''}:${thought.spaceHost || localClientHost}`,
		);
		const parts = host.split('.').reverse();
		const tld = parts[0];
		const sld = parts[1];
		return `${protocol}//${
			thought.spaceHost && tld && sld ? `${sld}.${tld}` : localClientHost
		}/${thoughtId}`;
	}, [thought]);
	const time = useMemo(() => formatTimestamp(thought.createDate), [thought.createDate]);

	useEffect(() => {
		// OPTIMIZE: Results component could recursively set this
		savedFileThoughtIdsSet((old) => ({
			...old, //
			[thoughtId]: !!thought.filedSaved,
		}));
	}, []);

	return (
		<div className="mr-1 fx h-5 text-fg2 max-w-full">
			<Link
				target="_blank"
				to={`/${thoughtId}`}
				className={`${time.length > 9 ? 'truncate' : ''} text-sm font-bold transition text-fg2 hover:text-fg1 px-1 -ml-1 h-6 xy`}
			>
				{time}
			</Link>
			<Link
				target="_blank"
				to={`/@${thought.authorId || ''}`}
				className={`h-6 px-1 truncate fx text-sm font-bold transition text-fg2 hover:text-fg1 ${authors[thought.authorId || ''] ? '' : 'italic'}`}
			>
				<DeterministicVisualId
					input={thought.authorId}
					className="rounded-full overflow-hidden h-3 w-3 mr-1"
				/>
				<p className="whitespace-nowrap truncate">
					{thought.authorId ? authors[thought.authorId]?.name || 'No name' : 'Anon'}
				</p>
			</Link>
			<a
				target="_blank"
				href={spaceUrl}
				className={`h-6 px-1 mr-auto truncate fx text-sm font-bold transition text-fg2 hover:text-fg1 ${thought.spaceHost ? '' : 'italic'}`}
			>
				<DeterministicVisualId
					input={fetchedSpaces[thought.spaceHost || '']}
					className="rounded-sm overflow-hidden h-3 w-3 mr-1"
				/>
				<p className="whitespace-nowrap truncate">
					{thought.spaceHost ? fetchedSpaces[thought.spaceHost]?.name || 'No name' : 'Local'}
				</p>
			</a>
			{/* <button
				className="h-6 px-1 hover:text-fg1 transition"
				// TODO: onClick={() => playTextToSpeechAudio()}
				onClick={() => {
					// Usage example
					textToSpeech('Hello, this is a test of text-to-speech functionality.');
				}}
			>
				<PlayCircleIcon className="h-4 w-4" />
			</button> */}
			{/* <button
				className="h-6 px-1 hover:text-fg1 transition"
				// TODO: onClick={() => Translate()}
				
			>
				<Translate className="h-4 w-4" />
			</button> */}
			<button
				className="h-6 px-1 hover:text-fg1 transition"
				onClick={() => copyToClipboardAsync(`${thoughtId}`)}
			>
				<FingerPrintIcon className="h-4 w-4" />
			</button>
			<button
				className="-mr-1 h-6 px-1 hover:text-fg1 transition"
				onClick={() => parsedSet(!parsed)}
			>
				{parsed ? <CubeIcon className="h-4 w-4" /> : <CubeTransparentIcon className="h-4 w-4" />}
			</button>
			{/* <button
				className="h-6 px-1 hover:text-fg1 transition"
				onClick={() => {
					savedFileThoughtIdsSet({ ...savedFileThoughtIds, [thoughtId]: !filedSaved });
					ping(
						makeUrl('write-local-file'),
						post({ thought })
					);
				}}
			>
				{filedSaved ? (
					<DocumentCheckIcon className="h-4 w-4" />
				) : (
					<ArrowDownTrayIcon className="h-4 w-4 text-" />
				)}
			</button> */}
		</div>
	);
}

function textToSpeech(text: string) {
	if ('speechSynthesis' in window) {
		const utterance = new SpeechSynthesisUtterance(text);

		utterance.rate = 1;
		utterance.pitch = 1;
		utterance.volume = 1;
		const voices = window.speechSynthesis.getVoices();
		utterance.voice = voices[0]; // Choose a specific voice
		window.speechSynthesis.speak(utterance);
		console.log('utterance:', utterance);
	} else {
		alert('Text-to-speech not supported in this browser.');
	}
}
