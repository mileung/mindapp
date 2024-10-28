import os from 'os';
import fs from 'fs';
import path from 'path';
import env from './env';

const homeDir = os.homedir();
export const mindappRootPath = path.join(homeDir, '.mindapp');
export const rootSettingsPath = path.join(mindappRootPath, 'root-settings.json');
export const defaultWorkingDirectoryPath = path.join(mindappRootPath, 'default-working-directory');
export const testWorkingDirectoryPath = path.join(mindappRootPath, 'test-working-directory');

export const writeFile = (filePath: string, json: string) => {
	if (env.GLOBAL_HOST) throw new Error('Global space cannot write filesystem');
	fs.writeFileSync(filePath, json);
};

export const writeObjectFile = (filePath: string, obj: object, format = false) => {
	if (env.GLOBAL_HOST) throw new Error('Global space cannot write filesystem');
	writeFile(filePath, JSON.stringify(obj, null, format ? 2 : 0));
};

export const parseFile = <T>(filePath: string) => {
	if (env.GLOBAL_HOST) throw new Error('Global space cannot read filesystem');
	return JSON.parse(fs.readFileSync(filePath).toString()) as T;
};

export const mkdirIfDne = (dirPath: string) => {
	if (env.GLOBAL_HOST) throw new Error('Global space cannot write filesystem');
	if (!isDirectory(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
		return true;
	}
	return false;
};

export const touchIfDne = (filePath: string, fileContent: string) => {
	if (env.GLOBAL_HOST) throw new Error('Global space cannot write filesystem');
	const dirPath = path.dirname(filePath);
	mkdirIfDne(dirPath);
	if (!isFile(filePath)) {
		writeFile(filePath, fileContent);
		return true;
	}
	return false;
};

export function isFile(path: string) {
	if (env.GLOBAL_HOST) throw new Error('Global space cannot read filesystem');
	try {
		return fs.statSync(path).isFile();
	} catch (error) {}
	return false;
}

export function isDirectory(path: string) {
	if (env.GLOBAL_HOST) throw new Error('Global space cannot read filesystem');
	try {
		return fs.statSync(path).isDirectory();
	} catch (error) {}
	return false;
}

export const deleteFile = (path: string, cb: fs.NoParamCallback = () => {}) => {
	if (env.GLOBAL_HOST) throw new Error('Global space cannot write filesystem');
	try {
		if (isFile(path)) {
			fs.unlink(path, cb);
		} else {
			console.error(`File path does not exist: ${path}`);
		}
	} catch (error) {
		console.error(`Error deleting file path: ${path}`, error);
	}
};
