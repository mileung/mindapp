import Ajv from 'ajv';
import { signItem, verifyItem } from '../utils/security';

const ajv = new Ajv({ verbose: true });

const schema = {
	type: 'object',
	properties: {
		id: { type: 'string' },
		name: { type: 'string', maxLength: 100 },
		frozen: { type: 'boolean' },
		walletAddress: { type: 'string' },
		writeDate: { type: 'number' },
		signature: { type: 'string' },
		addDate: { type: 'number' },
		addedById: { type: 'string' },
	},
	required: [
		'id',
		'name',
		'frozen',
		'walletAddress',
		'writeDate',
		'signature',
		'addDate',
		'addedById',
	],
	additionalProperties: false,
};

export class Author {
	public id: string;
	public name: string;
	public frozen: boolean;
	public walletAddress: string;
	public writeDate: number;
	public signature: string;
	public addDate: number;
	public addedById: string;

	constructor({
		id,
		signature,
		writeDate,
		name,
		frozen,
		walletAddress,
		addDate,
		addedById,
	}: {
		id?: string;
		signature?: string | null;
		writeDate?: number | null;
		name?: string | null;
		frozen?: boolean | null;
		walletAddress?: string | null;
		addDate?: number;
		addedById?: string | null;
	}) {
		this.id = id || '';
		this.signature = signature || '';
		this.writeDate = writeDate || 0;
		this.name = name || '';
		this.frozen = frozen || false;
		this.walletAddress = walletAddress || '';
		this.addDate = addDate || 0;
		this.addedById = addedById || '';
		// console.log("this:", this);
		if (!ajv.validate(schema, this)) throw new Error('Invalid Author: ' + JSON.stringify(this));
		// console.log('this:', this);
		if (this.signature && !this.validSignature) throw new Error('Invalid signature');
	}

	get dbColumns() {
		return {
			id: this.id,
			name: this.name || null,
			frozen: this.frozen || null,
			walletAddress: this.walletAddress || null,
			writeDate: this.writeDate || null,
			signature: this.signature || null,
			addDate: this.addDate,
			addedById: this.addedById || null,
		};
	}

	get clientProps() {
		return {
			id: this.id || undefined,
			name: this.name || undefined,
			frozen: this.frozen || undefined,
			walletAddress: this.walletAddress || undefined,
			writeDate: this.writeDate || undefined,
			signature: this.signature || undefined,
			addDate: this.addDate || undefined,
			addedById: this.addedById || undefined,
		};
	}

	get validSignature() {
		return verifyItem(this.unsigned, this.id, this.signature);
	}

	get unsigned() {
		return {
			writeDate: this.writeDate,
			id: this.id,
			name: this.name,
			frozen: this.frozen,
			walletAddress: this.walletAddress,
		};
	}

	get signed() {
		if (this.signature && !this.validSignature) throw new Error('Invalid signature');
		return { ...this.unsigned, signature: this.signature };
	}

	sign(privateKey: string) {
		this.writeDate = Date.now();
		this.signature = signItem(this.unsigned, privateKey);
	}
}

export type UnsignedAuthor = Author['unsigned'];
export type SignedAuthor = Author['signed'];
