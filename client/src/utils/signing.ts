import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { SignedAuthor, UnsignedAuthor } from '~/types/Author';
import { ping, post } from './api';
import { createKeyPair, decrypt, signItem } from './security';
import { passwords, personas } from './state';

type Item = string | Record<string, any> | any[];
export async function getSignature(item: Item, personaId?: string) {
	if (!personaId) return;
	const persona = personas.find((p) => p.id === personaId);
	if (!persona) throw new Error('Persona not found');
	if (passwords[persona.id] === undefined) throw new Error('Persona locked');
	const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, passwords[persona.id]);
	if (!validateMnemonic(decryptedMnemonic || '', wordlist)) {
		throw new Error('Something went wrong');
	}
	const kp = createKeyPair(decryptedMnemonic!);
	if (kp.publicKey !== personaId) {
		throw new Error('Mnemonic on file does not correspond to personaId');
	}
	return signItem(item, kp.privateKey);
}

export async function getSignedAuthor(unsignedAuthor: UnsignedAuthor) {
	const signedAuthor: SignedAuthor = {
		...unsignedAuthor,
		signature: (await getSignature(unsignedAuthor, unsignedAuthor.id))!,
	};
	return signedAuthor;
}

type Message = {
	[key: string]: any;
	to: string;
	from?: string;
};
export async function sendMessage<T>(message: Message) {
	return await ping<T>(
		message.to,
		post({ message, fromSignature: await getSignature(message, message.from) }),
	);
}

export function getMnemonic(personaId: string) {
	if (!personaId) return '';
	const persona = personas.find((p) => p.id === personaId);
	if (!persona) throw new Error('Persona not found');
	if (passwords[persona.id] === undefined) throw new Error('Persona locked');
	const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, passwords[persona.id]);
	if (!validateMnemonic(decryptedMnemonic || '', wordlist)) {
		throw new Error('Something went wrong');
	}
	return decryptedMnemonic;
}
