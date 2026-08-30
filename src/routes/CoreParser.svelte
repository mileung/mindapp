<script lang="ts">
	import { gs } from '$lib/global-state.svelte';
	import { m } from '$lib/paraglide/messages';
	import CitedPost from './CitedPost.svelte';
	import CoreWidget from './CoreWidget.svelte';
	import MiniCitedPost from './MiniCitedPost.svelte';

	let p: {
		core: string;
		depth: number;
		miniCites?: boolean;
	} = $props();

	type InlineParagraphNode =
		| { type: 'code'; content: string }
		| { type: 'image'; alt: string; url: string }
		| { type: 'namedLink'; content: string; url: string }
		| { type: 'boldAndItalic'; content: string }
		| { type: 'bold'; content: string }
		| { type: 'italic'; content: string }
		| { type: 'link'; content: string }
		| { type: 'text'; content: string };

	type CoreBlock =
		| { type: 'header'; level: number; content: string }
		| { type: 'codeBlock'; content: string }
		| { type: 'citedPost'; idStr: string }
		| { type: 'paragraph'; nodes: InlineParagraphNode[] };

	let citedPostStartRegex = /^\d+_\d+_\d+/;
	let headerStartRegex = /^(#{1,6}) ([^\n]*)/;
	let bulletStartRegex = /^\* /;
	let imageStartRegex = /^!\[([^\]]*)\]\(([^)\s]+)\)/;
	let namedLinkStartRegex = /^\[([^\]]+)\]\(([^)\s]+)\)/;
	let uriStartRegex = /^(https?:\/\/|file:\/\/|mailto:|tel:|sms:|geo:)\S+/;
	let fullUriRegex = /^(https?:\/\/|file:\/\/|mailto:|tel:|sms:|geo:)\S+$/;

	let isBoundaryChar = (char?: string) => char === undefined || /\s/.test(char);

	let parseCore = (core: string): CoreBlock[] => {
		let blocks: CoreBlock[] = [];
		let paragraphNodes: InlineParagraphNode[] = [];
		let textBuffer = '';
		let atLineStart = true;
		let prevChar = '';
		let i = 0;

		let flushParagraph = () => {
			if (paragraphNodes.length) {
				let firstNode = paragraphNodes[0];
				if (firstNode.type !== 'image') {
					firstNode.content = firstNode.content.trimStart();
				}
				blocks.push({ type: 'paragraph', nodes: paragraphNodes });
				paragraphNodes = [];
			}
		};

		let flushText = () => {
			if (!textBuffer) return;
			paragraphNodes.push({ type: 'text', content: textBuffer });
			textBuffer = '';
		};

		while (i < core.length) {
			let remaining = core.slice(i);
			if (atLineStart) {
				// # Header
				let headerMatch = remaining.match(headerStartRegex);
				if (headerMatch) {
					flushText();
					flushParagraph();
					blocks.push({
						type: 'header',
						level: headerMatch[1].length,
						content: headerMatch[0],
					});
					i += headerMatch[0].length;
					prevChar = headerMatch[0].at(-1)!;
					atLineStart = false;
					continue;
				}

				// * bullet point
				let bulletMatch = remaining.match(bulletStartRegex);
				if (bulletMatch) {
					textBuffer += bulletMatch[0];
					i += bulletMatch[0].length;
					prevChar = bulletMatch[0].at(-1)!;
					atLineStart = false;
					continue;
				}
			}

			// ```code block```
			if (remaining.startsWith('```')) {
				let closeIndex = remaining.indexOf('```', 3);
				if (closeIndex !== -1) {
					flushText();
					flushParagraph();
					let content = remaining.slice(0, closeIndex + 3);
					blocks.push({ type: 'codeBlock', content });
					i += content.length;
					prevChar = content.at(-1)!;
					atLineStart = false;
					continue;
				}
			}

			// `inline code`
			if (remaining[0] === '`') {
				let closeIndex = remaining.indexOf('`', 1);
				if (closeIndex > 1) {
					flushText();
					let content = remaining.slice(0, closeIndex + 1);
					paragraphNodes.push({ type: 'code', content });
					i += content.length;
					prevChar = content.at(-1)!;
					atLineStart = false;
					continue;
				}
			}

			// ![alt](url)
			let imageMatch = remaining.match(imageStartRegex);
			if (imageMatch) {
				flushText();
				paragraphNodes.push({
					type: 'image',
					alt: imageMatch[1],
					url: imageMatch[2],
				});
				i += imageMatch[0].length;
				prevChar = imageMatch[0].at(-1)!;
				atLineStart = false;
				continue;
			}

			// [label](url)
			let namedLinkMatch = remaining.match(namedLinkStartRegex);
			if (namedLinkMatch) {
				flushText();
				paragraphNodes.push({
					type: 'namedLink',
					content: namedLinkMatch[1],
					url: namedLinkMatch[2],
				});
				i += namedLinkMatch[0].length;
				prevChar = namedLinkMatch[0].at(-1)!;
				atLineStart = false;
				continue;
			}

			// 123_456_789
			let citedPostMatch = remaining.match(citedPostStartRegex);
			if (
				citedPostMatch &&
				isBoundaryChar(prevChar || undefined) &&
				isBoundaryChar(core[i + citedPostMatch[0].length])
			) {
				flushText();
				flushParagraph();
				blocks.push({ type: 'citedPost', idStr: citedPostMatch[0] });
				i += citedPostMatch[0].length;
				prevChar = citedPostMatch[0].at(-1)!;
				atLineStart = false;
				continue;
			}

			let parseEmphasis = (
				marker: '*' | '**' | '***',
				type: 'italic' | 'bold' | 'boldAndItalic',
			) => {
				if (!remaining.startsWith(marker)) return false;
				let lineEnd = remaining.indexOf('\n');
				let searchLimit = lineEnd === -1 ? remaining.length : lineEnd;
				let closeIndex = remaining.indexOf(marker, marker.length);
				if (closeIndex === -1 || closeIndex + marker.length > searchLimit) return false;
				flushText();
				let content = remaining.slice(0, closeIndex + marker.length);
				paragraphNodes.push({ type, content });
				i += content.length;
				prevChar = content.at(-1)!;
				atLineStart = false;
				return true;
			};

			if (parseEmphasis('***', 'boldAndItalic')) continue;
			if (parseEmphasis('**', 'bold')) continue;
			if (parseEmphasis('*', 'italic')) continue;

			// scheme://bare-url
			let uriMatch = remaining.match(uriStartRegex);
			if (uriMatch) {
				flushText();
				paragraphNodes.push({ type: 'link', content: uriMatch[0] });
				i += uriMatch[0].length;
				prevChar = uriMatch[0].at(-1)!;
				atLineStart = false;
				continue;
			}

			// Nothing matched: consume 1 plain character
			let char = core[i];
			textBuffer += char;
			prevChar = char;
			atLineStart = char === '\n';
			i++;
		}
		flushText();
		flushParagraph();
		return blocks;
	};

	let blocks = $derived(parseCore(p.core));
	let linkClass =
		'align-top inline-block max-w-[calc(100%-88px)] mini-x-scroll text-fg1 hover:text-fg3 underline decoration-hl1 hover:decoration-hl2';
