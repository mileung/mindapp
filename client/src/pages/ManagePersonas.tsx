import {
	CheckIcon,
	DocumentDuplicateIcon,
	LockClosedIcon,
	UserIcon,
} from '@heroicons/react/16/solid';
import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { wallet } from '@vite/vitejs/es5';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import DeterministicVisualId from '../components/DeterministicVisualId';
import { LabelVal } from '../components/LabelVal';
import TextInput, { useTextInputRef } from '../components/TextInput';
import { Persona, getUnsignedAuthor, passwords } from '../types/PersonasPolyfill';
import { hostedLocally, makeUrl, ping, post } from '../utils/api';
import { copyToClipboardAsync, shortenString } from '../utils/js';
import { createKeyPair, decrypt, encrypt, signItem } from '../utils/security';
import { defaultSpaceHost, useGetSignedAuthor, usePersonas } from '../utils/state';
import UnlockPersona from './UnlockPersona';

export default function ManagePersonas() {
	const { personaId } = useParams();
	const [personas, personasSet] = usePersonas();
	const getSignedAuthor = useGetSignedAuthor();
	const navigate = useNavigate();
	const [secrets, secretsSet] = useState('');
	const [changingPw, changingPwSet] = useState(false);
	const personaIndex = useMemo(
		() => personas.findIndex((p) => p.id === personaId),
		[personaId, personas],
	);
	const persona = useMemo(
		() => (personaIndex === -1 ? undefined : personas[personaIndex]),
		[personaId, personas],
	);
	const frozen = useMemo(() => persona?.frozen, [persona]);
	const nameIpt = useTextInputRef();
	const mnemonicIpt = useTextInputRef();
	const passwordIpt = useTextInputRef();
	const oldPasswordIpt = useTextInputRef();

	useEffect(() => {
		secretsSet('');
		if (persona) {
			nameIpt.value = persona.name || '';
			passwordIpt.value = '';
		}
	}, [persona]);

	const addPersona = useCallback(async () => {
		let newPersona: Persona;
		if (hostedLocally) {
			newPersona = await ping<Persona>(
				makeUrl('add-persona'),
				post({
					password: passwordIpt.value,
					mnemonic: mnemonicIpt.value,
					name: nameIpt.value.trim(),
				}),
			);
		} else {
			const mnemonic = mnemonicIpt.value || generateMnemonic(wordlist, 256);
			if (!validateMnemonic(mnemonic, wordlist)) {
				return (mnemonicIpt.error = 'Invalid mnemonic');
			}
			const kp = createKeyPair(mnemonic);
			const unsignedAuthor = getUnsignedAuthor({
				id: kp.publicKey,
				name: nameIpt.value.trim(),
				walletAddress: wallet.deriveAddress({ mnemonics: mnemonic, index: 0 }).address,
			});
			const signedAuthor = {
				...unsignedAuthor,
				signature: signItem(unsignedAuthor, kp.privateKey),
			};
			passwords[kp.publicKey] = passwordIpt.value;
			newPersona = {
				...signedAuthor,
				encryptedMnemonic: encrypt(mnemonic, passwordIpt.value),
				spaceHosts: [defaultSpaceHost],
			};
		}
		personasSet((old) => {
			old.unshift(newPersona);
			navigate(`/manage-personas/${newPersona.id}`);
			return [...old];
		});
	}, []);

	return (
		personas && (
			<div className="flex">
				<div className="flex-1 relative min-w-40 max-w-56">
					<div className="sticky top-12 h-full p-3 flex flex-col max-h-[calc(100vh-3rem)] overflow-scroll">
						<div className="overflow-scroll border-b border-mg1 mb-1">
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
										<Link
											key={persona.id}
											to={`/manage-personas/${persona.id}`}
											className={`rounded h-14 fx transition hover:bg-mg1 pl-2 py-1 ${persona.id === personaId ? 'bg-mg1' : 'bg-bg1'}`}
										>
											<DeterministicVisualId
												input={persona.id}
												className="h-6 w-6 overflow-hidden rounded-full"
											/>
											<div className="flex-1 mx-2 truncate">
												<p
													className={`text-lg font-semibold leading-5 ${!persona.name && 'text-fg2'} truncate`}
												>
													{!persona.id ? 'Anon' : persona.name || 'No name'}
												</p>
												<p className="font-mono text-fg2 leading-5">{shortenString(persona.id!)}</p>
											</div>
											<div className="ml-auto mr-1 xy w-5">
												{persona.id === personas[0].id ? (
													<CheckIcon className="h-5 w-5" />
												) : (
													persona.locked && <LockClosedIcon className="h-4 w-4 text-fg2" />
												)}
											</div>
										</Link>
									);
								})}
						</div>
						<Link
							to={'/manage-personas'}
							className={`rounded h-10 fx transition hover:bg-mg1 px-2 py-1 ${!personaId && 'bg-mg1'}`}
						>
							<div className="h-6 w-6 xy">
								<UserIcon className="h-6 w-6" />
							</div>
							<p className="ml-1.5 text-lg font-semibold">Add persona</p>
						</Link>
					</div>
				</div>
				<div className="flex-1 space-y-3 p-3">
					{persona ? (
						<>
							{persona?.locked ? (
								<>
									<UnlockPersona manage />
								</>
							) : (
								<>
									<div className="flex gap-3">
										<DeterministicVisualId
											input={persona.id}
											className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full"
										/>
										<div>
											<p className={`leading-7 font-bold text-2xl ${!persona.name && 'text-fg2'} `}>
												{persona.name || 'No name'}
											</p>
											<p className="text-lg text-fg2 font-semibold break-all">{personaId}</p>
										</div>
									</div>
									<p className="text-2xl font-semibold mb-1">Public info</p>
									{frozen ? (
										<LabelVal label="Name" value={persona.name} />
									) : (
										<TextInput
											_ref={nameIpt}
											defaultValue={persona.name}
											label="Name"
											placeholder="No name"
											maxLength={100}
											onSubmit={async (name) => {
												const unsignedAuthor = getUnsignedAuthor({ ...persona, name });
												const signedAuthor = await getSignedAuthor(unsignedAuthor);
												personasSet((old) => {
													old[personaIndex] = { ...old[personaIndex], ...signedAuthor };
													return [...old];
												});
											}}
										/>
									)}
									<LabelVal label="Frozen" value={frozen ? 'True' : 'False'} />
									{hostedLocally && (
										<LabelVal label="Wallet address" value={persona.walletAddress} />
									)}
									<p className="text-2xl font-semibold mb-1">Security</p>
									<Button
										label={changingPw ? 'Keep password' : 'Change password'}
										onClick={() => changingPwSet(!changingPw)}
									/>
									{changingPw && (
										<>
											<TextInput password _ref={oldPasswordIpt} label="Old password" />
											<TextInput
												password
												showCheckX
												label="New password"
												onSubmit={async (newPassword) => {
													if (!personaId) return;
													let changed = false;
													if (hostedLocally) {
														changed = (
															await ping<{ changed: boolean }>(
																makeUrl('update-persona-password'),
																post({
																	personaId,
																	oldPassword: oldPasswordIpt.value,
																	newPassword,
																}),
															)
														).changed;
													} else {
														const decryptedMnemonic = decrypt(
															persona.encryptedMnemonic!,
															oldPasswordIpt.value,
														);
														if (validateMnemonic(decryptedMnemonic || '', wordlist)) {
															persona.encryptedMnemonic = encrypt(
																decryptedMnemonic || '',
																newPassword,
															);
															passwords[personaId] = newPassword;
															changed = true;
														}
													}
													if (!changed) {
														return (oldPasswordIpt.error = 'Incorrect password');
													}

													changingPwSet(false);

													personasSet((old) => {
														return [...old];
													});
												}}
											/>
										</>
									)}
									<Button
										label={secrets ? 'Hide secret mnemonic' : 'Show secret mnemonic'}
										onClick={async () => {
											if (secrets) return secretsSet('');
											const pw = prompt(
												`Enter password to show mnemonic for ${persona.name || 'No name'}`,
											);
											if (pw === null) return false;
											let mnemonic = '';
											if (hostedLocally) {
												mnemonic = (
													await ping<{ mnemonic: string }>(
														makeUrl('get-persona-mnemonic'),
														post({ personaId, password: pw }),
													)
												).mnemonic;
											} else {
												const persona = personas[personaIndex];
												mnemonic = decrypt(persona.encryptedMnemonic || '', pw) || '';
											}

											if (!validateMnemonic(mnemonic, wordlist)) {
												return alert('Incorrect password');
											}
											secretsSet(mnemonic);
										}}
									/>
									{secrets && (
										<div className="">
											<button
												className="fx text-fg2 transition hover:text-fg1"
												onClick={() => copyToClipboardAsync(secrets)}
											>
												<DocumentDuplicateIcon className="mr-1 w-5" />
												<p className="font-semibold">Copy mnemonic</p>
											</button>
											<div className="grid grid-cols-4 gap-2">
												{secrets.split(' ').map((word, i) => {
													return (
														<p key={i} className="font-medium">
															{i + 1}. {word}
														</p>
													);
												})}
											</div>
										</div>
									)}
									<p className="text-2xl font-semibold mb-1">Danger zone</p>
									<Button
										label="Remove persona"
										onClick={async () => {
											let deleted = false;
											const mnemonic = prompt(
												`Enter mnemonic to remove ${persona.name || 'No name'}\n\nThe only way to restore this persona is to re-enter its mnemonic`,
											);
											if (mnemonic === null) return;
											if (hostedLocally) {
												deleted = (
													await ping<{ valid: boolean }>(
														makeUrl('validate-persona-mnemonic'),
														post({ personaId, mnemonic }),
													)
												).valid;
											} else {
												deleted =
													!validateMnemonic(mnemonic, wordlist) &&
													mnemonic ===
														decrypt(
															personas[personaIndex].encryptedMnemonic!,
															passwords[personaId!],
														);
											}
											if (!deleted) return alert('Invalid mnemonic');
											personasSet((old) => {
												old.splice(personaIndex, 1);
												return [...old];
											});
										}}
									/>
									{!frozen && (
										<Button
											label="Mark as frozen"
											onClick={async () => {
												let frozen = false;
												const hosts = persona.spaceHosts.filter((h) => !!h).join(', ');
												const mnemonic = prompt(
													`Enter mnemonic to inform the following hosts that this persona (${persona.name || 'No name'}) has been frozen: ${hosts}\n\nThis will block all read and write activity from this persona\n\nYou may want to do this for archival or security reasons`,
												);
												if (mnemonic === null) return;
												if (hostedLocally) {
													frozen = (
														await ping<{ valid: boolean }>(
															makeUrl('validate-persona-mnemonic'),
															post({ personaId, mnemonic }),
														)
													).valid;
												} else {
													frozen =
														!validateMnemonic(mnemonic, wordlist) &&
														mnemonic ===
															decrypt(
																personas[personaIndex].encryptedMnemonic!,
																passwords[personaId!],
															);
												}
												if (!frozen) return alert('Invalid mnemonic');
												const unsignedAuthor = getUnsignedAuthor({ ...persona, frozen });
												const signedAuthor = await getSignedAuthor(unsignedAuthor);
												personasSet((old) => {
													old[personaIndex] = { ...old[personaIndex], ...signedAuthor };
													return [...old];
												});
											}}
										/>
									)}
								</>
							)}
						</>
					) : personaIndex === -1 && personaId ? (
						<div className="">
							<p className="font-bold text-2xl">Persona not found</p>
						</div>
					) : (
						<>
							<div className="">
								<p className="font-bold text-2xl">Add a new persona</p>
								<p className="font-semibold text-xl text-fg2">
									A persona is a digital identity other Mindapp users will recognize you by
								</p>
							</div>
							<TextInput
								autoFocus
								_ref={nameIpt}
								label="Name"
								placeholder="No name"
								onSubmit={addPersona}
							/>
							<TextInput password _ref={mnemonicIpt} label="Mnemonic" onSubmit={addPersona} />
							<TextInput password _ref={passwordIpt} label="Password" onSubmit={addPersona} />
							<Button label="Add persona" onClick={addPersona} />
						</>
					)}
				</div>
			</div>
		)
	);
}
