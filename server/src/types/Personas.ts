import Ajv from 'ajv';
import { WorkingDirectory } from './WorkingDirectory';
import { parseFile, writeObjectFile } from '../utils/files';
import { Item, createKeyPair, decrypt, encrypt, signItem } from '../utils/security';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { wallet } from '@vite/vitejs/es5';
import env from '../utils/env';
import { inGroup } from '../db';
import { tokenNetwork } from './TokenNetwork';
import { Author, SignedAuthor } from './Author';

const ajv = new Ajv();

const schema = {
	type: 'object',
	properties: {
		registry: {
			type: 'object',
			patternProperties: {
				'.*': {
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
	},
	required: ['registry'],
	additionalProperties: false,
};

export type Persona = Partial<SignedAuthor> & {
	encryptedMnemonic?: string;
	spaceHosts: string[];
};

let passwords: Record<string, string> = {};

export class Personas {
	public registry: Record<string, Persona>;

	constructor({ registry = { '': { spaceHosts: [''] } } }: { registry?: Record<string, Persona> }) {
		if (env.GLOBAL_HOST) throw new Error('Global space cannot use Personas');
		this.registry = registry;
		// console.log('this:', this);
		if (!ajv.validate(schema, this)) throw new Error('Invalid Personas: ' + JSON.stringify(this));
	}

	getOrderedArr(order: string[] = [], includeAll = false): Persona[] {
		// console.log('order:', order);
		const set = new Set(order);
		const arr = [
			...order.map((id) => ({
				id,
				...this.registry[id],
				encryptedMnemonic: undefined,
			})),
			...(includeAll
				? Object.keys(this.registry) // idk whether to include personas client didn't ask for
						.filter((key) => !set.has(key))
						.map((id) => ({
							id,
							...this.registry[id],
							encryptedMnemonic: undefined,
						}))
				: []),
		].map((p) => ({ ...p, locked: (p.id && passwords[p.id] === undefined) || undefined }));
		if (arr[0].locked) {
			arr.unshift(
				arr.splice(
					arr.findIndex((p) => !p.id),
					1,
				)[0],
			);
		}
		return arr;
	}

	static get() {
		return new Personas(parseFile(WorkingDirectory.current.personasPath));
	}

	get savedProps() {
		return {
			registry: this.registry,
		};
	}

	overwrite() {
		writeObjectFile(WorkingDirectory.current.personasPath, this.savedProps);
	}

	addPersona({
		mnemonic,
		password,
		name,
		frozen,
		walletAddress,
	}: {
		mnemonic: string;
		password: string;
		name?: string;
		frozen?: true;
		walletAddress?: string;
	}) {
		const { publicKey, privateKey } = createKeyPair(mnemonic);
		if (this.registry[publicKey]) throw new Error('publicKey already used');
		const author = new Author({
			id: publicKey,
			name,
			frozen,
			walletAddress:
				walletAddress || wallet.deriveAddress({ mnemonics: mnemonic, index: 0 }).address,
		});
		author.sign(privateKey);
		this.registry[publicKey] = {
			...author.signed,
			id: undefined,
			encryptedMnemonic: encrypt(mnemonic, password),
			spaceHosts: [''],
		};
		passwords[publicKey] = password;
		this.overwrite();
		return { ...this.registry[publicKey], id: publicKey };
	}

	deletePersona(personaId: string, mnemonic: string) {
		if (!personaId) throw new Error('Anon cannot be deleted');
		if (passwords[personaId] === undefined) throw new Error('Persona locked');
		const persona = this.registry[personaId];
		const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, passwords[personaId]);
		const deleted = mnemonic === decryptedMnemonic;
		if (deleted) {
			delete this.registry[personaId];
			this.overwrite();
		}
		return deleted;
	}

	unlockPersona(personaId: string, password: string) {
		if (!personaId) throw new Error('Anon is always unlocked');
		const persona = this.registry[personaId];
		if (!persona) throw new Error('Persona not found');
		const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, password);
		const valid = validateMnemonic(decryptedMnemonic, wordlist);
		if (valid) passwords[personaId] = password;
		return valid;
	}

	update(personas: Persona[]) {
		personas.forEach((p) => {
			if (p.id === undefined) throw new Error('Persona is missing id');
			let author: undefined | Author;
			if (p.id) {
				if (passwords[p.id] === undefined) throw new Error('Persona locked');
				author = new Author({ ...p, id: p.id });
				const decryptedMnemonic = decrypt(this.registry[p.id].encryptedMnemonic!, passwords[p.id]);
				const { publicKey, privateKey } = createKeyPair(decryptedMnemonic);
				author.sign(privateKey);
				if (publicKey !== p.id) throw new Error('publicKey !== p.id');
			}
			this.registry[p.id] = {
				...this.registry[p.id],
				...author?.clientProps,
				spaceHosts: p.spaceHosts,
				id: undefined,
			};
		});
		this.overwrite();
	}

	// for solid frontend
	new_update(personas: Persona[]) {
		personas.forEach((p) => {
			if (p.id === undefined) throw new Error('Persona is missing id');
			this.registry[p.id] = { ...p, id: undefined };
		});
		this.overwrite();
	}

	sendToken(personaId: string, toAddress: string, tokenId: string, amount: string) {
		if (!personaId) throw new Error("Anon can't send tokens");
		const persona = this.registry[personaId];
		if (!persona) throw new Error('Persona not found');
		if (passwords[personaId] === undefined) throw new Error('Persona locked');
		const mnemonic = decrypt(persona.encryptedMnemonic!, passwords[personaId]);
		return tokenNetwork.sendToken(persona.walletAddress, mnemonic, toAddress, tokenId, amount);
	}

	async receiveBlocks(personaId: string) {
		if (!personaId) throw new Error("Anon can't receive blocks");
		const persona = this.registry[personaId];
		if (!persona) throw new Error('Persona not found');
		if (passwords[personaId] === undefined) throw new Error('Persona locked');
		const mnemonic = decrypt(persona.encryptedMnemonic!, passwords[personaId]);
		tokenNetwork.receiveBlocks(persona.walletAddress, mnemonic);
	}

	validateMnemonic(personaId: string, mnemonic: string) {
		if (!personaId) throw new Error("Anon doesn't have a mnemonic");
		if (passwords[personaId] === undefined) throw new Error('Persona locked');
		if (!validateMnemonic(mnemonic, wordlist)) throw new Error('Invalid mnemonic');
		const persona = this.registry[personaId];
		if (!persona) throw new Error('Persona not found');
		const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, passwords[personaId]);
		return decryptedMnemonic === mnemonic;
	}

	getPersonaMnemonic(personaId: string, password: string) {
		if (!personaId) throw new Error('Anon cannot have a mnemonic');
		const persona = this.registry[personaId];
		if (!persona) throw new Error('Persona not found');
		const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, password);
		const valid = validateMnemonic(decryptedMnemonic, wordlist);
		if (valid) {
			passwords[personaId] = password;
			return decryptedMnemonic;
		}
		return '';
	}

	updatePersonaPassword(personaId: string, oldPassword: string, newPassword: string) {
		if (!personaId) throw new Error('Anon cannot have a password');
		const persona = this.registry[personaId];
		if (!personaId || !persona) throw new Error('Persona not found');
		const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, oldPassword);
		const valid = validateMnemonic(decryptedMnemonic, wordlist);
		if (valid) {
			passwords[personaId] = newPassword;
			persona.encryptedMnemonic = encrypt(decryptedMnemonic, newPassword);
			this.overwrite();
		}
		return valid;
	}

	getSignature(item: Item, personaId: string) {
		if (!personaId) throw new Error('Anon cannot sign items');
		const locked = passwords[personaId] === undefined;
		if (locked) throw new Error('Persona locked');
		const persona = this.registry[personaId];
		if (!persona) throw new Error('Persona not found');
		const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, passwords[personaId]);
		const { publicKey, privateKey } = createKeyPair(decryptedMnemonic);
		if (publicKey !== personaId) {
			throw new Error('Mnemonic on file does not correspond to personaId');
		}
		return signItem(item, privateKey);
	}

	static lockAllPersonas() {
		passwords = {};
	}

	static async getAuthor(personaId: string, spaceHost?: string) {
		if (!env.GLOBAL_HOST && !spaceHost) {
			const persona = Personas.get().registry[personaId];
			if (persona) return new Author({ ...persona, id: personaId }).clientProps;
		}
		return await inGroup(personaId);
	}
}
