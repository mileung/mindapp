import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTagMapOpen, useTagTree } from '../utils/state';
import Results from './Results';
import { getNodes, getNodesArr, getParentsMap, getTags, makeRootTag } from '../utils/tags';
import { matchSorter } from 'match-sorter';
import Drawer from '../components/Drawer';
import { Link, useSearchParams } from 'react-router-dom';
import RecTagLink from '../components/RecTagLink';

export default function Home() {
	const [tagTree] = useTagTree();
	const [tagFilter, tagFilterSet] = useState('');
	const [tagMapOpen, tagMapOpenSet] = useTagMapOpen();
	const [searchParams, searchParamsSet] = useSearchParams();
	const q = searchParams.get('q') || '';
	const tags = getTags(q);
	const searchIpt = useRef<HTMLInputElement>(null);
	const tagMapDiv = useRef<HTMLDivElement>(null);
	const tagMapDiv2 = useRef<HTMLDivElement>(null);
	const nodes = useMemo(() => tagTree && getNodes(tagTree), [tagTree]);
	const nodesArr = useMemo(() => nodes && getNodesArr(nodes), [nodes]);
	const normalizedTagFilter = useMemo(() => tagFilter.trim().replace(/\s+/g, ''), [tagFilter]);
	const filteredTags = useMemo(
		() => nodesArr && (normalizedTagFilter ? matchSorter(nodesArr, normalizedTagFilter) : nodesArr),
		[nodesArr, normalizedTagFilter],
	);
	const focusedTag = useMemo(() => tags.length === 1 && tags[0], [tags]);
	const parentsMap = useMemo(() => tagTree && getParentsMap(tagTree), [JSON.stringify(tagTree)]);
	const rootParents = useMemo(
		() => (focusedTag && parentsMap?.[focusedTag]) || null,
		[parentsMap, focusedTag],
	);
	const rootTag = useMemo(() => {
		return tagTree && focusedTag ? makeRootTag(tagTree, focusedTag) : null;
	}, [tagTree, focusedTag]);

	const onTagClick = useCallback((e: React.MouseEvent) => {
		if (!e.metaKey && !e.shiftKey) {
			tagFilterSet('');
			tagMapOpenSet(false);
			tagMapDiv.current!.scrollTop = 0;
			tagMapDiv2.current!.scrollTop = 0;
		}
	}, []);

	const tagMap = useMemo(
		() => (
			<div className="">
				<div className="sticky bg-bg2 top-0 flex">
					<input
						ref={searchIpt}
						value={tagFilter}
						className="w-full px-2 h-8 border-b-2 text-lg font-medium transition border-mg1 hover:border-mg2 focus:border-mg2"
						placeholder="Tag filter"
						onChange={(e) => tagFilterSet(e.target.value)}
						onKeyDown={(e) => {
							e.key === 'Escape' && searchIpt.current?.blur();
						}}
					/>
				</div>
				<div className="flex-1 p-1">
					{focusedTag && !tagFilter ? (
						<div className="">
							<div className="fx flex-wrap gap-1 bg-bg2">
								{tagTree && !rootParents && <p className="xy flex-grow text-fg2">No parent tags</p>}
								{(rootParents || []).map((name, i) => {
									return (
										<Link
											key={i}
											className="xy flex-grow rounded transition px-1.5 font-medium border-2 text-fg2 border-mg1 hover:text-fg1 hover:border-mg2"
											to={`/search?q=${encodeURIComponent(`[${name}]`)}`}
											onClick={onTagClick}
										>
											{name}
										</Link>
									);
								})}
							</div>
							<div className="mt-1.5">
								{rootTag && <RecTagLink isRoot recTag={rootTag} onClick={onTagClick} />}
							</div>
						</div>
					) : (
						<div className="fx flex-wrap gap-1 bg-bg2">
							{(filteredTags || []).map((name, i) => {
								return (
									<Link
										key={i}
										className="xy flex-grow rounded transition px-1.5 font-medium border-2 text-fg2 border-mg1 hover:text-fg1 hover:border-mg2"
										to={`/search?q=${encodeURIComponent(`[${name}]`)}`}
										onClick={onTagClick}
									>
										{name}
									</Link>
								);
							})}
						</div>
					)}
				</div>
			</div>
		),
		[onTagClick, tagFilter, filteredTags, focusedTag],
	);

	return (
		<div className="flex p-1.5 sm:p-3">
			<Results />
			<Drawer isOpen={tagMapOpen} onClose={() => tagMapOpenSet(false)}>
				{/* <h2 className="text-xl font-bold mb-4">Drawer Content</h2>
				<p>This is the content of the drawer.</p> */}
				<div ref={tagMapDiv} className="overflow-y-scroll overflow-x-hidden h-screen">
					{tagMap}
				</div>
			</Drawer>
			<div
				ref={tagMapDiv2}
				className="h-[calc(100vh-4.5rem)] sticky top-[3.75rem] hidden md:block md:ml-1.5 md:rounded pt-0 bg-bg2 w-[70%] max-w-lg md:min-w-80 md:w-[30%] flex-col self-start overflow-y-scroll overflow-x-hidden"
			>
				{tagMap}
			</div>
		</div>
	);
}
