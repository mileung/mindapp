import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { SignedAuthor } from '../types/Author';
import { Persona } from '../types/PersonasPolyfill';
import { Thought } from './ClientThought';
import { RootSettings, Space, WorkingDirectory } from './settings';
import { defaultIdbStore } from './indexedDb';

export const [themeMode, themeModeSet] = createSignal<string | 'system' | 'light' | 'dark'>('');
export const [drawerOpen, drawerOpenSet] = createSignal<boolean>(false);
export const [retryJoiningHost, retryJoiningHostSet] = createSignal<string>('');

export const [roots, rootsSet] = createStore<(null | Thought)[]>([]);
export const [authors, authorsSet] = createStore<Record<string, SignedAuthor>>({});
export const [mentionedThoughts, mentionedThoughtsSet] = createStore<Record<string, Thought>>({});
export const [rootSettings, rootSettingsSet] = createStore<RootSettings>({
	testWorkingDirectory: false,
});
export const [workingDirectory, workingDirectorySet] = createStore<WorkingDirectory>({
	gitSnapshotsEnabled: false,
	gitRemoteUrl: '',
	dirPath: '',
});

export const [passwords, passwordsSet] = createStore<Record<string, string>>({});
export const [personas, personasSet] = createStore<Persona[]>(defaultIdbStore.personas);
export const [fetchedSpaces, fetchedSpacesSet] = createStore<Record<string, Space>>(
	defaultIdbStore.fetchedSpaces,
);

export function useActiveSpace() {
	return fetchedSpaces[personas[0].spaceHosts[0]] || { host: personas[0].spaceHosts[0] };
}

export function useTagTree() {
	return (fetchedSpaces[''] || useActiveSpace()).tagTree || { parents: {}, loners: [] };
}
