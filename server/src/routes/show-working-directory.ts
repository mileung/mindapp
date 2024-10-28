import child_process from 'child_process';
import { RequestHandler } from 'express';
import { WorkingDirectory } from '../types/WorkingDirectory';

const showWorkingDirectory: RequestHandler = (req, res) => {
	const { dirPath } = WorkingDirectory.current;
	dirPath && dirOpen(dirPath);
	res.send({});
};

export default showWorkingDirectory;

function dirOpen(dirPath: string) {
	let command = '';
	switch (process.platform) {
		case 'darwin':
			command = 'open';
			break;
		case 'win32':
			command = 'explorer';
			break;
		default:
			command = 'xdg-open';
			break;
	}
	console.log('child_process.execSync', `${command} "${dirPath}"`);
	return child_process.execSync(`${command} "${dirPath}"`);
}
