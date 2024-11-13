import { Button } from '~/components/Button';
import DeterministicVisualId from '~/components/DeterministicVisualId';
import TextInput from '~/components/TextInput';
import { decrypt } from '~/utils/security';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { hostedLocally, makeUrl, ping, post } from '~/utils/api';
import { useNavigate, useParams } from '@solidjs/router';
import { passwordsSet, personas, personasSet } from '~/utils/state';
import { createEffect, createMemo } from 'solid-js';
import { lockClosed } from 'solid-heroicons/solid-mini';
import { Icon } from 'solid-heroicons';
import { Title } from '@solidjs/meta';

export default function UnlockPersona({ manage }: { manage?: boolean }) {
	const { personaId } = useParams();
	const navigate = useNavigate();
	let passwordIpt: undefined | HTMLInputElement;

	const selectedPersona = createMemo(() => {
		return personas.find((p) => p.id === personaId) || null;
	});

	const unlockPersona = async () => {
		if (!selectedPersona()) return;
		const password = passwordIpt!.value;
		const decryptedMnemonic = decrypt(selectedPersona()?.encryptedMnemonic!, password);

		if (!validateMnemonic(decryptedMnemonic || '', wordlist)) {
			alert('Incorrect password');
			passwordIpt?.focus();
			// passwordIpt?.error = 'Incorrect password';
			return;
		}
		passwordsSet((old) => ({ ...old, [personaId]: password }));
		personasSet((old) => {
			old.splice(
				old.findIndex((p) => p.id === selectedPersona()!.id),
				1,
			);
			!manage && navigate('/');
			return [{ ...selectedPersona()! }, ...old];
		});
	};

	// createEffect(() => passwordIpt?.focus(), [personaId]);

	return (
		<div class={`space-y-3 ${!manage && 'p-3'}`}>
			<Title>Unlock | Mindapp</Title>
			{personas && !selectedPersona() ? (
				<>
					<p class="font-bold text-2xl">Persona not found</p>
					<Button label="Manage personas" href="/personas" />
				</>
			) : (
				<>
					<div class="flex gap-3">
						<DeterministicVisualId
							input={selectedPersona()!.id}
							class="h-14 w-14 flex-shrink-0 overflow-hidden rounded-full"
						/>
						<div>
							<div class="fx gap-1">
								<p
									class={`leading-7 font-bold text-2xl ${!selectedPersona()!.name && 'text-fg2'} `}
								>
									{selectedPersona()!.name || 'No name'}
								</p>
								<Icon path={lockClosed} class="h-6 w-6" />
							</div>
							<p class="text-lg text-fg2 font-semibold break-all">{personaId}</p>
						</div>
					</div>
					<TextInput
						password
						ref={(t) => {
							passwordIpt = t;
							setTimeout(() => t.focus(), 0);
						}}
						label="Password"
						onSubmit={() => unlockPersona()}
					/>
					{/* TODO: Save password checkbox */}
					<Button label="Unlock selectedPersona()" onClick={() => unlockPersona()} />
				</>
			)}
		</div>
	);
}
