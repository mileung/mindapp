import { ArrowTopRightOnSquareIcon } from '@heroicons/react/16/solid';
import { useCallback, useEffect } from 'react';
import { hostedLocally, makeUrl, ping, post } from '../utils/api';
import { RootSettings, WorkingDirectory } from '../utils/settings';
import { useLocalState, usePersonas, useRootSettings, useWorkingDirectory } from '../utils/state';
import { InputPicker } from '../components/InputPicker';
import TextInput, { useTextInputRef } from '../components/TextInput';

export default function Settings() {
	const [localState, localStateSet] = useLocalState();
	const [rootSettings, rootSettingsSet] = useRootSettings();
	const [workingDirectory, workingDirectorySet] = useWorkingDirectory();
	const [personas, personasSet] = usePersonas();
	const keybaseGitUrlIpt = useTextInputRef();

	const updateRootSettings = useCallback((update: Partial<RootSettings>) => {
		ping<{ rootSettings: RootSettings; workingDirectory: WorkingDirectory }>(
			makeUrl('update-root-settings'),
			post(update),
		)
			.then(({ rootSettings, workingDirectory }) => {
				rootSettingsSet(rootSettings);
				workingDirectorySet(workingDirectory);
			})
			.catch((err) => alert(err));
	}, []);

	const updateWorkingDirectory = useCallback(
		(update: Partial<WorkingDirectory>) => {
			ping<WorkingDirectory>(makeUrl('update-working-directory'), post(update))
				.then((u) => workingDirectorySet(u))
				.catch((err) => alert(err));
		},
		[rootSettings?.testWorkingDirectory],
	);

	useEffect(() => {
		keybaseGitUrlIpt.value = workingDirectory?.gitRemoteUrl || '';
	}, [workingDirectory?.gitRemoteUrl]);

	return (
		<div className="p-3 space-y-3">
			<p className="text-2xl font-semibold">Local settings</p>
			<InputPicker
				title="Theme"
				options={['System', 'Light', 'Dark']}
				value={localState.theme}
				// @ts-ignore // QUESTION how do I change the type of onSubmit for Settings['theme']
				onSubmit={(theme: Settings['theme']) => localStateSet({ ...localState, theme })}
			/>

			{!hostedLocally && (
				<p className="text-lg text-fg2 font-medium">
					More settings are available if you{' '}
					<a
						target="_blank"
						href="TODO:"
						className="transition text-sky-600 text hover:text-sky-500 dark:text-cyan-400 dark:hover:text-cyan-300"
					>
						run Mindapp locally
					</a>
				</p>
			)}
			{rootSettings !== undefined && workingDirectory !== undefined && (
				<>
					{rootSettings && (
						<>
							<p className="text-2xl font-semibold">Root settings</p>
							<div className="">
								<InputPicker
									title="Working directory path"
									options={['Default', 'Test']}
									value={rootSettings.testWorkingDirectory ? 'Test' : 'Default'}
									// @ts-ignore
									onSubmit={(mode: 'Default' | 'Test') => {
										updateRootSettings({ testWorkingDirectory: mode === 'Test' });
										personasSet((old) => {
											old.splice(
												0,
												0,
												old.splice(
													old.findIndex((p) => p.id === ''),
													1,
												)[0],
											);
											return [...old];
										});
									}}
								/>
								{workingDirectory?.dirPath && (
									<button
										// disabled={rootSettings.testWorkingDirectory}
										className="mt-1 fx gap-1 transition text-fg2 hover:text-fg1"
										onClick={() => {
											ping(makeUrl('show-working-directory'));
										}}
									>
										<p className="leading-7 text-2xl font-medium">{workingDirectory.dirPath}</p>
										<ArrowTopRightOnSquareIcon className="h-6 w-6" />
									</button>
								)}
							</div>
						</>
					)}
					<p className="text-2xl font-semibold">Working directory settings</p>
					{workingDirectory === null ? (
						<p className="text-2xl font-semibold text-fg2">No working directory found</p>
					) : (
						<>
							<InputPicker
								title="Git snapshots for thoughts and tags"
								options={['On', 'Off']}
								value={workingDirectory.gitSnapshotsEnabled ? 'On' : 'Off'}
								onSubmit={(v) => updateWorkingDirectory({ gitSnapshotsEnabled: v === 'On' })}
							/>
							<TextInput
								label="Keybase git url"
								_ref={keybaseGitUrlIpt}
								defaultValue={workingDirectory.gitRemoteUrl || ''}
								onSubmit={(v) => updateWorkingDirectory({ gitRemoteUrl: v })}
							/>
						</>
					)}
				</>
			)}
		</div>
	);
}
