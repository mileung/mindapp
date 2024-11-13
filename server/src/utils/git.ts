import simpleGit from 'simple-git';
import { debounce } from './performance';
import { hour } from './time';
import { WorkingDirectory } from '../types/WorkingDirectory';
import env from './env';

const snapshot = () => {
	const cw = WorkingDirectory.current;
	if (!cw.gitSnapshotsEnabled) return;
	const git = simpleGit(cw.dirPath);
	console.log('snapshot');
	git //
		.add(['timeline', 'tag-tree.json'])
		.commit(`Snapshot at ${Date.now()}`);
	if (cw.gitRemoteUrl) {
		const remoteName = 'origin';
		const branchName = 'master';
		git
			.removeRemote(remoteName) // in case the url changes
			.addRemote(remoteName, cw.gitRemoteUrl)
			.push(['-u', remoteName, branchName], (e) => {
				e
					? console.error('Error pushing to remote:', e)
					: console.log(`Changes pushed to ${remoteName} (${cw.gitRemoteUrl})`);
			});
	}
};

const _debouncedSnapshot = debounce(snapshot, hour);
export const debouncedSnapshot = () => {
	if (env.GLOBAL_HOST) return; // TODO: allow global spaces to snapshot somehow
	console.log('debouncedSnapshot');
	_debouncedSnapshot();
};
