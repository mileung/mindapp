import { atom, useAtom } from 'jotai';
import { useCallback } from 'react';
import { Persona, passwords } from '../types/PersonasPolyfill';
import { Thought } from './ClientThought';
import { hostedLocally, makeUrl, ping, post, testingExternalClientLocally } from './api';
import { createKeyPair, decrypt, signItem } from './security';
import { RootSettings, Space, WorkingDirectory } from './settings';
import { TagTree } from './tags';
import Ajv from 'ajv';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { SignedAuthor, UnsignedAuthor } from '../types/Author';

export const defaultSpaceHost = hostedLocally
	? ''
	: testingExternalClientLocally
		? 'localhost:8080'
		: 'api.mindapp.cc';

export type LocalState = {
	theme: 'System' | 'Light' | 'Dark';
	personas: Persona[];
	fetchedSpaces: Record<string, Space>;
};

const defaultLocalState: LocalState = {
	theme: 'System',
	personas: [{ id: '', spaceHosts: [defaultSpaceHost] }],
	fetchedSpaces: {},
};

const ajv = new Ajv({ verbose: true });

const schema = {
	type: 'object',
	properties: {
		theme: { enum: ['System', 'Light', 'Dark'] },
		personas: { type: 'array', items: { type: 'object' } },
		fetchedSpaces: { type: 'object' },
	},
	required: ['theme', 'personas', 'fetchedSpaces'],
	additionalProperties: true,
};

if (!ajv.validate(schema, defaultLocalState)) {
	alert('Invalid defaultLocalState');
}

export const getLocalState = () => {
	const storedLocalState = localStorage.getItem('LocalState');
	const localState: LocalState = storedLocalState ? JSON.parse(storedLocalState) : {};
	// console.log('localState:', localState);

	const validLocalState = ajv.validate(schema, localState);
	// console.log('validLocalState:', validLocalState);
	// console.log(new Error().stack);
	if (!validLocalState) {
		localStorage.setItem('LocalState', JSON.stringify(defaultLocalState));
	}
	return validLocalState ? localState : defaultLocalState;
};

export const updateLocalState = (stateUpdate: Partial<LocalState>) => {
	const currentLocalState = getLocalState();
	const mergedState = { ...currentLocalState, ...stateUpdate };
	localStorage.setItem('LocalState', JSON.stringify(mergedState));
	return mergedState;
};

export const createAtom = <T>(initialValue: T) => {
	const atomInstance = atom<T>(initialValue);
	return () => useAtom(atomInstance);
};

const currentLocalState = getLocalState();
export const usePersonas = createAtom<Persona[]>(
	(() => {
		let arr = currentLocalState.personas;
		if (hostedLocally) return arr;

		arr.forEach((p) => {
			if (p.id && p.encryptedMnemonic) {
				const decryptedMnemonic = decrypt(p.encryptedMnemonic, '');
				if (!validateMnemonic(decryptedMnemonic, wordlist)) return;
				passwords[p.id] = '';
			}
		});
		arr = arr.map((p) => ({ ...p, locked: passwords[p.id] === undefined }));
		if (arr[0].locked) {
			arr.unshift(
				arr.splice(
					arr.findIndex((p) => !p.id),
					1,
				)[0],
			);
		}
		return arr;
	})(),
);
export const useTagMapOpen = createAtom<boolean>(false);
export const useFetchedSpaces = createAtom<Record<string, Space>>(currentLocalState.fetchedSpaces);
export const useSavedFileThoughtIds = createAtom<Record<string, boolean>>({});
export const useAuthors = createAtom<Record<string, SignedAuthor>>({});
export const useMentionedThoughts = createAtom<Record<string, Thought>>({});
export const useRootSettings = createAtom<null | RootSettings>(null);
export const useWorkingDirectory = createAtom<undefined | null | WorkingDirectory>(undefined);
export const useLastUsedTags = createAtom<string[]>([]);
export const useLocalState = createAtom<LocalState>(currentLocalState);
export const useTagTree = createAtom<null | TagTree>(null);
// TODO: For users hosting mindapp locally, indicate wherever tags are displayed which ones overlap with the local and space tag tree, tags that are specific  to the space, and tags that specific to what's local
// export const useLocalTagTree = createAtom<null | TagTree>(null);

type Item = string | Record<string, any> | any[];
export function useGetSignature() {
	const [personas] = usePersonas();
	return useCallback(
		async (item: Item, personaId?: string) => {
			if (!personaId) return;
			if (hostedLocally) {
				const { signature } = await ping<{ signature?: string }>(
					makeUrl('get-signature'),
					post({ item, personaId }),
				);
				return signature;
			} else {
				// console.log(item, personaId);
				// console.log(new Error().stack);
				const persona = personas.find((p) => p.id === personaId);
				if (!persona) throw new Error('Persona not found');
				if (persona.locked) throw new Error('Persona locked');
				const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, passwords[persona.id]);
				if (!validateMnemonic(decryptedMnemonic, wordlist)) {
					throw new Error('Something went wrong');
				}
				const { publicKey, privateKey } = createKeyPair(decryptedMnemonic);
				if (publicKey !== personaId) {
					throw new Error('Mnemonic on file does not correspond to personaId');
				}
				return signItem(item, privateKey);
			}
		},
		[personas],
	);
}

export function useGetSignedAuthor() {
	const getSignature = useGetSignature();
	return useCallback(
		async (unsignedAuthor: UnsignedAuthor) => {
			const signedAuthor: SignedAuthor = {
				...unsignedAuthor,
				signature: (await getSignature(unsignedAuthor, unsignedAuthor.id))!,
			};
			return signedAuthor;
		},
		[getSignature],
	);
}

type Message = {
	[key: string]: any;
	to: string;
	from?: string;
};
export function useSendMessage() {
	const getSignature = useGetSignature();
	return useCallback(
		async <T>(message: Message) => {
			return await ping<T>(
				message.to,
				post({ message, fromSignature: await getSignature(message, message.from) }),
			);
		},
		[getSignature],
	);
}

export function useActiveSpace() {
	const [personas] = usePersonas();
	const [spaces] = useFetchedSpaces();
	return spaces[personas[0].spaceHosts[0]] || { host: personas[0].spaceHosts[0] };
}

export function useGetMnemonic() {
	const [personas] = usePersonas();
	return useCallback(
		(personaId: string) => {
			if (!personaId) return '';
			if (hostedLocally) throw new Error('Cannot call this');
			const persona = personas.find((p) => p.id === personaId);
			if (!persona) throw new Error('Persona not found');
			if (persona.locked) throw new Error('Persona locked');
			const decryptedMnemonic = decrypt(persona.encryptedMnemonic!, passwords[persona.id]);
			if (!validateMnemonic(decryptedMnemonic, wordlist)) {
				throw new Error('Something went wrong');
			}
			return decryptedMnemonic;
		},
		[personas],
	);
}
