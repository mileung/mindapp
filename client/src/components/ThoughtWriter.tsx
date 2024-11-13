import { useLocation, useNavigate, useSearchParams } from '@solidjs/router';
import { matchSorter } from 'match-sorter';
import { Icon } from 'solid-heroicons';
import { plus, userPlus, xCircle } from 'solid-heroicons/solid-mini';
import { createMemo, createSignal } from 'solid-js';
import { SignedAuthor } from '~/types/Author';
import { buildUrl, hostedLocally, localApiHost, makeUrl, ping, post } from '~/utils/api';
import { Thought } from '~/utils/ClientThought';
import { clone, isStringifiedRecord } from '~/utils/js';
import { useKeyPress } from '~/utils/keyboard';
import { getSignature, sendMessage } from '~/utils/signing';
import {
	useActiveSpace,
	authorsSet,
	mentionedThoughtsSet,
	personas,
	fetchedSpacesSet,
	fetchedSpaces,
	useTagTree,
} from '~/utils/state';
import {
	getTagRelations,
	listAllTags,
	sortKeysByNodeCount,
	sortUniArr,
	TagTree,
} from '~/utils/tags';
import TextareaAutoHeight from './TextareaAutoHeight';
import { addPersona } from '~/types/PersonasPolyfill';

export const ThoughtWriter = (props: {
	initialContent?: Thought['content'];
	initialTags?: string[];
	editId?: string;
	parentId?: string;
	onWrite?: (
		res: {
			authors: Record<string, SignedAuthor>;
			mentionedThoughts: Record<string, Thought>;
			thought: Thought;
		},
		ctrlKey: boolean,
		altKey: boolean,
	) => void;
	onContentBlur?: () => void;
}) => {
	const { initialContent, initialTags = [], editId, parentId, onWrite, onContentBlur } = props;
	const [searchParams] = useSearchParams();
	const jsonString = searchParams.json?.toString();
	const jsonParam = createMemo(() =>
		jsonString
			? (JSON.parse(jsonString) as { initialContent: string; initialTags?: string[] })
			: null,
	);
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const [addedTags, addedTagsSet] = createSignal<string[]>([
		...initialTags,
		...(jsonParam()?.initialTags || []),
	]);
	const [tagFilter, tagFilterSet] = createSignal('');
	const [tagIndex, tagIndexSet] = createSignal(0);
	const [suggestTags, suggestTagsSet] = createSignal(false);
	let contentTextArea: undefined | HTMLTextAreaElement;
	let tagStuffDiv: undefined | HTMLDivElement;
	let tagIpt: undefined | HTMLInputElement;
	let tagXs: (null | HTMLButtonElement)[] = [];
	const tagSuggestionsRefs: (null | HTMLButtonElement)[] = [];

	// TODO: For users hosting mindapp locally, indicate wherever tags are displayed which tags overlap between local and global space tags trees, tags that are specific  to the space, and tags specific to the local space

	const trimmedFilter = createMemo(() => tagFilter().trim());
	const allTags = createMemo(() =>
		!suggestTags() ? [] : listAllTags(getTagRelations(useTagTree())),
	);
	const defaultTags = createMemo(() =>
		!suggestTags() ? [] : sortKeysByNodeCount(useTagTree()).reverse(),
	);
	const suggestedTags = createMemo(() => {
		if (!suggestTags()) return [];
		const addedTagsSet = new Set(addedTags());
		if (!trimmedFilter()) return defaultTags().filter((tag) => !addedTagsSet.has(tag));
		const filter = trimmedFilter().replace(/\s+/g, ' ');
		const arr = matchSorter(allTags(), filter).slice(0, 99).concat(trimmedFilter());
		return [...new Set(arr)].filter((tag) => !addedTagsSet.has(tag));
	});

	const defaultValue = createMemo(() => {
		const initialStuff = initialContent || jsonParam()?.initialContent || '';
		return isStringifiedRecord(initialStuff)
			? JSON.stringify(JSON.parse(initialStuff), null, 2)
			: initialStuff;
	});
	const makePersonaOnPost = createMemo(() => useActiveSpace().host && !personas[0].id);

	const addTag = (tagToAdd?: string) => {
		tagToAdd = tagToAdd || suggestedTags()[tagIndex()] || trimmedFilter();
		if (!tagToAdd) return;
		addedTagsSet([...new Set([...addedTags(), tagToAdd])]);
		tagIpt!.focus();
		tagFilterSet('');
		tagIndexSet(-1);
	};

	const writeThought = async (ctrlKey?: boolean, altKey?: boolean) => {
		const content = contentTextArea!.value.trim();
		if (!content) return;
		makePersonaOnPost() && addPersona({ initialSpace: useActiveSpace().host });
		jsonString && navigate(pathname, { replace: true, scroll: false });
		contentTextArea!.style.height = 'auto';
		const additionalTag = ((suggestTags() && suggestedTags()[tagIndex()]) || tagFilter()).trim();
		let [createDate, authorId, spaceHost] = (editId || '').split('_', 3);
		const message = {
			from: editId ? authorId : personas[0].id,
			to: buildUrl({
				host: editId ? spaceHost : useActiveSpace().host,
				path: 'write-thought',
			}),
			thought: {
				parentId: parentId || undefined,
				content,
				tags: (() => {
					const arr = sortUniArr([...addedTags(), additionalTag].filter((a) => !!a));
					return arr.length ? arr : undefined;
				})(),
				...(editId
					? {
							createDate: +createDate,
							authorId: authorId || undefined,
							spaceHost: spaceHost || undefined,
					  }
					: {
							createDate: Date.now(),
							authorId: personas[0].id || undefined,
							spaceHost: useActiveSpace().host || undefined,
					  }),
			} as Omit<Thought, 'children'>,
		};

		if (!message.thought.tags?.length) delete message.thought.tags;
		message.thought.signature = await getSignature(message.thought, message.thought.authorId);
		await sendMessage<{
			authors: Record<string, SignedAuthor>;
			mentionedThoughts: Record<string, Thought>;
			thought: Thought;
		}>(message)
			.then((res) => {
				// console.log('res:', res);
				authorsSet((old) => ({ ...old, ...res.authors }));
				mentionedThoughtsSet((old) => ({ ...old, ...res.mentionedThoughts }));
				onWrite && onWrite(res, !!ctrlKey, !!altKey);
				contentTextArea!.value = '';
				addedTagsSet([]);
				tagFilterSet('');
				suggestTagsSet(false);
				contentTextArea!.focus();
			})
			.catch((err) => alert(err));

		if (hostedLocally) {
			await ping(
				buildUrl({ host: localApiHost, path: 'save-thought' }),
				post({ thought: message.thought }),
			);
			const tagTree = await ping<TagTree>(makeUrl('get-tag-tree'));
			fetchedSpacesSet((old) => {
				old[''] = { host: '', tagTree };
				return clone(old);
			});
		}
	};

	useKeyPress({ key: 'Enter', modifiers: ['Meta', 'Alt', 'Control'] }, (e) => {
		const focusedOnThoughtWriter =
			document.activeElement === contentTextArea ||
			document.activeElement === tagIpt ||
			tagXs.find((e) => e === document.activeElement);
		if (focusedOnThoughtWriter) {
			writeThought(e.ctrlKey, e.altKey);
		}
	});

	useKeyPress({ key: 'ArrowDown' }, (e) => {
		// TODO: move focus to first thought
		// Make the ux similar to using VS Code and Markdown
	});

	return (
		<div class="w-full flex flex-col">
			<TextareaAutoHeight
				// autofocus
				defaultValue={defaultValue()}
				ref={contentTextArea}
				onFocus={(e) => {
					// focuses on the end of the input value when editing
					const tempValue = e.target.value;
					e.target.value = '';
					e.target.value = tempValue;
				}}
				name="content"
				placeholder="New thought"
				class="rounded text-xl font-thin font-mono px-3 py-2 w-full max-w-full resize-y min-h-36 bg-bg2 border-mg1 border"
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						const ok =
							onContentBlur &&
							(contentTextArea!.value === defaultValue() ||
								confirm(`You are about to discard this draft`));
						if (ok) {
							contentTextArea!.blur();
							onContentBlur && onContentBlur();
						}
					}
				}}
			/>
			<div class="mt-1 relative">
				{!!addedTags().length && (
					<div
						tabIndex={-1}
						ref={tagStuffDiv}
						class="mb-0.5 fx flex-wrap text-lg px-3 py-1 gap-1 rounded-t bg-bg2 border-mg1 border"
						onClick={() => tagIpt!.focus()}
					>
						{addedTags().map((name, i) => (
							// The  is needed to avoid some bug
							// without it, the app crashes under certain conditions I cannot fully explain
							// For example, remove the Fragment and put the key back in with the div. Then go to any uil. Then use alt + m to open the mindapp extension. Then with just your keyboard, add the tags "Tech Industry", then "Web Development". Then click the X on "Tech Industry". The client crashes with:
							//  NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
							// idk y but the fragment fixes it
							<>
								<div class="text-fg1 flex group">
									{name}
									<button
										class="xy -ml-0.5 group h-7 w-7 rounded-full -outline-offset-4"
										ref={(r) => (tagXs[i] = r)}
										onClick={(e) => {
											e.stopPropagation(); // this is needed to focus the next tag
											const newTags = [...addedTags()];
											newTags.splice(i, 1);
											addedTagsSet(newTags);
											!newTags.length || (i === newTags.length && !e.shiftKey)
												? tagIpt?.focus()
												: tagXs[i - (e.shiftKey ? 1 : 0)]?.focus();
										}}
										onKeyDown={(e) => {
											if (e.key === 'Backspace') {
												tagXs[i]?.click();
											} else if (
												!['Control', 'Alt', 'Tab', 'Shift', 'Meta', 'Enter'].includes(e.key)
											) {
												tagIpt?.focus();
											}
										}}
										onMouseUp={() => {
											tagIndexSet(-1);
											setTimeout(() => tagIpt?.focus(), 0);
										}}
									>
										<Icon path={xCircle} class="w-4 h-4 text-fg2 group-hover:text-fg1 transition" />
									</button>
								</div>
							</>
						))}
					</div>
				)}
				<input
					autocomplete="off"
					class={`px-3 py-1 text-xl w-full overflow-hidden bg-bg2 border-mg1 border ${
						addedTags().length ? '' : 'rounded-t'
					} ${suggestTags() ? '' : 'rounded-b'}`}
					placeholder="Search tags"
					ref={tagIpt}
					onClick={() => suggestTagsSet(true)}
					onFocus={() => suggestTagsSet(true)}
					value={tagFilter()}
					onInput={(e) => {
						tagSuggestionsRefs[0]?.focus();
						tagIpt?.focus();
						tagIndexSet(!e.target.value.length && addedTags().length ? -1 : 0);
						suggestTagsSet(true);
						tagFilterSet(e.target.value);
					}}
					onKeyDown={(e) => {
						e.key === 'Enter' && !(e.metaKey || e.altKey || e.ctrlKey) && addTag();
						e.key === 'Tab' && suggestTagsSet(false);
						if (e.key === 'Escape') {
							suggestTagsSet(false);
							contentTextArea!.focus();
						}
						if (e.key === 'ArrowUp') {
							e.preventDefault();
							const index = Math.max(tagIndex() - 1, -1);
							tagSuggestionsRefs[index]?.focus();
							tagIpt?.focus();
							tagIndexSet(index);
						}
						if (e.key === 'ArrowDown') {
							e.preventDefault();
							const index = Math.min(tagIndex() + 1, suggestedTags()!.length - 1);
							tagSuggestionsRefs[index]?.focus();
							tagIpt?.focus();
							tagIndexSet(index);
						}
					}}
					onBlur={() => {
						setTimeout(() => {
							if (
								document.activeElement !== tagStuffDiv &&
								document.activeElement !== tagIpt &&
								!tagXs.find((e) => e === document.activeElement) &&
								!tagSuggestionsRefs.find((e) => e === document.activeElement)
							) {
								tagIndexSet(0);
								suggestTagsSet(false);
							}
						}, 0);
					}}
				/>
				<div
					// Need the ternary "invisible" over `suggestTags && </>` otherwise may get:
					// Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
					// When inputting two tags like "Japan", "Physics", then blurring tag input idk y
					class={`z-50 flex flex-col overflow-scroll rounded-b mt-0.5 bg-mg1 absolute w-full max-h-56 shadow ${
						suggestTags() ? '' : 'invisible'
					}`}
				>
					{suggestedTags().map((tag, i) => {
						return (
							<button
								ref={(r) => (tagSuggestionsRefs[i] = r)}
								class={`fx px-3 text-nowrap text-xl hover:bg-mg2 ${
									tagIndex() === i ? 'bg-mg2' : 'bg-mg1'
								}`}
								onClick={() => addTag(tag)}
							>
								{tag}
							</button>
						);
					})}
				</div>
			</div>
			<div class="mt-1 fx justify-end gap-1.5">
				{/* <p class="">Will post as a random persona</p> */}
				{/* <button
					// TODO: Convert image files into braille ascii art
					// https://github.com/LachlanArthur/Braille-ASCII-Art
					// https://lachlanarthur.github.io/Braille-ASCII-Art/
					class="px-2.5 p-0.5 transition text-fg2 hover:text-fg1"
					onClick={() => writeThought()}
				>
					<ArrowUpOnSquareIcon class="h-6 w-6" />
				</button> */}
				<button
					// TODO: opacity-50 when no content
					class="px-2 rounded h-8 w-11 xy font-semibold transition bg-mg1 hover:bg-mg2"
					onClick={() => writeThought()}
				>
					{makePersonaOnPost() ? (
						<Icon path={userPlus} class="h-6 w-6" />
					) : (
						<Icon path={plus} class="h-7 w-7" />
					)}
				</button>
			</div>
		</div>
	);
};
