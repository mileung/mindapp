import { RequestHandler } from 'express';
import { RootSettings } from '../types/RootSettings';
import { WorkingDirectory } from '../types/WorkingDirectory';

const getRootSettings: RequestHandler = (req, res) => {
	res.send({ rootSettings: RootSettings.get(), workingDirectory: WorkingDirectory.current });
};

export default getRootSettings;
