export type Thought = {
	createDate: number;
	authorId?: string;
	signature?: string;
	spaceHost?: string;
	content?: string;
	tags?: string[];
	parentId?: string;
	children?: Thought[];
	votes?: {
		own?: boolean;
		up?: number;
		down?: number;
	};
};

export function getThoughtId(thought: Thought) {
	return `${thought.createDate}_${thought.authorId || ''}_${thought.spaceHost || ''}`;
}

const thoughtIdRegex = /^\d{9,}_(|[A-HJ-NP-Za-km-z1-9]{9,})_(|[\w:\.-]{3,})$/;
export function isThoughtId(str = '') {
	return thoughtIdRegex.test(str);
}
