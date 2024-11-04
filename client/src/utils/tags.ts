export type TagTree = {
	parents: Record<string, string[]>;
	loners: string[];
};

export type Tag = {
	label: string;
	parentTags: string[];
	subTags: string[];
};

export type RecursiveTag = {
	lineage: string[];
	label: string;
	subRecTags: null | RecursiveTag[];
};

export const sortUniArr = (a: string[]) => {
	return [...new Set(a)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
};

export function shouldBeLoner(tagTree: TagTree, tag: string) {
	return (
		!tagTree.parents[tag] &&
		-1 ===
			Object.values(tagTree.parents).findIndex((subtags) => {
				return subtags.includes(tag);
			})
	);
}

export function makeRootTag(tagTree: TagTree, label: string) {
	if (!tagTree.loners.includes(label) && shouldBeLoner(tagTree, label)) return null;

	const expand = (label: string, lineage: string[] = []): RecursiveTag => {
		const subTags = tagTree.parents[label];
		return {
			label,
			lineage: [...lineage, label],
			subRecTags:
				!subTags || lineage.includes(label)
					? null
					: subTags.map((subsetLabel) => expand(subsetLabel, [...lineage, label])),
		};
	};

	return expand(label);
}

export const getParentsMap = (tagTree: TagTree) => {
	const obj: Record<string, undefined | string[]> = {};
	Object.entries(tagTree.parents).forEach(([parentTag, subTags]) => {
		subTags.forEach((tag) => {
			obj[tag] = (obj[tag] || []).concat(parentTag);
		});
	});
	return obj;
};

export const getNodes = (tagTree: TagTree) => {
	const { loners } = tagTree;
	const parents: string[] = [];
	const childrenSet = new Set<string>();
	Object.entries(tagTree.parents).forEach(([tag, subtags]) => {
		parents.push(tag);
		subtags.forEach((tag) => {
			!tagTree.parents[tag] && childrenSet.add(tag);
		});
	});
	const children = [...childrenSet].sort();

	return { loners, parents, children };
};

export const getNodesArr = (nodes: ReturnType<typeof getNodes>) => {
	return [...nodes.loners, ...nodes.parents, ...nodes.children];
};

export const bracketRegex = /\[([^\[\]]+)]/g;
export function getTags(input: string) {
	return (input.match(bracketRegex) || []).map((match) => match.slice(1, -1));
}

export function getAllSubTags(tagTree: TagTree, tag: string): string[] {
	const result = new Set([tag]);
	const queue = [tag];
	while (queue.length > 0) {
		const currentTag = queue.shift()!;
		const children = tagTree.parents[currentTag] || [];
		for (const child of children) {
			if (!result.has(child)) {
				result.add(child);
				queue.push(child);
			}
		}
	}
	return [...result];
}

export function scrubTagTree(tagTree: TagTree): TagTree {
	const privateTags = new Set(getAllSubTags(tagTree, 'Private Tag'));

	const scrubbedTagTree: TagTree = {
		parents: {},
		loners: [],
	};

	for (const [parent, children] of Object.entries(tagTree.parents)) {
		if (!privateTags.has(parent)) {
			const scrubbedChildren = children.filter((child) => !privateTags.has(child));
			if (scrubbedChildren.length) {
				scrubbedTagTree.parents[parent] = scrubbedChildren;
			}
		}
	}

	for (const [parent, children] of Object.entries(tagTree.parents)) {
		if (
			!children.length &&
			!Object.values(scrubbedTagTree.parents).some((c) => c.includes(parent))
		) {
			// If parent has no children left and is not a
			// child of any other tag,it becomes a loner
			scrubbedTagTree.loners.push(parent);
		}
	}

	// Process loners
	scrubbedTagTree.loners = sortUniArr([...scrubbedTagTree.loners, ...tagTree.loners]);

	return scrubbedTagTree;
}
