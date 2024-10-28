import { RequestHandler } from 'express';
import { WorkingDirectory } from '../types/WorkingDirectory';

const getWorkingDirectory: RequestHandler = (req, res) => {
	res.send(WorkingDirectory.current);
};

export default getWorkingDirectory;
