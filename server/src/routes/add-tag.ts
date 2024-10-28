import { RequestHandler } from 'express';
import TagTree from '../types/TagTree';
import { debouncedSnapshot } from '../utils/git';
import { shouldBeLoner, sortObjectProps, sortUniArr } from '../utils/tags';

// TODO: the tag tree could just be handled entirely client side
// Also when you change the name of a child tag, it may leave the new tag name under Loners in the tag-tree

const addTag: RequestHandler = (req, res) => {
	const tagTree = TagTree.get();
	const tag = (req.body.tag || '').trim();
	const parentTag = (req.body.parentTag || '').trim();
	if (tag) {
		if (parentTag) {
			tagTree.parents[parentTag] = !tagTree.parents[parentTag]
				? [tag]
				: sortUniArr(tagTree.parents[parentTag].concat(tag));
			const parentTagIndex = tagTree.loners.indexOf(parentTag);
			parentTagIndex !== -1 && tagTree.loners.splice(parentTagIndex, 1);
			const tagIndex = tagTree.loners.indexOf(tag);
			tagIndex !== -1 && tagTree.loners.splice(tagIndex, 1);
		} else if (shouldBeLoner(tagTree, tag)) {
			tagTree.loners = sortUniArr(tagTree.loners.concat(tag));
		}
	}
	sortObjectProps(tagTree.parents);
	tagTree.overwrite();
	res.send({});
	debouncedSnapshot();
};

export default addTag;
