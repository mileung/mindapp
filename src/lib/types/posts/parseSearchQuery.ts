import { z } from 'zod';
import { getIdStrAsIdObj, IdObjSchema } from '../parts/partIds';

export let searchGuideArr = [
	{
		title: 'Basic',
		syntax: [
			['[...]', 'Posts with a tag called "..."'],
			['"..."', 'Posts with a core containing "..." (quotes optional)'],
		],
		examples: [
			['[Movie][Documentary]', 'Posts tagged with either "Movie" or "Documentary"'],
			['"Hello" "world"', 'Posts with a core containing either "Hello" or "world"'],
			['Hello world', 'Posts with a core containing "Hello world"'],
		],
	},
	{
		title: 'Complex',
		syntax: [
			['[... ]', 'Posts with a tag starting with "..."'],
			['[ ...]', 'Posts with a tag ending with "..."'],
			['!', 'Requires all posts to have the preceding bracketed or quoted search'],
		],
		examples: [
			[
				'[1990s]! [ Music]!',
				'Posts tagged with "1990s" and a tag ending with "Music" (optional space after "!" added for legibility)',
			],
			[
				'[Book]! [Quote]! "Lorem ipsum" "Hello world"',
				'Posts tagged with "Book" and "Quote" and has a core containing "Lorem ipsum" or "Hello world"',
			],
		],
	},
	{
		title: 'Uncommon',
		syntax: [
			['8_8_8', 'Post 8_8_8'],
			['8__', 'Posts in space 8__'],
			['__8', 'Posts by account __8'],
			['@__8', 'Replies to posts by account __8'],
		],
		examples: [
			['0_0_0 8_8_8', 'Posts 0_0_0 and 8_8_8'],
			['__8 8__', 'Posts by account __8 in space 8__ (and current space)'],
			['__0 @__8', 'Posts by account __0 replying to posts by account __8'],
			// See TODO under `eitherAtByMss: [callerMs],`for why this might not work
			// ['__8 @__8', 'Posts by account __8 or posts replying to posts by account __8'],
		],
	},
];

export let maxTopLvlPostLimitPerSection = 15;

export let ParsedQSchema = z.strictObject({
	postIdObjsInclude: z.array(IdObjSchema).max(88),
	eitherInMss: z.array(z.number()).max(200),
	eitherByMss: z.array(z.number()).max(200),
	eitherAtByMss: z.array(z.number()).max(200),

	requiredTags: z.array(z.string()).max(40),
	eitherTags: z.array(z.string()).max(40),

	requiredTagStarts: z.array(z.string()).max(40),
	eitherTagStarts: z.array(z.string()).max(40),

	requiredTagEnds: z.array(z.string()).max(40),
	eitherTagEnds: z.array(z.string()).max(40),

	requiredCoreIncludes: z.array(z.string()).max(40),
	eitherCoreIncludes: z.array(z.string()).max(40),
});

export type ParsedQ = z.infer<typeof ParsedQSchema>;

export let getDefaultParsedQ = (): ParsedQ => ({
	postIdObjsInclude: [],
	eitherByMss: [],
	eitherAtByMss: [],
	eitherInMss: [],
	requiredTags: [],
	eitherTags: [],
	requiredTagStarts: [],
	eitherTagStarts: [],
	requiredTagEnds: [],
	eitherTagEnds: [],
	requiredCoreIncludes: [],
	eitherCoreIncludes: [],
});

export let getParsedQPaginates = (p: ParsedQ) =>
	!p.postIdObjsInclude.length ||
	// p.eitherInMss.length ||
	p.eitherByMss.length ||
	p.eitherAtByMss.length ||
	p.requiredTags.length ||
	p.eitherTags.length ||
	p.requiredTagStarts.length ||
	p.eitherTagStarts.length ||
	p.requiredTagEnds.length ||
	p.eitherTagEnds.length ||
	p.requiredCoreIncludes.length ||
	p.eitherCoreIncludes.length;

