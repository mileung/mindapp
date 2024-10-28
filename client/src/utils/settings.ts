import { Author } from '../types/Author';
import { TagTree } from './tags';

export type RootSettings = {
	testWorkingDirectory: boolean;
};

export type WorkingDirectory = {
	gitSnapshotsEnabled: boolean;
	gitRemoteUrl?: string;
	dirPath: string;
};

export type Space = {
	host: string;
	name?: string;
	owner?: null | Author;
	contentLimit?: number;
	tagLimit?: number;
	tokenId?: string;
	downvoteAddress?: string;
	deletableVotes?: true;
	fetchedSelf?: null | Author;
	tagTree: null | TagTree;
};
