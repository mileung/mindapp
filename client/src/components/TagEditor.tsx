import { A } from '@solidjs/router';
import { matchSorter } from 'match-sorter';
import { Icon } from 'solid-heroicons';
import { arrowTopRightOnSquare, link, trash, xMark } from 'solid-heroicons/solid-mini';
import { createEffect, createMemo, createSignal, For, JSX } from 'solid-js';
import { useTagTree } from '~/utils/state';
import InputAutoWidth from './InputAutoWidth';
import { getTagRelations, listAllTags, RecursiveTag, sortKeysByNodeCount } from '../utils/tags';

const TagEditor = (props: {
	ref?: (t: HTMLInputElement) => void;
	subTaggingLineage: () => string[];
	recTag: () => RecursiveTag;
	parentTag?: string;
	onRename: (oldTag: string, newTag: string, newSubTaggingLineage: string[]) => void | Promise<any>;
	onSubtag: (tag: string, parentTag: string, newSubTaggingLineage: string[]) => void | Promise<any>;
	onRemove: (currentTagLabel: string, parentTag?: string) => void;
	onKeyDown?: JSX.DOMAttributes<HTMLInputElement>['onKeyDown'];
}) => {
	const { subTaggingLineage, recTag, parentTag, onRename, onSubtag, onRemove, onKeyDown } = props;
	const [addingSubtag, addingSubtagSet] = createSignal(
		JSON.stringify(recTag().lineage) === JSON.stringify(subTaggingLineage),
	);
	createEffect(() => {
		addingSubtagSet(JSON.stringify(recTag().lineage) === JSON.stringify(subTaggingLineage));
	});
	const [editing, editingSet] = createSignal(false);
	const [tagFilter, tagFilterSet] = createSignal('');
	const [tagIndex, tagIndexSet] = createSignal<number>(0);
	const [suggestTags, suggestTagsSet] = createSignal(false);
	let defaultLabel = recTag().label;
	let editingIpt: undefined | HTMLInputElement;
	let tagLnk: undefined | HTMLAnchorElement;
	let makeSubsetBtn: undefined | HTMLButtonElement;
	let removeBtn: undefined | HTMLButtonElement;
	let addingIpt: undefined | HTMLInputElement;
	let tagSuggestionsRefs: (null | HTMLButtonElement)[] = [];

	const trimmedFilter = createMemo(() => tagFilter().trim());
	const allTags = createMemo(() =>
		!suggestTags() ? [] : listAllTags(getTagRelations(useTagTree())),
	);
	const defaultTags = createMemo(() =>
		!suggestTags() ? [] : sortKeysByNodeCount(useTagTree()).reverse(),
	);
	const filteredTags = createMemo(() => {
		if (!suggestTags()) return [];
		const addedTagsSet = new Set(
			recTag()
				.subRecTags?.map((t) => t.label)
				.concat(recTag().label),
		);
		if (!trimmedFilter()) return defaultTags().filter((tag) => !addedTagsSet.has(tag));
		const filter = trimmedFilter().replace(/\s+/g, ' ');
		const arr = matchSorter(allTags(), filter).slice(0, 99).concat(trimmedFilter());
		return [...new Set(arr)].filter((tag) => !addedTagsSet.has(tag));
	});

	const onEditingBlur = () => {
		editingIpt!.value = defaultLabel;
		setTimeout(() => {
			if (
				document.activeElement !== editingIpt &&
				document.activeElement !== tagLnk &&
				document.activeElement !== makeSubsetBtn &&
				document.activeElement !== removeBtn
			) {
				editingSet(false);
			}
		}, 0);
	};
	const addSubTag = (e: KeyboardEvent | MouseEvent, tagToAdd?: string) => {
		tagToAdd = tagToAdd || filteredTags()?.[tagIndex()] || trimmedFilter();
		if (!tagToAdd) return;
		addingIpt!.focus();
		onSubtag(
			tagToAdd,
			recTag().label,
			e.ctrlKey ? recTag().lineage.concat(tagToAdd) : e.altKey ? recTag().lineage : [],
		)?.then(() => {
			setTimeout(() => {
				// addingIpt && (addingIpt.value = '');
				tagFilterSet('');
			}, 0);
		});
	};

	createEffect(() => {
		editingIpt!.value = recTag().label;
		defaultLabel = recTag().label;
	});

	return (
		<div>
			<div class="fx">
				<InputAutoWidth
					ref={(r) => {
						editingIpt = r;
						props.ref?.(r);
					}}
					value={recTag().label} // TODO: so just use value instead of defaultValue?
					placeholder="Edit tag"
					size={1}
					class="h-8 min-w-52 border-b-2 text-xl font-medium transition border-bg1 hover:border-mg2 focus:border-fg2"
					onBlur={onEditingBlur}
					onFocus={() => editingSet(true)}
					onKeyDown={(e) => {
						// @ts-ignore
						onKeyDown?.(e);
						e.key === 'Escape' && editingIpt?.blur();
						const newLabel = editingIpt?.value.trim();
						if (!newLabel) return;
						if (e.key === 'Enter') {
							if (e.altKey) {
								addingSubtagSet(true);
							}
							if (newLabel !== recTag().label) {
								editingSet(false);
								defaultLabel = newLabel;
								// editingIpt?.blur();
								onRename(
									recTag().label,
									newLabel,
									e.ctrlKey
										? recTag().lineage.slice(0, -1).concat(newLabel)
										: e.altKey
											? recTag().lineage.slice(0, -1)
											: [],
								);
							}
						}
					}}
				/>
				{editing() && (
					<>
						<A
							class="xy h-8 w-8 group"
							ref={(r) => (tagLnk = r)}
							onBlur={onEditingBlur}
							href={`/tags/${encodeURIComponent(recTag().label)}`}
						>
							<Icon
								path={link}
								class="h-6 w-6 mt-1 rotate-90 transition text-fg2 group-hover:text-fg1"
							/>
						</A>
						<button
							class="xy h-8 w-8 group"
							title="Add subtags"
							ref={(r) => (makeSubsetBtn = r)}
							onBlur={onEditingBlur}
							onClick={() => {
								addingSubtagSet(true);
								editingSet(false);
							}}
						>
							<Icon
								path={arrowTopRightOnSquare}
								class="h-6 w-6 mt-1 rotate-90 transition text-fg2 group-hover:text-fg1"
							/>
						</button>
						<button
							class="xy h-8 w-8 group"
							ref={(r) => (removeBtn = r)}
							onBlur={onEditingBlur}
							onKeyDown={(e) => e.key === 'Tab' && !e.shiftKey && editingSet(false)}
							onClick={() => {
								const ok =
									!!parentTag || confirm(`You are about to delete the "${recTag().label}" tag`);
								ok ? onRemove(recTag().label, parentTag) : editingIpt?.focus();
							}}
						>
							{parentTag ? (
								<Icon path={xMark} class="h-7 w-7 transition text-fg2 group-hover:text-fg1" />
							) : (
								<Icon path={trash} class="h-5 w-5 transition text-fg2 group-hover:text-fg1" />
							)}
						</button>
					</>
				)}
			</div>
			<div class="pl-3 border-l-2 border-fg2 w-fit relative">
				{addingSubtag() && (
					<>
						<InputAutoWidth
							// autofocus
							ref={(t) => {
								addingIpt = t;
								setTimeout(() => t.focus(), 0);
							}}
							placeholder="Subtag"
							size={1}
							class="h-8 min-w-52 border-b-2 text-xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
							onClick={() => suggestTagsSet(true)}
							onFocus={() => suggestTagsSet(true)}
							value={tagFilter()}
							onInput={(e) => {
								tagSuggestionsRefs[0]?.focus();
								addingIpt?.focus();
								tagIndexSet(0);
								suggestTagsSet(true);
								tagFilterSet(e.target.value);
							}}
							onKeyDown={(e) => {
								e.key === 'Enter' && addSubTag(e);
								e.key === 'Tab' && suggestTagsSet(false);
								e.key === 'Escape' && addingIpt?.blur();
								if (e.key === 'ArrowUp') {
									e.preventDefault();
									const index = Math.max(tagIndex() - 1, -1);
									tagSuggestionsRefs[index]?.focus();
									addingIpt?.focus();
									tagIndexSet(index);
								}
								if (e.key === 'ArrowDown') {
									e.preventDefault();
									const index = Math.min(tagIndex() + 1, filteredTags()!.length - 1);
									tagSuggestionsRefs[index]?.focus();
									addingIpt?.focus();
									tagIndexSet(index);
								}
							}}
							onBlur={() => {
								setTimeout(() => {
									if (
										document.activeElement !== addingIpt &&
										!tagSuggestionsRefs.find((e) => e === document.activeElement)
									) {
										tagIndexSet(0);
										addingSubtagSet(false);
									}
								}, 0);
							}}
						/>
						{suggestTags() && (
							<div class="z-20 flex flex-col overflow-scroll rounded mt-0.5 bg-mg1 absolute min-w-[calc(100%-12px)] max-h-56 shadow">
								{filteredTags().map((tag, i) => {
									return (
										<button
											ref={(r) => (tagSuggestionsRefs[i] = r)}
											class={`fx px-2 text-nowrap text-xl hover:bg-mg2 ${
												tagIndex() === i ? 'bg-mg2' : 'bg-mg1'
											}`}
											onClick={(e) => addSubTag(e, tag)}
										>
											{tag}
										</button>
									);
								})}
							</div>
						)}
					</>
				)}
				<For each={recTag().subRecTags}>
					{(subRecTag) => (
						<TagEditor
							subTaggingLineage={subTaggingLineage}
							parentTag={recTag().label}
							recTag={() => subRecTag}
							onRename={onRename}
							onSubtag={onSubtag}
							onRemove={onRemove}
						/>
					)}
				</For>
			</div>
		</div>
	);
};

export default TagEditor;
