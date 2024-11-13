import { RequestHandler } from 'express';
import TagTree from '../types/TagTree';
import { sortObjectProps, sortUniArr } from '../utils/tags';
import { debouncedSnapshot } from '../utils/git';

const renameTag: RequestHandler = (req, res) => {
	const oldTag: string = req.body.oldTag;
	const newTag: string = req.body.newTag.trim();
	if (oldTag === newTag) {
		res.send({});
		return;
	}
	const tagTree = TagTree.get();
	if (tagTree.parents[oldTag]) {
		tagTree.parents[newTag] = tagTree.parents[oldTag];
		delete tagTree.parents[oldTag];
	} else {
		const oldTagIndex = tagTree.loners.findIndex((label) => label === oldTag);
		if (oldTagIndex !== -1) {
			const willBeParent = !!tagTree.parents[newTag];
			if (willBeParent) {
				tagTree.loners.splice(oldTagIndex, 1);
			} else {
				tagTree.loners[oldTagIndex] = newTag;
				tagTree.loners = sortUniArr(tagTree.loners);
			}
		}
	}

	Object.entries(tagTree.parents).forEach(([tag, subtags]) => {
		const oldTagIndex = subtags.findIndex((label) => label === oldTag);
		if (oldTagIndex !== -1) {
			subtags[oldTagIndex] = newTag;
			tagTree.parents[tag] = sortUniArr(subtags);
		}
	});

	sortObjectProps(tagTree.parents);
	tagTree.overwrite();

	res.send({});
	debouncedSnapshot();
};

export default renameTag;
