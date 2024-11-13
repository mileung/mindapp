import '@fontsource-variable/fira-code';
import '@fontsource-variable/quicksand';
import { MetaProvider, Title } from '@solidjs/meta';
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { createEffect, createSignal, onMount, Suspense } from 'solid-js';
import '~/styles/root.css';
import '~/utils/theme';
import { setThemeMode } from '~/utils/theme';
import Header from './components/Header';
import { Author } from './types/Author';
import { buildUrl, hostedLocally, makeUrl, ping, post } from './utils/api';
import { getCookie } from './utils/cookies';
import { clone } from './utils/js';
import { decrypt, hashItem } from './utils/security';
import { RootSettings, Space, WorkingDirectory } from './utils/settings';
import { sendMessage } from './utils/signing';
import {
	authors,
	authorsSet,
	fetchedSpaces,
	fetchedSpacesSet,
	passwords,
	passwordsSet,
	personas,
	personasSet,
	retryJoiningHost,
	retryJoiningHostSet,
	rootSettingsSet,
	themeMode,
	themeModeSet,
	useActiveSpace,
	useTagTree,
	workingDirectorySet,
} from './utils/state';
import { TagTree } from './utils/tags';
import { getIdbStore, updateIdbStore } from './utils/indexedDb';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { useAnon } from './types/PersonasPolyfill';

// const mindappChannel = new BroadcastChannel('mindapp_channel');

export default function App() {
	const [idbLoaded, idbLoadedSet] = createSignal(false);
	onMount(async () => {
		// mindappChannel.onmessage = (event) => {
		// 	if (event.data.type === 'UPDATE_STATE') {
		// 		// TODO: make it an option to keep personas in sync across tabs?
		// 	}
		// };

		const initialIdbStore = await getIdbStore();
		personasSet(initialIdbStore.personas);
		fetchedSpacesSet(initialIdbStore.fetchedSpaces);

		const cookieTheme = getCookie('theme');
		themeModeSet((cookieTheme?.startsWith('system') ? 'system' : cookieTheme) || 'system');
		setThemeMode(themeMode());
		// does not exist on older browsers
		if (window?.matchMedia('(prefers-color-scheme: dark)')?.addEventListener) {
			window
				?.matchMedia('(prefers-color-scheme: dark)')
				?.addEventListener('change', () => setThemeMode(themeMode()));
		}

		personas.forEach((persona) => {
			if (persona.encryptedMnemonic) {
				const decryptedMnemonic = decrypt(persona.encryptedMnemonic, '');
				const valid = decryptedMnemonic && validateMnemonic(decryptedMnemonic, wordlist);
				if (valid) {
					passwordsSet((old) => ({ ...old, [persona.id]: '' }));
				}
			}
		});
		passwords[personas[0].id] === undefined && useAnon();
		idbLoadedSet(true);

		if (hostedLocally) {
			const tagTree = await ping<TagTree>(makeUrl('get-tag-tree'));
			fetchedSpacesSet((old) => {
				old[''] = { host: '', tagTree };
				return clone(old);
			});
			const { rootSettings, workingDirectory } = await ping<{
				rootSettings: RootSettings;
				workingDirectory: WorkingDirectory;
			}>(makeUrl('get-root-settings'));
			rootSettingsSet(rootSettings);
			workingDirectorySet(workingDirectory);
		}
	});

	createEffect((p) => {
		const newStore = clone({ fetchedSpaces, personas });
		const str = JSON.stringify(newStore);
		if (!idbLoaded() || p === str) return p;
		// TODO: this is not efficient but the clones are needed to trigger this function idk y
		updateIdbStore(newStore);
		return str;
	});

	// createEffect((p) => {
	// 	const str = JSON.stringify({ fetchedSpaces, personas, passwords });
	// 	if (!idbLoaded() || p === str) return p;
	// 	mindappChannel.postMessage({
	// 		type: 'UPDATE_STATE',
	// 		value: str,
	// 	});
	// 	return str;
	// });

	// createEffect((p) => {
	// 	const str = JSON.stringify({ personas, passwords });
	// 	if (p === str) return p;
	// 	if (hostedLocally) {
	// 		ping(makeUrl('update-personas'), post({ personas, newPasswords: passwords })).catch((err) =>
	// 			console.error(err),
	// 		);
	// 	}
	// 	return str;
	// });

	createEffect((prev) => {
		if (!idbLoaded()) return;
		const authorsStr1 = JSON.stringify(authors);
		if (prev === authorsStr1) return prev;
		authorsSet((old) => {
			personas.forEach((p) => (old[p.id] = { ...old[p.id], ...p }));
			return clone(old);
		});
		const authorsStr2 = JSON.stringify(authors);
		return authorsStr2;
	});

	createEffect(() => {
		if (!personas[0].id) return;
		// const mnemonic = getMnemonic(personas[0].id);
		// const { walletAddress } = personas[0];
		// if (walletAddress && mnemonic) {
		// 	tokenNetwork.receiveBlocks(walletAddress, mnemonic);
		// }
	});

	createEffect((lastHost) => {
		if (!idbLoaded()) return;
		let { host } = useActiveSpace();
		if (!host || (lastHost === host && !retryJoiningHost())) return host;
		if (retryJoiningHost()) host = retryJoiningHost();
		retryJoiningHostSet('');
		const { id, name, frozen, walletAddress, writeDate, signature } = personas[0];
		const tagTreeHash = hashItem(useTagTree());
		sendMessage<{ space: Omit<Space, 'host'> }>({
			from: id,
			to: buildUrl({ host, path: 'update-space-author' }),
			tagTreeHash,
			signedAuthor: !id
				? undefined
				: {
						id,
						name,
						frozen,
						walletAddress,
						writeDate,
						signature,
				  },
		})
			.then(({ space }) => {
				if (!id) space.fetchedSelf = new Author({});
				fetchedSpacesSet((old) => ({
					...old,
					[host]: { ...old[host], ...space, host },
				}));
			})
			.catch((err) => {
				console.log('err:', err);
				fetchedSpacesSet((old) => ({
					...old,
					[host]: { ...old[host], fetchedSelf: null },
				}));
			});
		return host;
	});

	return (
		<Router
			root={(props) => (
				<MetaProvider>
					<Title>Mindapp</Title>
					{idbLoaded() && (
						<>
							<Header />
							<Suspense>{props.children}</Suspense>
						</>
					)}
				</MetaProvider>
			)}
		>
			<FileRoutes />
		</Router>
	);
}
