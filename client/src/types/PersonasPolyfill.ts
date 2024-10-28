import { SignedAuthor, UnsignedAuthor } from './Author';

export let passwords: Record<string, string> = {};

export type Persona = Partial<SignedAuthor> & {
	id: string;
	encryptedMnemonic?: string;
	spaceHosts: string[];
	locked?: boolean;
};

export function getUnsignedAuthor(persona: { id: string } & Partial<Persona>) {
	const unsignedAuthor: UnsignedAuthor = {
		writeDate: Date.now(),
		id: persona.id,
		name: persona.name || '',
		frozen: persona.frozen || false,
		walletAddress: persona.walletAddress || '',
	};
	return unsignedAuthor;
}
