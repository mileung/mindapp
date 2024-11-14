import { Title } from '@solidjs/meta';
import { A, useSearchParams } from '@solidjs/router';
import { matchSorter } from 'match-sorter';
import { Icon } from 'solid-heroicons';
import { bars_3 } from 'solid-heroicons/solid-mini';
import { createEffect, createMemo, createSignal, JSX } from 'solid-js';
import Drawer from '~/components/Drawer';
import Results from '~/components/Results';
import { hostedLocally } from '~/utils/api';
import { drawerOpen, drawerOpenSet, useTagTree } from '~/utils/state';
import {
	getParentsMap,
	getTagRelations,
	getTags,
	listAllTags,
	makeRootTag,
	sortKeysByNodeCount,
} from '~/utils/tags';
import { RecursiveTag } from '../utils/tags';

const makeTitle = (str: string) => `${str ? `${str} | ` : ''}Mindapp`;
const createTitle = (str: () => string) => {
	createEffect(() => {
		document.title = makeTitle(str());
	});
};
export { createTitle }; // idk y the export can't be inline

export default function Home() {
	const [tagFilter, tagFilterSet] = createSignal('');
	const [searchParams, searchParamsSet] = useSearchParams();
	const q = createMemo(() => searchParams.q?.toString() || '');
	createTitle(q);
	const searchedTags = createMemo(() => getTags(q()));
	let searchIpt: undefined | HTMLInputElement;
	let tagMapDiv1: undefined | HTMLDivElement;
	let tagMapDiv2: undefined | HTMLDivElement;

	const allTags = createMemo(() => listAllTags(getTagRelations(useTagTree())));
	const defaultTags = createMemo(() => sortKeysByNodeCount(useTagTree()));
	const filteredTags = createMemo(() => {
		const filter = tagFilter().trim().replace(/\s+/g, ' ');
		return !filter ? defaultTags() : allTags() && matchSorter(allTags(), filter).slice(0, 99);
	});
	const focusedTag = createMemo(() => searchedTags().length === 1 && searchedTags()[0]);
	const parentsMap = createMemo(() => useTagTree() && getParentsMap(useTagTree()));
	const rootParents = createMemo(() => {
		const str = focusedTag();
		return (str && parentsMap()?.[str]) || null;
	});
	const rootTag = createMemo(() => {
		const str = focusedTag();
		return useTagTree() && str ? makeRootTag(useTagTree(), str) : null;
	});

	const onTagClick = (e: MouseEvent) => {
		if (!e.metaKey && !e.shiftKey) {
			tagFilterSet('');
			drawerOpenSet(false);
			tagMapDiv1!.scrollTop = 0;
			tagMapDiv2!.scrollTop = 0;
		}
	};

	const TagMap = () => {
		return (
			<div class="max-h-full overflow-y-scroll">
				<div class="sticky bg-bg2 top-0 flex">
					<input
						ref={searchIpt}
						value={tagFilter()}
						class="w-full px-2 h-10 border-b-2 text-lg font-medium transition border-mg1 hover:border-mg2 focus:border-mg2"
						placeholder="Tag filter"
						onInput={(e) => tagFilterSet(e.target.value)}
						onKeyDown={(e) => {
							e.key === 'Escape' && searchIpt?.blur();
						}}
					/>
				</div>
				<div class="flex-1 p-1">
					{focusedTag() && !tagFilter() ? (
						<>
							<div class="fx flex-wrap gap-1 bg-bg2">
								{useTagTree() && !rootParents() && (
									<p class="xy flex-grow text-fg2">No parent tags</p>
								)}
								{(rootParents() || []).map((name) => {
									return (
										<A
											class="xy flex-grow rounded transition px-1.5 font-medium border text-fg2 border-mg2 hover:text-fg1 hover:border-fg1"
											href={`/?q=[${encodeURIComponent(name)}]`}
											onClick={onTagClick}
										>
											{name}
										</A>
									);
								})}
							</div>
							<div class="mt-1.5">
								<RecTagLink isRoot recTag={rootTag} onClick={onTagClick} />
							</div>
						</>
					) : (
						<div class="fx flex-wrap gap-1 bg-bg2">
							{filteredTags().map((name) => {
								// if (name.startsWith('YouTube@') || name.startsWith('Twitter@')) return null;
								return (
									<A
										class="xy flex-grow rounded transition px-1.5 font-medium border text-fg2 border-mg2 hover:text-fg1 hover:border-fg1"
										href={`/?q=[${encodeURIComponent(name)}]`}
										onClick={onTagClick}
									>
										{name}
									</A>
								);
							})}
						</div>
					)}
					<div class="border-t mt-3 py-1 border-mg1 xy">
						<a
							target="_blank"
							href="https://github.com/mileung/mindapp"
							class="text-center text-sm transition text-fg2 hover:text-fg1"
						>
							Mindapp source code
						</a>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div class="flex p-1.5 sm:p-3">
			<Title>{makeTitle(q())}</Title>
			<div class="w-full md:w-[calc(100%-30%)]">
				<Results />
			</div>
			<div class="md:hidden"></div>
			<Drawer isOpen={drawerOpen} onClose={() => drawerOpenSet(false)}>
				<div ref={tagMapDiv1} class="h-[calc(100vh-3rem)] md:block">
					<TagMap />
				</div>
			</Drawer>
			<div
				ref={tagMapDiv2}
				class="h-[calc(100vh-4.5rem)] sticky top-[3.75rem] hidden pt-0 bg-bg2 w-[70%] flex-col self-start overflow-y-scroll overflow-x-hidden md:block md:ml-1.5 md:rounded md:w-[30%]"
			>
				<TagMap />
			</div>
		</div>
	);
}

type onClickType = JSX.EventHandlerUnion<
	HTMLAnchorElement,
	MouseEvent,
	JSX.EventHandler<HTMLAnchorElement, MouseEvent>
>;

const RecTagLink = (props: {
	recTag: () => RecursiveTag | null;
	isRoot?: boolean;
	onClick: onClickType;
}) => {
	const { recTag, isRoot, onClick } = props;

	return !recTag() ? null : (
		<div class="mt-0.5">
			{isRoot ? (
				<p class="text-fg1 px-2">{recTag()!.label}</p>
			) : (
				<A
					class="rounded transition px-1.5 font-medium border text-fg2 border-mg2 hover:text-fg1 hover:border-fg1"
					href={`/?q=[${encodeURIComponent(recTag()!.label)}]`}
					onClick={onClick}
				>
					{recTag()!.label}
				</A>
			)}
			<div class="pl-3 border-l-2 border-fg2">
				{isRoot && !recTag()?.subRecTags && <p class="text-fg2">No subtags</p>}
				{recTag()?.subRecTags?.map((subRecTag) => (
					<RecTagLink recTag={() => subRecTag} onClick={onClick} />
				))}
			</div>
		</div>
	);
};
