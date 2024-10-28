import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Thought } from '../utils/ClientThought';
import ContentParser from './ContentParser';
import ThoughtBlockHeader from './ThoughtBlockHeader';
import { isStringifiedRecord } from '../utils/js';

export default function MentionedThought({ thought }: { thought: Thought }) {
	const [parsed, parsedSet] = useState(true);

	return (
		<div className={`my-1 py-1 px-1.5 border border-mg2 rounded`}>
			<ThoughtBlockHeader thought={thought} parsedSet={parsedSet} parsed={parsed} />
			{thought.content ? (
				parsed ? (
					<ContentParser miniMentions thought={thought} />
				) : (
					<p className="whitespace-pre-wrap break-all font-thin font-mono">
						{isStringifiedRecord(thought.content)
							? JSON.stringify(JSON.parse(thought.content), null, 2)
							: thought.content}
					</p>
				)
			) : (
				<p className="font-semibold text-fg2 italic">No content</p>
			)}
			{!!thought.tags?.length && (
				<div className="flex flex-wrap gap-x-2">
					{thought.tags.map((tag) => (
						<Link
							key={tag}
							to={`/search?${new URLSearchParams({ q: `[${tag}]` }).toString()}`}
							className="font-bold leading-5 transition text-fg2 hover:text-fg1"
						>
							{tag}
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
