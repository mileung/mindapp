import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { Button } from '~/components/Button';
import DeterministicVisualId from '~/components/DeterministicVisualId';
import { LabelVal } from '~/components/LabelVal';
import TextInput from '~/components/TextInput';
import { Persona, addPersona, getUnsignedAuthor, useAnon } from '~/types/PersonasPolyfill';
import { hostedLocally, makeUrl, ping, post } from '~/utils/api';
import { clone, copyToClipboardAsync, shortenString } from '~/utils/js';
import { createKeyPair, decrypt, encrypt, signItem } from '~/utils/security';
import { defaultSpaceHost } from '~/utils/api';
import UnlockPersona from '../unlock/[personaId]';
import { A, useNavigate, useParams } from '@solidjs/router';
import { createEffect, createMemo, createSignal } from 'solid-js';
import {
	drawerOpen,
	drawerOpenSet,
	passwords,
	passwordsSet,
	personas,
	personasSet,
} from '~/utils/state';
import { check, documentDuplicate, lockClosed, user } from 'solid-heroicons/solid-mini';
import { Icon } from 'solid-heroicons';
import { getSignedAuthor } from '~/utils/signing';
import Drawer from '~/components/Drawer';
import { Title } from '@solidjs/meta';

export default function Personas() {
	let nameIpt: undefined | HTMLInputElement;
	let mnemonicIpt: undefined | HTMLInputElement;
	let passwordIpt: undefined | HTMLInputElement;
	let oldPasswordIpt: undefined | HTMLInputElement;

	const personaId = createMemo(() => useParams().personaId);
	const navigate = useNavigate();
	const [secrets, secretsSet] = createSignal('');
	const [changingPw, changingPwSet] = createSignal(false);
	const personaIndex = createMemo(() => {
		// console.log('personas:', clone(personas));
		return personas.findIndex((p) => p.id === personaId());
	});
	const selectedPersona = createMemo(() =>
		personaIndex() === -1 ? undefined : personas[personaIndex()],
	);
	const frozen = createMemo(() => selectedPersona()?.frozen);

	const addPersonaHere = async () => {
		try {
			const newPersona = addPersona({
				mnemonic: mnemonicIpt!.value,
				name: nameIpt!.value.trim(),
				password: passwordIpt!.value,
			});
			navigate(`/personas/${newPersona.id}`);
		} catch (error) {
			alert(error);
		}
	};

	createEffect((p) => {
		if (p === personaIndex()) return p;
		secretsSet('');
		if (nameIpt && passwordIpt && selectedPersona()) {
			nameIpt.value = selectedPersona()!.name || '';
		}
		return personaIndex();
	});

	const PersonaList = () => {
		return (
			<div class="flex-1 relative w-52">
				<div class="sticky top-12 h-full sm:p-3 flex flex-col max-h-[calc(100vh-3rem)] overflow-scroll">
					<div class="overflow-scroll border-b border-mg1 mb-1">
						{personas
							.filter((p) => !!p.id)
							.sort((a, b) =>
								a.name && b.name
									? a.name.toLowerCase().localeCompare(b.name.toLowerCase())
									: a.name
									? -1
									: b.name
									? 1
									: a.id!.toLowerCase().localeCompare(b.id!.toLowerCase()),
							)
							.map((persona) => {
								return (
									<A
										href={`/personas/${persona!.id}`}
										class={`rounded h-14 fx transition hover:bg-mg1 pl-2 py-1 ${
											persona!.id === personaId() ? 'bg-mg1' : ''
										}`}
										onClick={() => drawerOpenSet(false)}
									>
										<DeterministicVisualId
											input={persona!.id}
											class="h-6 w-6 overflow-hidden rounded-full"
										/>
										<div class="flex-1 mx-2 truncate">
											<p
												class={`text-lg font-semibold leading-5 ${
													!persona!.name && 'text-fg2'
												} truncate`}
											>
												{!persona!.id ? 'Anon' : persona!.name || 'No name'}
											</p>
											<p class="font-mono text-fg2 leading-5">{shortenString(persona!.id!)}</p>
										</div>
										<div class="ml-auto mr-1 xy w-5">
											{persona!.id === personas[0].id ? (
												<Icon path={check} class="h-5 w-5" />
											) : (
												passwords[persona.id] === undefined && (
													<Icon path={lockClosed} class="h-4 w-4 text-fg2" />
												)
											)}
										</div>
									</A>
								);
							})}
					</div>
					<A
						href={'/personas'}
						class={`rounded h-10 fx transition hover:bg-mg1 px-2 py-1 ${!personaId() && 'bg-mg1'}`}
						onClick={() => drawerOpenSet(false)}
					>
						<div class="h-6 w-6 xy">
							<Icon path={user} class="h-6 w-6" />
						</div>
						<p class="ml-1.5 text-lg font-semibold">Add persona</p>
					</A>
				</div>
			</div>
		);
	};

	return (
		personas && (
			<div class="flex">
				<Title>Personas | Mindapp</Title>
				<Drawer
					width="w-52"
					hideWidth="sm:hidden"
					isOpen={drawerOpen}
					onClose={() => drawerOpenSet(false)}
				>
					<div>
						<PersonaList />
					</div>
				</Drawer>
				<div class="hidden sm:block">
					<PersonaList />
				</div>
				<div class="flex-1 space-y-3 p-3">
					{selectedPersona() ? (
						<>
							{selectedPersona()!.id && passwords[selectedPersona()!.id] === undefined ? (
								<UnlockPersona manage />
							) : (
								<>
									<div class="flex gap-3">
										<DeterministicVisualId
											input={selectedPersona()!.id}
											class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full"
										/>
										<div>
											<p
												class={`leading-7 font-bold text-2xl ${
													!selectedPersona()!.name && 'text-fg2'
												} `}
											>
												{selectedPersona()!.name || 'No name'}
											</p>
											<p class="text-lg text-fg2 font-semibold break-all">{personaId()}</p>
										</div>
									</div>
									<p class="text-2xl font-semibold mb-1">Public info</p>
									{frozen() ? (
										<LabelVal label="Name" value={selectedPersona()!.name} />
									) : (
										<TextInput
											ref={(t) => (nameIpt = t)}
											defaultValue={selectedPersona()!.name}
											label="Name"
											placeholder="No name"
											maxLength={100}
											onSubmit={async (name) => {
												const unsignedAuthor = getUnsignedAuthor({ ...selectedPersona()!, name });
												const signedAuthor = await getSignedAuthor(unsignedAuthor);
												personasSet((old) => {
													old[personaIndex()] = { ...old[personaIndex()], ...signedAuthor };
													return clone(old);
												});
											}}
										/>
									)}
									<LabelVal label="Frozen" value={frozen() ? 'True' : 'False'} />
									{hostedLocally && (
										<LabelVal label="Wallet address" value={selectedPersona()!.walletAddress} />
									)}
									<p class="text-2xl font-semibold mb-1">Security</p>
									<Button
										label="Lock persona"
										onClick={() => {
											passwordsSet((old) => ({ ...old, [personaId()]: undefined }));
											useAnon();
										}}
									/>
									<Button
										label={changingPw() ? 'Keep password' : 'Change password'}
										onClick={() => {
											changingPwSet(!changingPw());
											oldPasswordIpt?.focus();
										}}
									/>
									{changingPw() && (
										<>
											<TextInput password ref={(t) => (oldPasswordIpt = t)} label="Old password" />
											<TextInput
												password
												showCheckX
												label="New password"
												onSubmit={async (newPassword) => {
													const decryptedMnemonic = decrypt(
														selectedPersona()!.encryptedMnemonic!,
														oldPasswordIpt!.value,
													);
													if (decryptedMnemonic === null) return alert('Incorrect password');
													if (validateMnemonic(decryptedMnemonic, wordlist)) {
														passwordsSet((old) => ({ ...old, [personaId()]: newPassword }));
													}
													personasSet((old) => {
														old[personaIndex()].encryptedMnemonic = encrypt(
															decryptedMnemonic,
															newPassword,
														);
														return clone(old);
													});
													changingPwSet(false);
												}}
											/>
										</>
									)}
									<Button
										label={secrets() ? 'Hide secret mnemonic' : 'Show secret mnemonic'}
										onClick={async () => {
											if (secrets()) return secretsSet('');
											const pw = prompt(
												`Enter password to show mnemonic for ${
													selectedPersona()!.name || 'No name'
												}`,
											);
											if (pw === null) return;
											const mnemonic = decrypt(selectedPersona()!.encryptedMnemonic!, pw);
											if (!validateMnemonic(mnemonic || '', wordlist)) {
												return alert('Incorrect password');
											}
											secretsSet(mnemonic!);
										}}
									/>
									{secrets() && (
										<div class="">
											<button
												class="fx text-fg2 transition hover:text-fg1"
												onClick={() => copyToClipboardAsync(secrets())}
											>
												<Icon path={documentDuplicate} class="mr-1 w-5" />
												<p class="font-semibold">Copy mnemonic</p>
											</button>
											<div class="grid grid-cols-4 gap-2">
												{secrets()
													.split(' ')
													.map((word, i) => {
														return (
															<p class="font-medium">
																{i + 1}. {word}
															</p>
														);
													})}
											</div>
										</div>
									)}
									<p class="text-2xl font-semibold mb-1">Danger zone</p>
									<Button
										label="Remove persona"
										onClick={async () => {
											const mnemonic = prompt(
												`Enter mnemonic to remove ${
													selectedPersona()!.name || 'No name'
												}\n\nThe only way to restore this persona is to re-enter its mnemonic`,
											);
											if (mnemonic === null) return;
											const deleted =
												validateMnemonic(mnemonic, wordlist) &&
												mnemonic ===
													decrypt(
														personas[personaIndex()].encryptedMnemonic!,
														passwords[personaId()],
													);
											if (!deleted) return alert('Invalid mnemonic');
											// I'm using filter cuz using splice leaves and empty proxy object in the array
											personasSet((old) => clone(old.filter((_, i) => i !== personaIndex())));
											navigate('/personas');
										}}
									/>
									{!frozen() && (
										<Button
											label="Mark as frozen"
											onClick={async () => {
												const hosts = selectedPersona()!
													.spaceHosts.filter((h) => !!h)
													.join(', ');
												const mnemonic = prompt(
													`Enter mnemonic to inform the following hosts that this persona (${
														selectedPersona()!.name || 'No name'
													}) has been frozen: ${hosts}\n\nThis will block all read and write activity from this persona\n\nYou may want to do this for archival or security reasons`,
												);
												if (mnemonic === null) return;

												const frozen =
													!validateMnemonic(mnemonic, wordlist) &&
													mnemonic ===
														decrypt(
															personas[personaIndex()].encryptedMnemonic!,
															passwords[personaId()!],
														);

												if (!frozen) return alert('Invalid mnemonic');
												const unsignedAuthor = getUnsignedAuthor({ ...selectedPersona()!, frozen });
												const signedAuthor = await getSignedAuthor(unsignedAuthor);
												personasSet((old) => {
													old[personaIndex()] = { ...old[personaIndex()], ...signedAuthor };
													return clone(old);
												});
											}}
										/>
									)}
								</>
							)}
						</>
					) : personaIndex() === -1 && personaId() ? (
						<div class="">
							<p class="font-bold text-2xl">Persona not found</p>
						</div>
					) : (
						<>
							<div class="">
								<p class="font-bold text-2xl">Add a new persona</p>
								<p class="font-semibold text-xl text-fg2">
									A persona is a digital identity other Mindapp users will recognize you by
								</p>
							</div>
							<TextInput
								autofocus
								ref={(t) => (nameIpt = t)}
								label="Name"
								placeholder="No name"
								onSubmit={addPersonaHere}
							/>
							<TextInput
								password
								ref={(t) => (mnemonicIpt = t)}
								label="Mnemonic"
								onSubmit={addPersonaHere}
							/>
							<TextInput
								password
								ref={(t) => (passwordIpt = t)}
								label="Password"
								onSubmit={addPersonaHere}
							/>
							<Button label="Add persona" onClick={addPersonaHere} />
						</>
					)}
				</div>
			</div>
		)
	);
}
