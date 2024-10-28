import Ajv from 'ajv';
import { parseFile, rootSettingsPath, writeObjectFile } from '../utils/files';
import { WorkingDirectory } from './WorkingDirectory';
import env from '../utils/env';

const ajv = new Ajv();

const schema = {
	type: 'object',
	properties: {
		testWorkingDirectory: { type: 'boolean' },
		// customWorkingDirectoryPath: { type: 'string' },
	},
	required: [
		'testWorkingDirectory',
		// 'customWorkingDirectoryPath',
	],
	additionalProperties: false,
};

export class RootSettings {
	public testWorkingDirectory: boolean;
	// public customWorkingDirectoryPath?: string;

	constructor({
		testWorkingDirectory = false,
		// customWorkingDirectoryPath,
	}: {
		testWorkingDirectory?: boolean;
		// customWorkingDirectoryPath?: string;
	}) {
		if (env.GLOBAL_HOST) throw new Error('Global space cannot use RootSettings');
		this.testWorkingDirectory = testWorkingDirectory;
		// // this.customWorkingDirectoryPath = customWorkingDirectoryPath;

		if (!ajv.validate(schema, this))
			throw new Error('Invalid Root Settings: ' + JSON.stringify(this));
	}

	static get() {
		return new RootSettings(parseFile(rootSettingsPath));
	}

	overwrite() {
		if (RootSettings.get().testWorkingDirectory !== this.testWorkingDirectory) {
			WorkingDirectory.current.setUp();
		}
		writeObjectFile(rootSettingsPath, this);
	}
}
