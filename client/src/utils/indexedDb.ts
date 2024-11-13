import Ajv from 'ajv';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { Persona } from '../types/PersonasPolyfill';
import { defaultSpaceHost } from './api';
import { clone } from './js';
import { Space } from './settings';
import { isServer } from 'solid-js/web';

type StoreValue = {
	personas: Persona[];
	fetchedSpaces: Record<string, Space>;
};
interface IDBSchema extends DBSchema {
	mindappStore: {
		key: string;
		value: StoreValue;
	};
}

export let db: IDBPDatabase<IDBSchema>;
export const defaultIdbStore: StoreValue = {
	personas: [{ id: '', spaceHosts: [defaultSpaceHost] }],
	fetchedSpaces: {
		[defaultSpaceHost]: { host: defaultSpaceHost, tagTree: { parents: {}, loners: [] } },
	},
};

const ajv = new Ajv({ verbose: true });
const schema = {
	type: 'object',
	properties: {
		personas: { type: 'array', items: { type: 'object' } },
		fetchedSpaces: { type: 'object' },
	},
	required: ['personas', 'fetchedSpaces'],
	additionalProperties: true,
};

// if (!ajv.validate(schema, defaultLocalState)) {
// 	alert('Invalid defaultLocalState');
// }

export const initDB = async () => {
	if (isServer) return;
	db = await openDB<IDBSchema>('mindappDatabase', 1, {
		upgrade(database) {
			if (!database.objectStoreNames.contains('mindappStore')) {
				database.createObjectStore('mindappStore');
			}
		},
	});
};

export const updateIdbStore = async (
	updateState: StoreValue | ((prevStore: StoreValue) => StoreValue),
) => {
	if (isServer) return;
	if (!db) await initDB();
	const tx = db.transaction('mindappStore', 'readwrite');
	const store = tx.objectStore('mindappStore');
	const currentStore = (await store.get('mainStore')) || defaultIdbStore;
	const newStore =
		typeof updateState === 'function' ? clone(updateState(clone(currentStore))) : updateState;
	await store.put(newStore, 'mainStore');
	await tx.done;
};

export const getIdbStore = async () => {
	if (isServer) return defaultIdbStore;
	if (!db) await initDB();
	const tx = db.transaction('mindappStore', 'readonly');
	const store = tx.objectStore('mindappStore');
	const storeValue = await store.get('mainStore');
	return storeValue || defaultIdbStore;
};
