import Ajv from 'ajv';
import { signItem, verifyItem } from '../utils/security';
import { and, eq, isNull } from 'drizzle-orm';
import { thoughtsTable, votesTable } from '../db/schema';

const ajv = new Ajv({ verbose: true });

const schema = {
	type: 'object',
	properties: {
		thoughtCreateDate: { type: 'number' },
		thoughtAuthorId: { type: 'string' },
		thoughtSpaceHost: { type: 'string' },
		up: { type: 'boolean' },
		voteDate: { type: 'number' },
		voterId: { type: 'string' },
		txHash: { type: 'string' },
		signature: { type: 'string' },
	},
	required: [
		'thoughtCreateDate',
		'thoughtAuthorId',
		'thoughtSpaceHost',
		'up',
		'voteDate',
		'voterId',
		'txHash',
		'signature',
	],
	additionalProperties: false,
};

export class Vote {
	public thoughtCreateDate: number;
	public thoughtAuthorId: string;
	public thoughtSpaceHost: string;
	public up: boolean;
	public voteDate: number;
	public voterId: string;
	public txHash: string;
	public signature: string;

	constructor({
		thoughtCreateDate,
		thoughtAuthorId,
		thoughtSpaceHost,
		up,
		voteDate,
		voterId,
		txHash,
		signature,
	}: {
		thoughtCreateDate: number;
		thoughtAuthorId?: string | null;
		thoughtSpaceHost?: string | null;
		up?: boolean | null;
		voteDate: number;
		voterId: string;
		txHash?: string | null;
		signature?: string | null;
	}) {
		this.thoughtCreateDate = thoughtCreateDate;
		this.thoughtAuthorId = thoughtAuthorId || '';
		this.thoughtSpaceHost = thoughtSpaceHost || '';
		this.up = !!up;
		this.voteDate = voteDate;
		this.voterId = voterId;
		this.txHash = txHash || '';
		this.signature = signature || '';
		// console.log("this:", this);
		if (!ajv.validate(schema, this)) throw new Error('Invalid Vote: ' + JSON.stringify(this));
		// console.log('this:', this);
		if (this.signature && !this.validSignature) throw new Error('Invalid signature');
	}

	get dbColumns() {
		return {
			thoughtCreateDate: this.thoughtCreateDate,
			thoughtAuthorId: this.thoughtAuthorId || null,
			thoughtSpaceHost: this.thoughtSpaceHost || null,
			up: this.up || null,
			voteDate: this.voteDate,
			voterId: this.voterId,
			txHash: this.txHash || null,
			signature: this.signature,
		};
	}

	get clientProps() {
		return {
			thoughtCreateDate: this.thoughtCreateDate,
			thoughtAuthorId: this.thoughtAuthorId || undefined,
			thoughtSpaceHost: this.thoughtSpaceHost || undefined,
			up: this.up || undefined,
			voteDate: this.voteDate,
			voterId: this.voterId,
			txHash: this.txHash || undefined,
			signature: this.signature || undefined,
		};
	}

	get validSignature() {
		return verifyItem(this.unsigned, this.voterId, this.signature);
	}

	get unsigned() {
		return {
			thoughtCreateDate: this.thoughtCreateDate,
			thoughtAuthorId: this.thoughtAuthorId,
			thoughtSpaceHost: this.thoughtSpaceHost,
			up: this.up,
			voteDate: this.voteDate,
			voterId: this.voterId,
			txHash: this.txHash,
		};
	}

	get signed() {
		if (this.signature && !this.validSignature) throw new Error('Invalid signature');
		return { ...this.unsigned, signature: this.signature };
	}

	sign(privateKey: string) {
		this.voteDate = Date.now();
		this.signature = signItem(this.unsigned, privateKey);
	}

	static makeVoteFilter(thoughtId: string, voterId?: string) {
		const [createDate, authorId, spaceHost] = thoughtId.split('_', 3);
		return and(
			eq(votesTable.thoughtCreateDate, +createDate),
			authorId //
				? eq(votesTable.thoughtAuthorId, authorId)
				: isNull(votesTable.thoughtAuthorId),
			spaceHost //
				? eq(votesTable.thoughtSpaceHost, spaceHost)
				: isNull(votesTable.thoughtSpaceHost),
			voterId ? eq(votesTable.voterId, voterId) : undefined,
		);
	}
}

export type UnsignedVote = Vote['unsigned'];
export type SignedVote = Vote['signed'];
