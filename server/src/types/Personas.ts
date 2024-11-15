import Ajv from 'ajv';
import { inGroup } from '../db';
import env from '../utils/env';
import { parseFile, writeObjectFile } from '../utils/files';
import { Author, SignedAuthor } from './Author';
import { WorkingDirectory } from './WorkingDirectory';

const ajv = new Ajv();

const schema = {
	type: 'object',
	properties: {
		list: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					encryptedMnemonic: { type: 'string' },
					name: { type: 'string' },
					walletAddress: { type: 'string' },
					frozen: { type: 'boolean' },
					writeDate: { type: 'number' },
					signature: { type: 'string' },
					spaceHosts: {
						type: 'array',
						items: { type: 'string' },
					},
				},
				required: ['spaceHosts'],
			},
		},
	},
	required: ['list'],
	additionalProperties: false,
};

export type Persona = Partial<SignedAuthor> & {
	id: string;
	encryptedMnemonic?: string;
	spaceHosts: string[];
};

export class Personas {
	public list: Persona[];

	constructor({ list = [{ id: '', spaceHosts: [''] }] }: { list?: Persona[] }) {
		if (env.GLOBAL_HOST) throw new Error('Global space cannot use Personas');
		this.list = list;
		// console.log('this:', this);
		if (!ajv.validate(schema, this)) throw new Error('Invalid Personas: ' + JSON.stringify(this));
	}

	static get() {
		return new Personas(parseFile(WorkingDirectory.current.personasPath));
	}

	get savedProps() {
		return {
			list: this.list,
		};
	}

	overwrite() {
		writeObjectFile(WorkingDirectory.current.personasPath, this.savedProps);
	}

	update(personas: Persona[]) {
		this.list = personas;
		this.overwrite();
	}

	static async getAuthor(personaId: string, spaceHost?: string) {
		if (!env.GLOBAL_HOST && !spaceHost) {
			const persona = Personas.get().list[personaId];
			if (persona) return new Author({ ...persona, id: personaId }).clientProps;
		}
		return await inGroup(personaId);
	}
}
