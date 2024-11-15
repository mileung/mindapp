import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { SignedAuthor, UnsignedAuthor } from './Author';
import { wordlist } from '@scure/bip39/wordlists/english';
import { createKeyPair, encrypt, signItem } from '~/utils/security';
import { defaultSpaceHost } from '~/utils/api';
import { authorsSet, passwordsSet, personasSet, retryJoiningHostSet } from '~/utils/state';
import { clone } from '~/utils/js';
// import { wallet } from '@vite/vitejs'; // this doesn't work
import * as vitejs from '@vite/vitejs'; // this
const { wallet } = vitejs; // does. idk y

export type Persona = Partial<SignedAuthor> & {
	id: string;
	encryptedMnemonic?: string;
	spaceHosts: string[];
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

export function useAnon() {
	personasSet((old) => {
		old.splice(
			0,
			0,
			old.splice(
				old.findIndex((p) => !p.id),
				1,
			)[0],
		);
		return clone(old);
	});
}

export const addPersona = ({
	mnemonic = '',
	name = '',
	password = '',
	initialSpace = defaultSpaceHost,
}) => {
	let newPersona: Persona;
	mnemonic = mnemonic || generateMnemonic(wordlist, 256);
	if (!validateMnemonic(mnemonic, wordlist)) {
		throw new Error('Invalid mnemonic');
	}
	const kp = createKeyPair(mnemonic);
	const unsignedAuthor = getUnsignedAuthor({
		id: kp.publicKey,
		name,
		// The next line causes Module "buffer" has been externalized for browser compatibility. Cannot access "buffer.Buffer" in client code. See https://vite.dev/guide/troubleshooting.html#module-externalized-for-browser-compatibility for more details.
		walletAddress: wallet.deriveAddress({ mnemonics: mnemonic, index: 0 }).address,
		// TODO: rewrite the essential Vite wallet functions
		// Address Derivation: https://docs.vite.org/vuilder-docs/vite-basics/cryptography/address-derivation.html
		// HD Wallet: https://docs.vite.org/vite-docs/reference/hdwallet.html
	});
	const signedAuthor = {
		...unsignedAuthor,
		signature: signItem(unsignedAuthor, kp.privateKey),
	};
	newPersona = {
		...signedAuthor,
		encryptedMnemonic: encrypt(mnemonic, password),
		spaceHosts: [...new Set([initialSpace, defaultSpaceHost])],
	};
	passwordsSet((old) => clone({ ...old, [newPersona.id]: password }));
	personasSet((old) => clone([newPersona, ...old]));
	authorsSet((old) => ({ ...old, [newPersona.id]: signedAuthor }));
	retryJoiningHostSet(initialSpace);
	return newPersona;
};
