import { useTagTree } from './state';

export type TagTree = {
	parents: Record<string, string[]>;
	loners: string[];
	// synonyms: string[][]
	// tag names that are synonymous (like for acronyms or semantic reduction/ellipsis)
	// synonyms: [
	// 	['USA', 'United States of America'],
	// 	['Soft Rock', 'Soft Rock Music'],
	// ];
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
	if (!tagTree.loners.includes(label) && shouldBeLoner(useTagTree(), label)) return null;

	const expand = (label: string, parentLineage: string[] = []): RecursiveTag => {
		const subTags = tagTree.parents[label];
		const thisLineage = [...parentLineage, label];
		return {
			label,
			lineage: thisLineage,
			subRecTags:
				!subTags || parentLineage.includes(label)
					? null
					: subTags.map((subsetLabel) => expand(subsetLabel, thisLineage)),
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

export const getTagRelations = (tagTree: TagTree) => {
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

export const listAllTags = (nodes: ReturnType<typeof getTagRelations>) => {
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
	const privateTags = new Set(getAllSubTags(useTagTree(), 'Private Tag'));

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

export function sortKeysByNodeCount(tagTree: TagTree): string[] {
	const allNodes = new Set<string>();
	const childToParent: Record<string, string> = {};

	// Build child-to-parent mapping and collect all nodes
	for (const [parent, children] of Object.entries(tagTree.parents)) {
		allNodes.add(parent);
		for (const child of children) {
			allNodes.add(child);
			childToParent[child] = parent;
		}
	}

	// Add loners to all nodes
	for (const loner of tagTree.loners) {
		allNodes.add(loner);
	}

	// Count descendants for each node
	const descendantCounts: Record<string, number> = {};
	for (const node of allNodes) {
		countDescendants(node, tagTree.parents, descendantCounts, new Set());
	}

	// Sort keys by descendant count (from most to least)
	const sortedKeys = Object.entries(descendantCounts)
		.sort((a, b) => b[1] - a[1])
		.map(([key, _]) => key);

	// Filter out descendants of previous tags
	const filteredKeys: string[] = [];
	const descendants = new Set<string>();

	for (const key of sortedKeys) {
		if (!descendants.has(key)) {
			filteredKeys.push(key);
			addDescendants(key, tagTree.parents, descendants);
		}
	}

	return filteredKeys;
}

function countDescendants(
	node: string,
	parents: Record<string, string[]>,
	counts: Record<string, number>,
	visited: Set<string>,
): number {
	if (visited.has(node)) {
		return 0;
	}

	if (counts[node] !== undefined) {
		return counts[node];
	}

	visited.add(node);

	const children = parents[node] || [];
	let count = children.length;

	for (const child of children) {
		count += countDescendants(child, parents, counts, visited);
	}

	counts[node] = count;
	visited.delete(node);
	return count;
}

function addDescendants(node: string, parents: Record<string, string[]>, descendants: Set<string>) {
	const children = parents[node] || [];
	for (const child of children) {
		if (!descendants.has(child)) {
			descendants.add(child);
			addDescendants(child, parents, descendants);
		}
	}
}
