import {
	personasSet,
	rootSettings,
	rootSettingsSet,
	themeMode,
	workingDirectory,
	workingDirectorySet,
} from '~/utils/state';
import { hostedLocally, makeUrl, ping, post } from '../utils/api';
import { RootSettings, WorkingDirectory } from '../utils/settings';
import { InputPicker } from '~/components/InputPicker';
import TextInput from '~/components/TextInput';
import { Icon } from 'solid-heroicons';
import { arrowTopRightOnSquare } from 'solid-heroicons/solid-mini';
import { setThemeMode } from '~/utils/theme';
import { clone } from '~/utils/js';

export default function Settings() {
	const updateRootSettings = (update: Partial<RootSettings>) => {
		ping<{ rootSettings: RootSettings; workingDirectory: WorkingDirectory }>(
			makeUrl('update-root-settings'),
			post(update),
		)
			.then(({ rootSettings, workingDirectory }) => {
				rootSettingsSet(rootSettings);
				workingDirectorySet(workingDirectory);
			})
			.catch((err) => alert(err));
	};

	const updateWorkingDirectory = (update: Partial<WorkingDirectory>) => {
		ping<WorkingDirectory>(makeUrl('update-working-directory'), post(update))
			.then((u) => workingDirectorySet(u))
			.catch((err) => alert(err));
	};

	return (
		<div class="p-3 space-y-3">
			<p class="text-2xl font-semibold">Local settings</p>
			<InputPicker
				title="Theme"
				options={[
					['System', 'system'],
					['Light', 'light'],
					['Dark', 'dark'],
				]}
				value={themeMode}
				// @ts-ignore // QUESTION how do I change the type of onSubmit for Settings['theme']
				onSubmit={(mode) => setThemeMode(mode)}
			/>

			{!hostedLocally ? (
				<p class="text-lg text-fg2 font-medium">
					More settings are available if you{' '}
					<a
						target="_blank"
						href="TODO:"
						class="transition text-sky-600 text hover:text-sky-500 dark:text-cyan-400 dark:hover:text-cyan-300"
					>
						run Mindapp locally
					</a>
				</p>
			) : (
				<>
					<p class="text-2xl font-semibold">Root settings</p>
					{/* <InputPicker
						title="Working directory path"
						options={[
							['Default', 'default'],
							['Test', 'test'],
						]}
						value={() => (rootSettings.testWorkingDirectory ? 'test' : 'default')}
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
								return clone(old);
							});
						}}
					/> */}
					<p class="text-xl font-semibold">Current working directory</p>
					<button
						// disabled={rootSettings.testWorkingDirectory}
						class="mt-1 fx gap-1 transition text-fg2 hover:text-fg1"
						onClick={() => {
							ping(makeUrl('show-working-directory'));
						}}
					>
						<p class="leading-7 text-2xl font-medium">{workingDirectory.dirPath}</p>
						<Icon path={arrowTopRightOnSquare} class="h-6 w-6" />
					</button>

					<p class="text-2xl font-semibold">Working directory settings</p>
					<InputPicker
						title="Git snapshots for thoughts and tags"
						options={[
							['On', 'on'],
							['Off', 'off'],
						]}
						value={() => (workingDirectory.gitSnapshotsEnabled ? 'on' : 'off')}
						onSubmit={(v) => updateWorkingDirectory({ gitSnapshotsEnabled: v === 'on' })}
					/>
					<TextInput
						label="Keybase git url"
						defaultValue={workingDirectory.gitRemoteUrl || ''}
						onSubmit={(v) => updateWorkingDirectory({ gitRemoteUrl: v })}
					/>
				</>
			)}
		</div>
	);
}
