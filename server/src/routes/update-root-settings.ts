import { RequestHandler } from 'express';
import { RootSettings } from '../types/RootSettings';
import { WorkingDirectory } from '../types/WorkingDirectory';

const updateRootSettings: RequestHandler = (req, res) => {
	const rootSettings = new RootSettings({ ...RootSettings.get(), ...req.body });
	rootSettings.overwrite();
	res.send({ rootSettings, workingDirectory: WorkingDirectory.current });
};

export default updateRootSettings;
