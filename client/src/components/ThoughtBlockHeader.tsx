import { A } from '@solidjs/router';
import { Icon } from 'solid-heroicons';
import {
	arrowTopRightOnSquare,
	cube,
	cubeTransparent,
	fingerPrint,
} from 'solid-heroicons/solid-mini';
import { createMemo, Setter } from 'solid-js';
import { authors, fetchedSpaces } from '~/utils/state';
import { localClientHost } from '../utils/api';
import { getThoughtId, Thought } from '../utils/ClientThought';
import { copyToClipboardAsync } from '../utils/js';
import { formatTimestamp } from '../utils/time';
import DeterministicVisualId from './DeterministicVisualId';

export default function ThoughtBlockHeader(props: {
	onLink?: () => void;
	thought: () => Thought;
	parsed: () => boolean;
	parsedSet: Setter<boolean>;
}) {
	const { thought, parsed, parsedSet } = props;
	const thoughtId = createMemo(() => getThoughtId(thought()));
	const spaceUrl = createMemo(() => {
		const { protocol, host } = new URL(
			`http${thought().spaceHost && !thought().spaceHost!.startsWith('localhost') ? 's' : ''}:${
				thought().spaceHost || localClientHost
			}`,
		);
		const parts = host.split('.').reverse();
		const tld = parts[0];
		const sld = parts[1];
		return `${protocol}//${
			thought().spaceHost && tld && sld ? `${sld}.${tld}` : localClientHost
		}/?q=${thoughtId()}`;
	});
	const time = createMemo(() => formatTimestamp(thought().createDate));

	return (
		<div class="mr-1 fx h-5 text-fg2 max-w-full">
			<A
				// TODO: open links in same tab if same domain and remember the scroll position of last page without refetching data. Once implemented, add the external link icon next to the space button
				target="_blank"
				href={`/?q=${thoughtId()}`}
				class={`${
					time().length > 9 ? 'truncate' : ''
				} text-sm font-bold transition text-fg2 hover:text-fg1 px-1 -ml-1 h-6 xy`}
			>
				{time()}
			</A>
			<A
				target="_blank"
				href={`/?q=@${thought().authorId || ''}`}
				class={`h-6 px-1 truncate fx text-sm font-bold transition text-fg2 hover:text-fg1 ${
					authors[thought().authorId || ''] ? '' : 'italic'
				}`}
			>
				<DeterministicVisualId
					input={thought().authorId}
					class="rounded-full overflow-hidden h-3 w-3 mr-1"
				/>
				<p class="whitespace-nowrap truncate">
					{thought().authorId ? authors[thought().authorId!]?.name || 'No name' : 'Anon'}
				</p>
			</A>
			<a
				target="_blank"
				href={spaceUrl()}
				class={`h-6 px-1 mr-auto truncate fx text-sm font-bold transition text-fg2 hover:text-fg1 ${
					thought().spaceHost ? '' : 'italic'
				}`}
			>
				<DeterministicVisualId
					input={fetchedSpaces[thought().spaceHost || ''] || thought().spaceHost}
					class="rounded-sm overflow-hidden h-3 w-3 mr-1"
				/>
				<p
					class={`whitespace-nowrap truncate ${
						fetchedSpaces[thought().spaceHost || ''] ? '' : 'italic'
					}`}
				>
					{thought().spaceHost
						? fetchedSpaces[thought().spaceHost || '']?.name || thought().spaceHost
						: 'Local'}
				</p>
			</a>
			{props.onLink && (
				<button class="flex-1 min-w-4 h-6 fx hover:text-fg1 transition" onClick={props.onLink}>
					<Icon path={arrowTopRightOnSquare} class="absolute rotate-90 w-5" />
				</button>
			)}
			{/* <button
				class="h-6 px-1 hover:text-fg1 transition"
				// TODO: onClick={() => playTextToSpeechAudio()}
				onClick={() => {
					// Usage example
					textToSpeech('Hello, this is a test of text-to-speech functionality.');
				}}
			>
				<PlayCircleIcon class="h-4 w-4" />
			</button> */}
			{/* <button
				class="h-6 px-1 hover:text-fg1 transition"
				// TODO: onClick={() => Translate()}
				
			>
				<Translate class="h-4 w-4" />
			</button> */}
			<button
				class="h-6 px-1 hover:text-fg1 transition"
				onClick={() => copyToClipboardAsync(`${thoughtId()}`)}
			>
				<Icon path={fingerPrint} class="h-4 w-4" />
			</button>
			<button class="-mr-1 h-6 px-1 hover:text-fg1 transition" onClick={() => parsedSet(!parsed())}>
				{parsed() ? (
					<Icon path={cube} class="h-4 w-4" />
				) : (
					<Icon path={cubeTransparent} class="h-4 w-4" />
				)}
			</button>
		</div>
	);
}

function textToSpeech(text: string) {
	// TODO: Get this to work. Currently I just use macOS' built in text to speech, but not everyone has that.
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