export let parseSearchQuery = (query = '') => {
	let parsedQ: ParsedQ = getDefaultParsedQ();
	query = query.trim();
	let unquotedWords: string[] = [];
	let flushUnquotedWords = () => {
		if (unquotedWords.length > 0) {
			let phrase = unquotedWords.join(' ').trim();
			if (phrase) parsedQ.eitherCoreIncludes = [...parsedQ.eitherCoreIncludes, phrase];
			unquotedWords = [];
		}
	};
	while (query) {
		if (query[0] === ' ') {
			query = query.slice(1);
			unquotedWords.push('');
			continue;
		}
		query = query.trimStart();
		if (!query) break;

		// [... ]
		let tagStartMatch = query.match(/^\[([^\]]+) \](!)?/);
		if (tagStartMatch) {
			flushUnquotedWords();
			let key = tagStartMatch[1];
			tagStartMatch[2]
				? (parsedQ.requiredTagStarts = [...parsedQ.requiredTagStarts, key])
				: (parsedQ.eitherTagStarts = [...parsedQ.eitherTagStarts, key]);
			query = query.slice(tagStartMatch[0].length);
			continue;
		}

		// [ ...]
		let tagEndMatch = query.match(/^\[ ([^\]]+)\](!)?/);
		if (tagEndMatch) {
			flushUnquotedWords();
			let key = tagEndMatch[1];
			tagEndMatch[2]
				? (parsedQ.requiredTagEnds = [...parsedQ.requiredTagEnds, key])
				: (parsedQ.eitherTagEnds = [...parsedQ.eitherTagEnds, key]);
			query = query.slice(tagEndMatch[0].length);
			continue;
		}

		// [...]
		let tagMatch = query.match(/^\[([^\]]+)\](!)?/);
		if (tagMatch) {
			flushUnquotedWords();
			let key = tagMatch[1];
			tagMatch[2]
				? (parsedQ.requiredTags = [...parsedQ.requiredTags, key])
				: (parsedQ.eitherTags = [...parsedQ.eitherTags, key]);
			query = query.slice(tagMatch[0].length);
			continue;
		}

		// "..."
		let coreMatch = query.match(/^"([^"]+)"(!)?/);
		if (coreMatch) {
			flushUnquotedWords();
			let phrase = coreMatch[1];
			coreMatch[2]
				? (parsedQ.requiredCoreIncludes = [...parsedQ.requiredCoreIncludes, phrase])
				: (parsedQ.eitherCoreIncludes = [...parsedQ.eitherCoreIncludes, phrase]);
			query = query.slice(coreMatch[0].length);
			continue;
		}

		// 8_8_8
		let postIdMatch = query.match(/^(\d+_\d+_\d+)/);
		if (postIdMatch) {
			flushUnquotedWords();
			let idObj = getIdStrAsIdObj(postIdMatch[1]);
			parsedQ.postIdObjsInclude = [...parsedQ.postIdObjsInclude, idObj];
			query = query.slice(postIdMatch[0].length);
			continue;
		}

		// 8__
		let inMsMatch = query.match(/^(\d+)__/);
		if (inMsMatch) {
			flushUnquotedWords();
			let ms = parseInt(inMsMatch[1]);
			parsedQ.eitherInMss = [...parsedQ.eitherInMss, ms];
			query = query.slice(inMsMatch[0].length);
			continue;
		}

		// @__8
		let atByMsMatch = query.match(/^@__(\d+)/);
		if (atByMsMatch) {
			flushUnquotedWords();
			let ms = parseInt(atByMsMatch[1]);
			parsedQ.eitherAtByMss = [...parsedQ.eitherAtByMss, ms];
			query = query.slice(atByMsMatch[0].length);
			continue;
		}

		// __8
		let byMsMatch = query.match(/^__(\d+)/);
		if (byMsMatch) {
			flushUnquotedWords();
			let ms = parseInt(byMsMatch[1]);
			parsedQ.eitherByMss = [...parsedQ.eitherByMss, ms];
			query = query.slice(byMsMatch[0].length);
			continue;
		}

		// Unquoted word — collect for phrase assembly
		let spaceIndex = query.indexOf(' ');
		if (spaceIndex === -1) {
			unquotedWords.push(query);
			break;
		}
		let word = query.slice(0, spaceIndex);
		if (word) unquotedWords.push(word);
		query = query.slice(spaceIndex + 1);
	}
	flushUnquotedWords();
	return parsedQ;
};

// console.log(
// 	'test123:',
// 	parseSearchQuery(`  "hello"    world ? [[test]   hey  you   [[wow]] w o w `),
// );
// console.log(
// 	'test: ',
// 	parseSearchQuery(`1_23_456 _888_ __8 __0 _3_ "hello world"[Book]"wow!"! test! ing`),
// );
// console.log('test: ', parseSearchQuery(''));
