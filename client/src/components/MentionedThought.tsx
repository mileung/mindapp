import { A } from '@solidjs/router';
import { Thought } from '../utils/ClientThought';
import ContentParser from './ContentParser';
import ThoughtBlockHeader from './ThoughtBlockHeader';
import { isStringifiedRecord } from '../utils/js';
import { createSignal } from 'solid-js';

export default function MentionedThought(props: { thought: () => Thought }) {
	const { thought } = props;
	const [parsed, parsedSet] = createSignal(true);

	return (
		<div class={`my-1 py-1 px-1.5 border border-mg2 rounded`}>
			<ThoughtBlockHeader thought={thought} parsedSet={parsedSet} parsed={parsed} />
			{thought().content ? (
				parsed() ? (
					<ContentParser miniMentions thought={thought} />
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
						<A href={`/[${tag}]`} class="font-bold leading-5 transition text-fg2 hover:text-fg1">
							{tag}
						</A>
					))}
				</div>
			)}
		</div>
	);
}
