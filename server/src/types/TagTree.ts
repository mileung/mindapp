import Ajv from 'ajv';
import { parseFile, writeObjectFile } from '../utils/files';
import { WorkingDirectory } from './WorkingDirectory';

const ajv = new Ajv();

const schema = {
	type: 'object',
	properties: {
		parents: {
			type: 'object',
			patternProperties: {
				'.+': { type: 'array', items: { type: 'string' } },
			},
		},
		loners: { type: 'array', items: { type: 'string' } },
	},
	required: ['loners'],
	additionalProperties: false,
};

export default class TagTree {
	public parents: Record<string, string[]>;
	public loners: string[];

	constructor({ parents, loners }: { parents: Record<string, string[]>; loners: string[] }) {
		this.parents = parents;
		this.loners = loners;

		// console.log('this:', this);
		if (!ajv.validate(schema, this)) throw new Error('Invalid TagTree: ' + JSON.stringify(this));
	}

	static get() {
		return new TagTree(parseFile(WorkingDirectory.current.tagTreePath));
	}

	overwrite() {
		writeObjectFile(WorkingDirectory.current.tagTreePath, this);
	}
}
