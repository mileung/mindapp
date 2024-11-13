import { Thought, isThoughtId } from '../utils/ClientThought';
import MentionedThought from './MentionedThought';
import MiniMentionedThought from './MiniMentionedThought';
import { isRecord } from '../utils/js';
import { createMemo, createSignal } from 'solid-js';
import { mentionedThoughts } from '~/utils/state';
import { play, xMark } from 'solid-heroicons/solid-mini';
import { Icon } from 'solid-heroicons';

export default function ContentParser(props: { miniMentions?: boolean; thought: () => Thought }) {
	const { miniMentions, thought } = props;
	const htmlNodes = createMemo(() => {
		let content: undefined | string[] | Record<string, string>;
		try {
			const record = JSON.parse(thought().content || '');
			if (isRecord(record)) content = record;
		} catch (e) {}
		content = content || separateMentions(thought().content || '');
		if (Array.isArray(content)) {
			return content.map((str, i) => {
				str = str.trim();
				if (i % 2) {
					return miniMentions ? (
						<MiniMentionedThought thoughtId={str} />
					) : mentionedThoughts[str] ? (
						<MentionedThought thought={() => mentionedThoughts[str]} />
					) : (
						// Missing mentioned thought
						<p class="break-words">{str}</p>
					);
				}
				// remove the first new line cuz the mentioned thought has block display
				return parseMd(i ? str.replace(/^\n/, '') : str);
			});
		}

		// TODO: Just show json in pretty form. screw styling divs
		const longestKeyLength = Math.max(...Object.keys(content).map((key) => key.length));
		return (
			<div class="">
				{Object.entries(content).map(([key, val]) => {
					return (
						<div class="flex">
							<span class="font-mono font-semibold whitespace-pre">
								{key.padEnd(longestKeyLength, ' ')}
							</span>
							<div class="border-l-2 border-fg2 ml-2 pl-2">
								{isThoughtId(val) ? (
									<MiniMentionedThought thoughtId={val} />
								) : (
									<span class="whitespace-pre-wrap inline font-semibold">{val}</span>
								)}
							</div>
						</div>
					);
				})}
			</div>
		);
	});

	return htmlNodes();
}

function parseMd(text: string) {
	// const assetRegex = /!\[([^\]]*)\]\(([^\)]*)\)/g;
	// const linkRegex = /\[([^\]]*)\]\(([^\)]*)\)/g;
	const uriRegex = /([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(\S+)/g;
	// const assetMatches = text.matchAll(assetRegex);
	// const linkMatches = text.matchAll(linkRegex);
	const uriMatches = text.matchAll(uriRegex);

	type A = { text: string; uri: string };
	type Img = { alt: string; imageUri: string };
	type Video = { alt: string; videoUri: string };
	type Audio = { alt: string; audioUri: string };
	const result: (string | A | Img | Video | Audio)[] = [];

	let start = 0;
	for (const match of uriMatches) {
		result.push(text.substring(start, match.index), { text: match[0], uri: match[0] });
		start = match.index! + match[0].length;
	}
	if (start < text.length) {
		result.push(text.substring(start));
	}

	return result.map((tag, i) => {
		// console.log('tag:', tag);
		if (typeof tag === 'string') {
			return !tag ? null : <p class="whitespace-pre-wrap break-words inline font-medium">{tag}</p>;
		} else if ('uri' in tag) {
			return (
				<>
					<a
						target="_blank"
						href={tag.uri}
						class="font-medium inline break-all transition text-sky-500 text hover:text-sky-600 dark:text-cyan-400 dark:hover:text-cyan-300"
					>
						{tag.text}
					</a>
					<IframePreview uri={tag.uri} />
				</>
			);
		}
	});
}

const ytRegex =
	/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const IframePreview = (props: { uri: string }) => {
	const { uri } = props;
	const [open, openSet] = createSignal(false);
	const iframe = createMemo(() => {
		const videoId = uri.match(ytRegex)?.[1];
		if (videoId) {
			return (
				<iframe
					allowfullscreen
					class="w-full max-h-[80vh] max-w-[calc(80vh*16/9)] aspect-video"
					src={`https://www.youtube.com/embed/${videoId}`}
				/>
			);
		}
	});

	return (
		iframe() && (
			<>
				<button class="h-5 w-5 rounded bg-mg2 xy inline-flex" onClick={() => openSet(!open())}>
					{open() ? (
						<Icon path={xMark} class="absolute h-5 w-5" />
					) : (
						<Icon path={play} class="absolute h-4 w-4" />
					)}
				</button>
				{open() && iframe()}
			</>
		)
	);
};

const thoughtIdsRegex = /(^|\s)\d{9,}_(|[A-HJ-NP-Za-km-z1-9]{9,})_(|[\w:\.-]{3,})($|\s)/g;
function separateMentions(text: string) {
	const matches = text.matchAll(thoughtIdsRegex);
	const result: string[] = [];
	let start = 0;
	for (const match of matches) {
		result.push(text.substring(start, match.index), match[0]);
		start = match.index! + match[0].length;
	}
	if (start < text.length) {
		result.push(text.substring(start));
	}
	return result;
}
