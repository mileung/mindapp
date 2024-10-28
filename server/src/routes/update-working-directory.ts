import { RequestHandler } from 'express';
import { WorkingDirectory } from '../types/WorkingDirectory';
import { debouncedSnapshot } from '../utils/git';

const updateWorkingDirectory: RequestHandler = (req, res) => {
	const updatedWorkingDirectory = new WorkingDirectory({
		...WorkingDirectory.current,
		...req.body,
	});
	updatedWorkingDirectory.overwrite();
	res.send(updatedWorkingDirectory);
	debouncedSnapshot();
};

export default updateWorkingDirectory;
