import {
	// ArrowUpOnSquareIcon,
	// ChatBubbleBottomCenterTextIcon,
	// ListBulletIcon,
	PlusIcon,
	UserPlusIcon,
	XCircleIcon,
} from '@heroicons/react/16/solid';
import React, { MutableRefObject, useCallback, useMemo, useRef, useState } from 'react';
import {
	useTagTree,
	usePersonas,
	useLastUsedTags,
	useMentionedThoughts,
	useAuthors,
	useSendMessage,
	useActiveSpace,
	useGetSignature,
} from '../utils/state';
import { buildUrl, hostedLocally, localApiHost, makeUrl, ping, post } from '../utils/api';
import { matchSorter } from 'match-sorter';
import { TagTree, getNodes, getNodesArr, sortUniArr } from '../utils/tags';
import { Thought } from '../utils/ClientThought';
import { useKeyPress } from '../utils/keyboard';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import TextareaAutoHeight from './TextareaAutoHeight';
import { isStringifiedRecord } from '../utils/js';
import { SignedAuthor } from '../types/Author';

export const ThoughtWriter = ({
	parentRef,
	initialContent,
	initialTags = [],
	editId,
	parentId,
	onWrite,
	onContentBlur,
}: {
	parentRef?: MutableRefObject<null | HTMLTextAreaElement>;
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
	const activeSpace = useActiveSpace();
	const [personas] = usePersonas();
	const [searchParams] = useSearchParams();
	const jsonString = searchParams.get('json');
	const jsonParam = useMemo(
		() =>
			jsonString
				? (JSON.parse(jsonString) as { initialContent: string; initialTags?: string[] })
				: null,
		[],
	);
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const sendMessage = useSendMessage();
	const getSignature = useGetSignature();
	const [authors, authorsSet] = useAuthors();
	const [mentionedThoughts, mentionedThoughtsSet] = useMentionedThoughts();
	const [lastUsedTags, lastUsedTagsSet] = useLastUsedTags();
	const [tagTree, tagTreeSet] = useTagTree();
	const [tags, tagsSet] = useState<string[]>([...initialTags, ...(jsonParam?.initialTags || [])]);
	const [tagFilter, tagFilterSet] = useState('');
	const [tagIndex, tagIndexSet] = useState(0);
	const [suggestTags, suggestTagsSet] = useState(false);
	const contentTextArea = parentRef || useRef<null | HTMLTextAreaElement>(null);
	const tagStuffDiv = useRef<null | HTMLDivElement>(null);
	const tagIpt = useRef<null | HTMLInputElement>(null);
	const tagXs = useRef<(null | HTMLButtonElement)[]>([]);
	const tagSuggestionsRefs = useRef<(null | HTMLButtonElement)[]>([]);
	const nodesArr = useMemo(() => tagTree && getNodesArr(getNodes(tagTree)), [tagTree]);
	const trimmedFilter = useMemo(() => tagFilter.trim(), [tagFilter]);
	const suggestedTags = useMemo(() => {
		if (!nodesArr || !suggestTags) return [];
		let arr = matchSorter(nodesArr, tagFilter);
		trimmedFilter ? arr.push(trimmedFilter) : arr.unshift(...lastUsedTags);
		arr = [...new Set(arr)].filter((tag) => !tags.includes(tag));
		return arr;
	}, [nodesArr, suggestTags, tagFilter, trimmedFilter, lastUsedTags, tags]);
	const defaultValue = useMemo(() => {
		const initialStuff = initialContent || jsonParam?.initialContent || '';
		return isStringifiedRecord(initialStuff)
			? JSON.stringify(JSON.parse(initialStuff), null, 2)
			: initialStuff;
	}, []);
	const makePersonaOnPost = useMemo(
		// TODO: () => activeSpace.host && !personas[0].id,
		() => false,
		[activeSpace, personas[0]],
	);
	const addTag = useCallback(
		(tagToAdd?: string) => {
			tagToAdd = tagToAdd || suggestedTags[tagIndex] || trimmedFilter;
			if (!tagToAdd) return;
			tagsSet([...new Set([...tags, tagToAdd])]);
			tagIpt.current!.focus();
			lastUsedTagsSet([...new Set([tagToAdd, ...lastUsedTags])].slice(0, 5));
			tagFilterSet('');
			tagIndexSet(-1);
		},
		[suggestedTags, tagIndex, trimmedFilter, tags, lastUsedTags],
	);
	const writeThought = useCallback(
		async (ctrlKey?: boolean, altKey?: boolean) => {
			const content = contentTextArea.current!.value;
			if (!content) return;
			jsonString && navigate(pathname, { replace: true });
			contentTextArea.current!.style.height = 'auto';
			const additionalTag = ((suggestTags && suggestedTags[tagIndex]) || tagFilter).trim();
			const trimmedContent = content.trim();

			let [createDate, authorId, spaceHost] = (editId || '').split('_', 3);
			const message = {
				from: editId ? authorId : personas[0].id,
				to: buildUrl({
					host: editId ? spaceHost : activeSpace.host,
					path: 'write-thought',
				}),
				thought: {
					parentId: parentId || undefined,
					content: trimmedContent,
					tags: (() => {
						const arr = sortUniArr([...tags, additionalTag].filter((a) => !!a));
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
								spaceHost: activeSpace.host || undefined,
							}),
				} as Omit<Thought, 'children' | 'filedSaved'>,
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
					contentTextArea.current!.value = '';
					tagsSet([]);
					tagFilterSet('');
					suggestTagsSet(false);
					contentTextArea.current!.focus();
				})
				.catch((err) => alert(err));

			if (hostedLocally) {
				ping(
					buildUrl({ host: localApiHost, path: 'save-thought' }),
					post({ thought: message.thought }),
				)
					.then((res) => {
						// console.log('res:', res);
						if (!activeSpace.host) {
							ping<TagTree>(makeUrl('get-tag-tree'))
								.then((data) => tagTreeSet(data))
								.catch((err) => alert(err));
						}
					})
					.catch((err) => alert(err));
			}
		},
		[
			sendMessage,
			personas[0],
			activeSpace,
			jsonString,
			suggestedTags,
			tagIndex,
			tagFilter,
			editId,
			parentId,
			personas,
			onWrite,
			tags,
		],
	);

	useKeyPress(
		{ key: 'Enter', modifiers: ['Meta', 'Alt', 'Control'] },
		(e) => {
			const focusedOnThoughtWriter =
				document.activeElement === contentTextArea.current ||
				document.activeElement === tagIpt.current ||
				tagXs.current.find((e) => e === document.activeElement);
			if (focusedOnThoughtWriter) {
				writeThought(e.ctrlKey, e.altKey);
			}
		},
		[suggestedTags, writeThought],
	);

	useKeyPress(
		{ key: 'ArrowDown' },
		(e) => {
			// TODO: move focus to first thought
			// Make the ux similar to using VS Code and Markdown
		},
		[suggestedTags, writeThought],
	);

	return (
		<div className="w-full flex flex-col">
			<TextareaAutoHeight
				autoFocus
				defaultValue={defaultValue}
				ref={contentTextArea}
				onFocus={(e) => {
					// focuses on the end of the input value when editing
					const tempValue = e.target.value;
					e.target.value = '';
					e.target.value = tempValue;
				}}
				name="content"
				placeholder="New thought"
				className="rounded text-xl font-thin font-mono px-3 py-2 w-full max-w-full resize-y min-h-36 bg-mg1 transition brightness-[0.97] dark:brightness-75 focus:brightness-100 focus:dark:brightness-100"
				onKeyDown={(e) => {
					if (e.key === 'Escape') {
						const ok =
							onContentBlur &&
							(contentTextArea.current?.value === defaultValue ||
								confirm(`You are about to discard this draft`));
						if (ok) {
							contentTextArea.current?.blur();
							onContentBlur && onContentBlur();
						}
					}
					// if (e.key === 'Tab' && !e.shiftKey) {
					// 	e.preventDefault();
					// 	tagIpt.current?.focus();
					// }
				}}
			/>
			<div className="mt-1 relative">
				{!!tags.length && (
					<div
						tabIndex={-1}
						ref={tagStuffDiv}
						className="mb-0.5 fx flex-wrap px-3 py-1 gap-1 rounded-t bg-bg2 text-lg"
						onClick={() => tagIpt.current!.focus()}
					>
						{tags.map((name, i) => (
							// The React.Fragment is needed to avoid some bug
							// without it, the app crashes under certain conditions I cannot fully explain
							// For example, remove the Fragment and put the key back in with the div. Then go to any uil. Then use alt + m to open the mindapp extension. Then with just your keyboard, add the tags "Tech Industry", then "Web Development". Then click the X on "Tech Industry". The client crashes with:
							//  NotFoundError: Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
							// idk y but the fragment fixes it
							<React.Fragment key={name}>
								<div className="text-fg1 flex group">
									{name}
									<button
										className="xy -ml-0.5 group h-7 w-7 rounded-full -outline-offset-4"
										ref={(r) => (tagXs.current[i] = r)}
										onClick={(e) => {
											e.stopPropagation(); // this is needed to focus the next tag
											const newTags = [...tags];
											newTags.splice(i, 1);
											tagsSet(newTags);
											!newTags.length || (i === newTags.length && !e.shiftKey)
												? tagIpt.current?.focus()
												: tagXs.current[i - (e.shiftKey ? 1 : 0)]?.focus();
										}}
										onKeyDown={(e) => {
											if (e.key === 'Backspace') {
												tagXs.current[i]?.click();
											} else if (
												!['Control', 'Alt', 'Tab', 'Shift', 'Meta', 'Enter'].includes(e.key)
											) {
												tagIpt.current?.focus();
											}
										}}
										onMouseUp={() => {
											tagIndexSet(-1);
											setTimeout(() => tagIpt.current?.focus(), 0);
										}}
									>
										<XCircleIcon className="w-4 h-4 text-fg2 group-hover:text-fg1 transition" />
									</button>
								</div>
							</React.Fragment>
						))}
					</div>
				)}
				<input
					autoComplete="off"
					className={`px-3 py-1 text-xl bg-mg1 w-full overflow-hidden transition brightness-[0.97] dark:brightness-75 focus:brightness-100 focus:dark:brightness-100 ${tags.length ? '' : 'rounded-t'} ${suggestTags ? '' : 'rounded-b'}`}
					placeholder="Search tags"
					ref={tagIpt}
					onClick={() => suggestTagsSet(true)}
					onFocus={() => suggestTagsSet(true)}
					value={tagFilter}
					onChange={(e) => {
						tagSuggestionsRefs.current[0]?.focus();
						tagIpt.current?.focus();
						tagIndexSet(!e.target.value.length && tags.length ? -1 : 0);
						suggestTagsSet(true);
						tagFilterSet(e.target.value);
					}}
					onKeyDown={(e) => {
						e.key === 'Enter' && !(e.metaKey || e.altKey || e.ctrlKey) && addTag();
						e.key === 'Tab' && suggestTagsSet(false);
						e.key === 'Escape' &&
							(suggestTags ? suggestTagsSet(false) : contentTextArea.current?.focus());
						if (e.key === 'ArrowUp') {
							e.preventDefault();
							const index = Math.max(tagIndex - 1, -1);
							tagSuggestionsRefs.current[index]?.focus();
							tagIpt.current?.focus();
							tagIndexSet(index);
						}
						if (e.key === 'ArrowDown') {
							e.preventDefault();
							const index = Math.min(tagIndex + 1, suggestedTags!.length - 1);
							tagSuggestionsRefs.current[index]?.focus();
							tagIpt.current?.focus();
							tagIndexSet(index);
						}
					}}
					onBlur={() => {
						setTimeout(() => {
							if (
								document.activeElement !== tagStuffDiv.current &&
								document.activeElement !== tagIpt.current &&
								!tagSuggestionsRefs.current.find((e) => e === document.activeElement)
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
					className={`z-50 flex flex-col overflow-scroll rounded-b mt-0.5 bg-mg1 absolute w-full max-h-56 shadow ${suggestTags ? '' : 'invisible'}`}
				>
					{suggestedTags.map((tag, i) => {
						return (
							<button
								key={i}
								ref={(r) => (tagSuggestionsRefs.current[i] = r)}
								className={`fx px-3 text-nowrap text-xl hover:bg-mg2 ${tagIndex === i ? 'bg-mg2' : 'bg-mg1'}`}
								onClick={() => addTag(tag)}
							>
								{tag}
							</button>
						);
					})}
				</div>
			</div>
			<div className="mt-1 fx justify-end gap-1.5">
				{/* <p className="">Will post as a random persona</p> */}
				{/* <button
					// TODO: Convert image files into braille ascii art
					// https://github.com/LachlanArthur/Braille-ASCII-Art
					// https://lachlanarthur.github.io/Braille-ASCII-Art/
					className="px-2.5 p-0.5 transition text-fg2 hover:text-fg1"
					onClick={() => writeThought()}
				>
					<ArrowUpOnSquareIcon className="h-6 w-6" />
				</button> */}
				<button
					// TODO: opacity-50 when no content
					className="px-2 rounded h-8 w-11 xy font-semibold transition bg-mg1 hover:bg-mg2"
					onClick={() => writeThought()}
				>
					{makePersonaOnPost ? (
						<UserPlusIcon className="h-6 w-6" />
					) : (
						<PlusIcon className="h-7 w-7" />
					)}
				</button>
			</div>
		</div>
	);
};
