import { useEffect, useRef } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import ManagePersonas from './pages/ManagePersonas';
import ManageSpaces from './pages/ManageSpaces';
import Settings from './pages/Settings';
import Tags from './pages/Tags';
import UnlockPersona from './pages/UnlockPersona';
import { Author } from './types/Author';
import { tokenNetwork } from './types/TokenNetwork';
import { buildUrl, hostedLocally, makeUrl, ping, post } from './utils/api';
import { hashItem } from './utils/security';
import { RootSettings, Space, WorkingDirectory } from './utils/settings';
import {
	updateLocalState,
	useActiveSpace,
	useAuthors,
	useFetchedSpaces,
	useGetMnemonic,
	useLocalState,
	usePersonas,
	useRootSettings,
	useSendMessage,
	useTagTree,
	useWorkingDirectory,
} from './utils/state';
import { TagTree } from './utils/tags';
import { setTheme } from './utils/theme';

function App() {
	const [localState, localStateSet] = useLocalState();
	const getMnemonic = useGetMnemonic();
	const [, tagTreeSet] = useTagTree();
	const [personas, personasSet] = usePersonas();
	const [fetchedSpaces, fetchedSpacesSet] = useFetchedSpaces();
	const sendMessage = useSendMessage();
	const [authors, authorsSet] = useAuthors();
	const [rootSettings, rootSettingsSet] = useRootSettings();
	const [, workingDirectorySet] = useWorkingDirectory();
	const themeRef = useRef(localState.theme);

	useEffect(() => {
		if (!personas[0].id) return;
		if (hostedLocally) {
			ping<TagTree>(
				makeUrl('receive-blocks'), //
				post({ personaId: personas[0].id }),
			).catch((err) => console.error(err));
		} else {
			const mnemonic = getMnemonic(personas[0].id);
			const { walletAddress } = personas[0];
			if (walletAddress && mnemonic) {
				tokenNetwork.receiveBlocks(walletAddress, mnemonic);
			}
		}
	}, [personas[0].id]);

	useEffect(() => {
		// does not exist on older browsers
		if (window?.matchMedia('(prefers-color-scheme: dark)')?.addEventListener) {
			window?.matchMedia('(prefers-color-scheme: dark)')?.addEventListener('change', () => {
				setTheme(themeRef.current);
			});
		}
	}, []);

	useEffect(() => {
		themeRef.current = localState.theme;
		setTheme(localState.theme);
	}, [localState?.theme]);

	useEffect(() => {
		if (!hostedLocally) return;
		ping<{ rootSettings: RootSettings; workingDirectory: WorkingDirectory }>(
			makeUrl('get-root-settings'),
		)
			.then(({ rootSettings, workingDirectory }) => {
				rootSettingsSet(rootSettings);
				workingDirectorySet(workingDirectory);
			})
			.catch((err) => console.error(err));
		ping<WorkingDirectory>(makeUrl('get-working-directory'))
			.then((data) => workingDirectorySet(data))
			.catch((err) => console.error(err));
		// ping<Persona[]>(
		// 	makeUrl('get-personas'),
		// 	post({
		// 		order: getLocalState().personas.map(({ id }) => id),
		// 	}),
		// )
		// 	.then((p) => {
		// 		// console.log('p:', p);
		// 		personasSet(p);
		// 		localStateSet((old) => ({ ...old, personas: p }));
		// 	})
		// 	.catch((err) => console.error(err));
	}, [!!rootSettings?.testWorkingDirectory]);

	const activeSpace = useActiveSpace();
	useEffect(() => {
		const { host } = activeSpace;
		const savedTagTree = fetchedSpaces[host]?.tagTree;
		savedTagTree && tagTreeSet(savedTagTree);
		if (!host) {
			hostedLocally &&
				ping<TagTree>(makeUrl('get-tag-tree'))
					.then((data) => {
						tagTreeSet(data);
					})
					.catch((err) => console.error(err));
		} else {
			const { id, name, frozen, walletAddress, writeDate, signature } = personas[0];
			const tagTreeHash = savedTagTree && hashItem(savedTagTree);
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
						[host]: {
							...old[host],
							...space,
							host,
						},
					}));
					space.tagTree && tagTreeSet(space.tagTree);
				})
				.catch((err) => {
					fetchedSpacesSet((old) => ({
						...old,
						[host]: { ...old[host], fetchedSelf: null },
					}));
				});
		}
	}, [activeSpace.host, personas[0].id]);

	useEffect(() => {
		authorsSet((old) => {
			personas.forEach((p) => {
				if (p.id && p.name) old[p.id] = { ...old[p.id], ...p };
			});
			return { ...old };
		});
		localStateSet((old) => ({ ...old, personas }));
		if (hostedLocally) {
			// TODO: Only update the persona that has its name changed?
			ping(makeUrl('update-personas'), post({ personas: personas.filter((p) => !p.locked) })) //
				.catch((err) => console.error(err));
		}
	}, [personas]);

	useEffect(() => {
		localStateSet((old) => ({ ...old, fetchedSpaces }));
	}, [fetchedSpaces]);

	useEffect(() => {
		updateLocalState(localState);
	}, [localState]);

	return (
		<main>
			<BrowserRouter>
				<Header />
				<Routes>
					<Route path="/:idOrMode?/:mode?" Component={Home} />
					<Route path="/unlock/:personaId" Component={UnlockPersona} />
					{/* <Route path="/manage-persona/:personaId?" Component={ManagePersonas} /> */}
					<Route path="/manage-personas/:personaId?" Component={ManagePersonas} />
					{/* <Route path="/create-persona" Component={ManagePersonas} /> */}
					<Route path="/manage-spaces/:spaceHost?" Component={ManageSpaces} />
					{hostedLocally && <Route path="/tags/:tag?" Component={Tags} />}
					<Route path="/settings" Component={Settings} />
					{hostedLocally && <Route path="/test" Component={Test} />}
					<Route path="/*" element={<Navigate replace to="/" />} />
				</Routes>
			</BrowserRouter>
		</main>
	);
}

export default App;

// TODO: use Progressive Web App (PWA) like gab.com
// http://localhost:1000/1720557792387__

const Test = () => {
	// TODO: decide how to simplify the persona creation flow
	return (
		<div className="">
			<p className="">test</p>
			<form method="post" action="/login">
				{/* <TextInput required disabled label="Author ID" defaultValue="0xmike" />
				<TextInput
					required
					password
					label="Mnemonic"
					defaultValue="century shock into glow color charge"
				/>
				<Button label="Next" /> */}
				<input type="text" name="username" placeholder="Username" />
				<input type="password" name="password" placeholder="Password" />
				<button type="submit">Create persona</button>
			</form>
		</div>
	);
};