</script>

{#each blocks as block}
	{#if block.type === 'citedPost'}
		{#if p.miniCites}
			<MiniCitedPost postIdStr={block.idStr} depth={p.depth + 1} />
		{:else if gs.idToPostMap[block.idStr]}
			<CitedPost post={gs.idToPostMap[block.idStr]!} depth={p.depth + 1} />
		{:else}
			<div class="border-l-2 border-bg8 pl-2 bg-bg1 text-sm font-bold text-fg2">
				{(console.warn(m.idNotFound({ id: block.idStr })), m.idNotFound({ id: block.idStr }))}
			</div>
		{/if}
	{:else if block.type === 'header'}
		<p
			class={block.level === 1
				? 'text-2xl font-bold'
				: block.level === 2
					? 'text-xl font-bold'
					: block.level === 3
						? 'text-lg font-bold'
						: 'font-bold'}
		>
			{block.content}
		</p>
	{:else if block.type === 'codeBlock'}
		<pre class="whitespace-pre-wrap break-all font-mono text-sm bg-bg3 p-1">{block.content}</pre>
	{:else if block.type === 'paragraph'}
		<p class="whitespace-pre-wrap break-words">
			{#each block.nodes as node}{#if node.type === 'text'}{node.content}{:else if node.type === 'code'}<code
						class="font-mono text-sm bg-bg3 px-1">{node.content}</code
					>{:else if node.type === 'boldAndItalic'}<strong><em>{node.content}</em></strong
					>{:else if node.type === 'bold'}<strong>{node.content}</strong
					>{:else if node.type === 'italic'}<em>{node.content}</em>{:else if node.type === 'link'}
					<a target="_blank" href={node.content} class={linkClass}>{node.content}</a><CoreWidget
						url={node.content}
					/>{:else if node.type === 'namedLink'}[{#if fullUriRegex.test(node.content)}<a
							target="_blank"
							href={node.content}
							class={linkClass}>{node.content}</a
						>{:else}{node.content}{/if}](<a target="_blank" href={node.url} class={linkClass}
						>{node.url}</a
					>)<CoreWidget url={node.url} />{:else if node.type === 'image'}!({node.alt})[
					<a target="_blank" href={node.url} class={linkClass}>{node.url}</a>]<CoreWidget
						imageUrl={node.url}
						alt={node.alt}
					/>{/if}{/each}
		</p>
	{/if}
{/each}

<!--
Example core exercising every supported syntax, including priority collisions:

# Header
**bold** *italic* `inline code`
Bare url: https://example.com
```
a code block
```
Note the image line: since it's `![id](url)`, the id is consumed as alt text,
not rendered as a citation - image match wins because it's checked first and
consumes the whole `![...](...)` span atomically.
![1783121360715_1783661989272_1782691298888](https://example.com/image.png)
Cited post: 1783121360715_1783661989272_1782691298888
-->
