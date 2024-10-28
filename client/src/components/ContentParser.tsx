import React, { useMemo, useState } from 'react';
import { Thought, isThoughtId } from '../utils/ClientThought';
import MentionedThought from './MentionedThought';
import { PlayIcon, XMarkIcon } from '@heroicons/react/16/solid';
import MiniMentionedThought from './MiniMentionedThought';
import { useMentionedThoughts } from '../utils/state';
import { isRecord } from '../utils/js';

export default function ContentParser({
	miniMentions,
	thought,
}: {
	miniMentions?: boolean;
	thought: Thought;
}) {
	const [mentionedThoughts] = useMentionedThoughts();
	const htmlNodes = useMemo(() => {
		let content: undefined | string[] | Record<string, string>;
		try {
			const record = JSON.parse(thought.content || '');
			if (isRecord(record)) content = record;
		} catch (e) {}
		content = content || separateMentions(thought.content || '');

		if (Array.isArray(content)) {
			return content.map((str, i) => {
				if (i % 2) {
					return miniMentions ? (
						<MiniMentionedThought key={i} thoughtId={str} />
					) : mentionedThoughts[str] ? (
						<MentionedThought key={i} thought={mentionedThoughts[str]} />
					) : (
						// Missing mentioned thought
						<p className="" key={i}>
							{str}
						</p>
					);
				}
				// remove the first new line cuz the mentioned thought has block display
				return parseMd(i ? str.replace(/^\n/, '') : str);
			});
		}

		// TODO: Just show json in pretty form. screw styling divs
		const longestKeyLength = Math.max(...Object.keys(content).map((key) => key.length));
		return (
			<div className="">
				{Object.entries(content).map(([key, val]) => {
					return (
						<div key={key} className="flex">
							<span className="font-mono font-semibold whitespace-pre">
								{key.padEnd(longestKeyLength, ' ')}
							</span>
							<div className="border-l-2 border-fg2 ml-2 pl-2">
								{isThoughtId(val) ? (
									<MiniMentionedThought thoughtId={val} />
								) : (
									<span className="whitespace-pre-wrap inline font-semibold">{val}</span>
								)}
							</div>
						</div>
					);
				})}
			</div>
		);
	}, [thought.content]);

	return htmlNodes;
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
			return !tag ? null : (
				<p key={i} className="whitespace-pre-wrap break-words inline font-medium">
					{tag}
				</p>
			);
		} else if ('uri' in tag) {
			return (
				<React.Fragment key={i}>
					<a
						target="_blank"
						href={tag.uri}
						className="font-medium inline break-all transition text-sky-600 text hover:text-sky-500 dark:text-cyan-400 dark:hover:text-cyan-300"
					>
						{tag.text}
					</a>
					<IframePreview uri={tag.uri} />
				</React.Fragment>
			);
		}
	});
}

const ytRegex =
	/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const IframePreview = ({ uri }: { uri: string }) => {
	const [open, openSet] = useState(false);
	const iframe = useMemo(() => {
		const videoId = uri.match(ytRegex)?.[1];
		if (videoId) {
			return (
				<iframe
					allowFullScreen
					className="w-full max-h-[80vh] max-w-[calc(80vh*16/9)] aspect-video"
					src={`https://www.youtube.com/embed/${videoId}`}
				/>
			);
		}
	}, [uri]);

	return (
		iframe && (
			<>
				<button className="h-5 w-5 rounded bg-mg2 xy inline-flex" onClick={() => openSet(!open)}>
					{open ? (
						<XMarkIcon className="absolute h-5 w-5" />
					) : (
						<PlayIcon className="absolute h-4 w-4" />
					)}
				</button>
				{open && iframe}
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
