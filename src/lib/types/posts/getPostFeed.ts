import { getWhoObj, gsdb } from '$lib/global-state.svelte';
import { throwIf } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, not, or } from 'drizzle-orm';
import { z } from 'zod';
import { getCitedPostIds, type Post } from '.';
import { type Database } from '../../local-db';
import { channelPartsByCode, type PartInsert, type PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getIdStr, getIdStrAsIdObj, IdObjSchema, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { accentCodes } from '../spaces';
import {
	getDefaultParsedQ,
	getParsedQPaginates,
	maxTopLvlPostLimitPerSection,
	ParsedQSchema,
} from './parseSearchQuery';

export let PostFeedSectionSchema = ParsedQSchema.extend({
	flatView: z.boolean(),
	newFirst: z.boolean(),
	msGte: z.number().optional(),
	msLte: z.number().optional(),
	postIdObjsExclude: z.array(IdObjSchema),
	topLvlPostLimit: z.number().gt(0).lte(maxTopLvlPostLimitPerSection),
});

export type PostFeedSection = z.infer<typeof PostFeedSectionSchema>;
export let getDefaultSection = (): PostFeedSection => ({
	...getDefaultParsedQ(),
	flatView: true,
	newFirst: true,
	msGte: undefined,
	msLte: undefined,
	postIdObjsExclude: [],
	topLvlPostLimit: maxTopLvlPostLimitPerSection,
});

export let getPostFeed = async (
	sections: PostFeedSection[],
	useLocalDb: boolean,
	setLastViewMsInMs?: number,
) => {
	let input = {
		...(await getWhoObj()),
		sections, //
		setLastViewMsInMs,
	};
	return useLocalDb //
		? _getPostFeed(await gsdb(), input, true, true)
		: trpc().getPostFeed.mutate(input);
};

type PartialMembership = Record<
	number,
	{
		roleCode?: { num: number };
		flair?: { txt: string };
	}
>;
export let _getPostFeed = async (
	db: Database,
	input: {
		callerMs: number;
		sections: PostFeedSection[];
		setLastViewMsInMs?: number;
	},
	ownerCalled: boolean,
	dbIsLocal: boolean,
): Promise<{
	topLvlPostIdStrsSections?: string[][];
	idToPostMap?: Record<string, Post>;
	msToAccountNameTxtMap?: Record<string, string>;
	msToSpaceNameTxtMap?: Record<string, string>;
	spaceMsToAccountMsToMembershipMap?: Record<string, PartialMembership>;
}> => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));
	// console.log('_getPostFeed q:', q);
	let { callerMs, sections } = input;
	// console.log('input:', input);
	// console.log('sections:', sections);

	// let allSectionPostIdStrsInclude= new Set<string>()
	let inMssSetBySection: Set<number>[] = [];
	let allSectionInMssSet = new Set(
		sections.flatMap((section, i) => {
			let sectionInMss = section.eitherInMss.concat(
				section.postIdObjsInclude.map(
					(o) => o.in_ms, //
				),
			);
			inMssSetBySection[i] = new Set(sectionInMss);
			return sectionInMss;
		}),
	);
	let allSectionInMss = [...allSectionInMssSet];
	throwIf(!allSectionInMss.length && !ownerCalled);
	let {
		[pc.i_accountMs_permCode_mb]: i_accountMs_permCode_mbRows = [],
		[pc.imb_spaceIsPublic]: imb_spaceIsPublicRows = [],
	} = channelPartsByCode(
		allSectionInMss.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							...allSectionInMss.flatMap((inMs) => [
								and(
									pf.code.eq(pc.i_accountMs_permCode_mb),
									pf.p1.eq(inMs), //
									pf.p2.eq(callerMs),
								),
								and(
									pf.code.eq(pc.imb_spaceIsPublic),
									pf.p1.eq(inMs),
									pf.p4.eq(1), //
								),
							]),
						),
					)
			: [],
	);
	let viewableSpaceMssSet = new Set(
		[...i_accountMs_permCode_mbRows, ...imb_spaceIsPublicRows].map((r) => r.p1!),
	);
	if (dbIsLocal && allSectionInMssSet.has(0)) viewableSpaceMssSet.add(0);
	if (callerMs > 0 && allSectionInMssSet.has(callerMs)) viewableSpaceMssSet.add(callerMs);
	if (allSectionInMssSet.has(1)) viewableSpaceMssSet.add(1);
	let viewableSpaceMss = [...viewableSpaceMssSet];
	if (!viewableSpaceMss.length && !ownerCalled) return {};

	let tagIdToTxtMap: Record<string, string> = {};
	let _tag_imBy8_countRequiredRows: PartInsert[] = [];
	let _tag_imBy8_countEitherRows: PartInsert[] = [];
	let postIdToAncestryMap: Record<
		string,
		undefined | ReturnType<typeof parseAncestry4postImb_parentMb_rootMb_childCount>
	> = {};
	let parseAncestry4postImb_parentMb_rootMb_childCount = (r: PartInsert) => {
		let { p1, p2, p3, p4, p5, p6, p7, p8 } = r;
		let postIdObj = { in_ms: p1!, ms: p2!, by_ms: p3! };
		let hasParent = Number.isInteger(p4) && Number.isInteger(p5);
		let postIdStr = getIdStr(postIdObj);
		let ancestry = {
			postIdObj,
			postIdStr,
			parentIdObj: hasParent ? { in_ms: p1!, ms: p4!, by_ms: p5! } : null,
			rootIdObj: hasParent ? { in_ms: p1!, ms: p6!, by_ms: p7! } : null,
			childCount: p8!,
		};
		postIdToAncestryMap[postIdStr] = ancestry;
		return ancestry;
	};
	let allSectionTags = [...new Set(sections.flatMap((s) => [...s.eitherTags, ...s.requiredTags]))];
	let allSectionTagStarts = [
		...new Set(sections.flatMap((s) => [...s.eitherTagStarts, ...s.requiredTagStarts])),
	];
	let allSectionTagEnds = [
		...new Set(sections.flatMap((s) => [...s.eitherTagEnds, ...s.requiredTagEnds])),
	];
	let anySectionHasTags =
		allSectionTags.length || allSectionTagStarts.length || allSectionTagEnds.length;
	let {
		// [pc.postImb_parentMb_rootMb_childCount]: postImb_parentMb_rootMb_childCountIncludeRows = [],
		[pc._tag_imBy8_count]: _tag_imBy8_countRowsFromInput = [],
	} = channelPartsByCode(
		anySectionHasTags
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								pf.code.eq(pc._tag_imBy8_count),
								or(...viewableSpaceMss.map((ms) => pf.p1.eq(ms))),
								or(...allSectionTags.map((t) => pf.txt.eq(t))),
								or(
									...allSectionTagStarts.map((t) => pf.txt.likeEscaped(`${escapeLikePattern(t)}%`)),
								),
								or(...allSectionTagEnds.map((t) => pf.txt.likeEscaped(`%${escapeLikePattern(t)}`))),
							),
						),
					)
			: [],
	);
	let postIdsToSendSet = new Set<string>();
	let topLvlPostIdStrsSections: string[][] = [];
	for (let i = 0; i < sections.length; i++) {
		let section = sections[i];
		// console.log('section:', section);
		// console.log('section.postIdObjsExclude:', section.postIdObjsExclude);
		let { newFirst, msGte, msLte } = section;
		// TODO: gotta think more about limiting public feeds from anon users
		// throwIf(!dbIsLocal && !callerMs && (msGte !== undefined || msLte !== undefined));
		let sectionTopLvlPostsLeft = section.topLvlPostLimit;
		let resultingPostIdObjsForSection: IdObj[] = [];
		let topLvlPostIdStrsForSection: string[] = [];
		let sectionInMss = [...inMssSetBySection[i]];
		let sectionInMssToCheck = ownerCalled
			? sectionInMss //
			: sectionInMss.filter((ms) => viewableSpaceMssSet.has(ms));
		if (!dbIsLocal && !ownerCalled && !sectionInMssToCheck.length) {
			console.warn('Section unauthorized');
			topLvlPostIdStrsSections.push(topLvlPostIdStrsForSection);
			continue;
		}
		if (section.postIdObjsInclude.length) {
			let postImb_parentMb_rootMb_childCountIncludeRows = await db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
						or(...viewableSpaceMss.map((ms) => pf.p1.eq(ms))),
						...section.postIdObjsExclude.map((o) =>
							not(
								and(
									pf.p1.eq(o.in_ms),
									pf.p2.eq(o.ms), //
									pf.p3.eq(o.by_ms),
								)!,
							),
						),
						or(
							...section.postIdObjsInclude.map((o) =>
								and(
									pf.p1.eq(o.in_ms),
									pf.p2.eq(o.ms), //
									pf.p3.eq(o.by_ms),
								),
							),
						),
					),
				)
				.orderBy(newFirst ? pf.p4.desc : pf.p4.asc)
				.limit(section.topLvlPostLimit);
			resultingPostIdObjsForSection.push(
				...postImb_parentMb_rootMb_childCountIncludeRows.map(
					(r) => parseAncestry4postImb_parentMb_rootMb_childCount(r).postIdObj,
				),
			);
			topLvlPostIdStrsForSection.push(
				...new Set(
					section.postIdObjsInclude
						.map((o) => {
							let s = getIdStr(o);
							let ancestry = postIdToAncestryMap[s];
							if (!ancestry) return '';
							return !section.flatView && ancestry?.rootIdObj
								? getIdStr(ancestry.rootIdObj) //
								: s;
						})
						.filter((s) => s),
				),
			);
			sectionTopLvlPostsLeft -= topLvlPostIdStrsForSection.length;
		}
		let getMissingAncestryForPostIdStrs = async (postIdStrs: string[]) => {
			let postIdStrsWithoutAncestry = postIdStrs.filter((s) => !postIdToAncestryMap[s]);
			let postImb_parentMb_rootMb_childCountOtherRows = postIdStrsWithoutAncestry.length
				? await db
						.select()
						.from(pTable)
						.where(
							and(
								pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
								or(
									...postIdStrsWithoutAncestry.map((s) => {
										let o = getIdStrAsIdObj(s);
										return and(
											pf.p1.eq(o.in_ms),
											pf.p2.eq(o.ms), //
											pf.p3.eq(o.by_ms),
										);
									}),
								),
							),
						)
				: [];
			for (let r of postImb_parentMb_rootMb_childCountOtherRows) {
				parseAncestry4postImb_parentMb_rootMb_childCount(r);
			}
		};
		if (getParsedQPaginates(section) && sectionTopLvlPostsLeft > 0) {
			let sectionHasRequiredTags = !!(
				section.requiredTags.length ||
				section.requiredTagStarts.length ||
				section.requiredTagEnds.length
			);
			let sectionHasEitherTags = !!(
				section.eitherTags.length ||
				section.eitherTagStarts.length ||
				section.eitherTagEnds.length
			);
			let sectionHasTags = sectionHasRequiredTags || sectionHasEitherTags;
			let sectionHasCores =
				section.requiredCoreIncludes.length || section.eitherCoreIncludes.length;
			let lastLoopForSection = false;
			if (sectionHasTags) {
				for (let _tag_imBy8_countRow of _tag_imBy8_countRowsFromInput) {
					let { txt, p1, p2, p3 } = _tag_imBy8_countRow;
					txt = txt!;
					tagIdToTxtMap[`${p1}_${p2}_${p3}`] = txt;
					let isRequired =
						section.requiredTags.some((tag) => txt === tag) ||
						section.requiredTagStarts.some((tagStart) => txt.startsWith(tagStart)) ||
						section.requiredTagEnds.some((tagEnd) => txt.endsWith(tagEnd));
					let isEither =
						section.eitherTags.some((tag) => txt === tag) ||
						section.eitherTagStarts.some((tagStart) => txt.startsWith(tagStart)) ||
						section.eitherTagEnds.some((tagEnd) => txt.endsWith(tagEnd));
					if (isRequired) _tag_imBy8_countRequiredRows.push(_tag_imBy8_countRow);
					if (isEither) _tag_imBy8_countEitherRows.push(_tag_imBy8_countRow);
				}
				lastLoopForSection = !_tag_imBy8_countRowsFromInput.length;
			}
			let possibleResultingPostIdObjsForSection: IdObj[] = [];
			let notResultingPostIdObjsForSection: IdObj[] = [];
			let getPostIdObjsNotToFetchMoreStuffFor = () => [
				// TODO: This may hit the sqlite  expression tree max-depth. Chunk when it is clearly a problem?
				...notResultingPostIdObjsForSection,
				...resultingPostIdObjsForSection,
				...section.postIdObjsExclude,
			];
			let tagImb_postMb_lastVersionGetFilters = () => [
				or(...sectionInMssToCheck.map((inMs) => pf.p1.eq(inMs))),
				msGte === undefined ? undefined : pf.p4.gte(msGte),
				msLte === undefined ? undefined : pf.p4.lte(msLte),
				or(...section.eitherByMss.map((byMs) => pf.p5.eq(byMs))),
				...getPostIdObjsNotToFetchMoreStuffFor().map((o) =>
					not(
						and(
							pf.p1.eq(o.in_ms),
							pf.p4.eq(o.ms), //
							pf.p5.eq(o.by_ms),
						)!,
					),
				),
			];
			let loops = 0;
			while (
				!lastLoopForSection &&
				sectionTopLvlPostsLeft > 0 &&
				topLvlPostIdStrsForSection.length < section.topLvlPostLimit
			) {
				if (++loops > 8) {
					console.warn('loops:', loops);
					// I mean... if a user searches for replies to an account with a certain core,
					// it could go on until the last possibleResultingPostIdObjsForSection
					// is found, so in theory several loops may legitimately be needed.
					// Like if I want posts replying to account __0 whose core includes " ",
					// that'll hit the limit easily.
					break;
					// TODO: indicate on frontend that they query hit the loop limit.
					// They need to change the time range
				}
				let tagImb_postMb_lastVersionRowsForThisLoop: PartInsert[] = [];
				let postIdObjsWithAllRequiredTags: IdObj[] = [];
				let postIdObjsWithRequiredTagsAndEitherTags: IdObj[] = [];
				if (sectionHasRequiredTags) {
					if (_tag_imBy8_countRequiredRows.length) {
						let tagImb_postMb_lastVersionRequiredRows = await db
							.select()
							.from(pTable)
							.where(
								and(
									pf.code.eq(pc.tagImb_postMb_lastVersion),
									...tagImb_postMb_lastVersionGetFilters(),
									...getPostIdObjsNotToFetchMoreStuffFor().map((o) =>
										not(
											and(
												pf.p1.eq(o.in_ms),
												pf.p4.eq(o.ms), //
												pf.p5.eq(o.by_ms),
											)!,
										),
									),
									or(
										..._tag_imBy8_countRequiredRows.map((row) =>
											and(
												pf.p1.eq(row.p1!), //
												pf.p2.eq(row.p2!),
												pf.p3.eq(row.p3!),
											),
										),
									),
								),
							)
							.orderBy(newFirst ? pf.p4.desc : pf.p4.asc);
						// .limit(_tag_imBy8_countRequiredRows.length * section.topLvlPostLimit);
						let postIdStrToRequiredTagsMap: Record<string, string[]> = {};
						for (let i = 0; i < tagImb_postMb_lastVersionRequiredRows.length; i++) {
							let { p1, p2, p3, p4, p5 } = tagImb_postMb_lastVersionRequiredRows[i];
							let postIdStr = `${p1}_${p4}_${p5}`;
							postIdStrToRequiredTagsMap[postIdStr] ??= [];
							postIdStrToRequiredTagsMap[postIdStr].push(tagIdToTxtMap[`${p1}_${p2}_${p3}`]);
						}
						let notResultingPostIdSetForThisLoop = new Set<string>();
						postIdObjsWithAllRequiredTags = Object.entries(postIdStrToRequiredTagsMap)
							.filter(([postIdStr, postTags]) => {
								if (!notResultingPostIdSetForThisLoop.has(postIdStr)) {
									let postHasAllRequiredTags =
										!section.requiredTags.length ||
										section.requiredTags.every((tag) => postTags.some((t) => t === tag));
									let postHasAllRequiredTagStarts =
										!section.requiredTagStarts.length ||
										section.requiredTagStarts.every((tagStart) =>
											postTags.some((t) => t.startsWith(tagStart)),
										);
									let postHasAllRequiredTagEnds =
										!section.requiredTagEnds.length ||
										section.requiredTagEnds.every((tagEnd) =>
											postTags.some((t) => t.endsWith(tagEnd)),
										);
									return (
										postHasAllRequiredTags &&
										postHasAllRequiredTagStarts &&
										postHasAllRequiredTagEnds
									);
								}
								notResultingPostIdSetForThisLoop.add(postIdStr);
							})
							.map(([strId]) => getIdStrAsIdObj(strId));
						notResultingPostIdObjsForSection.push(
							...[...notResultingPostIdSetForThisLoop].map((s) => getIdStrAsIdObj(s)),
						);
						if (!sectionHasEitherTags) {
							tagImb_postMb_lastVersionRowsForThisLoop = tagImb_postMb_lastVersionRequiredRows;
							postIdObjsWithRequiredTagsAndEitherTags = postIdObjsWithAllRequiredTags;
						}
						lastLoopForSection = postIdObjsWithAllRequiredTags.length < section.topLvlPostLimit;
					} else lastLoopForSection = true;
				}
				if (sectionHasEitherTags) {
					if (
						_tag_imBy8_countEitherRows.length &&
						(!sectionHasRequiredTags || postIdObjsWithAllRequiredTags.length)
					) {
						let tagImb_postMb_lastVersionCommonFilters = [
							pf.code.eq(pc.tagImb_postMb_lastVersion),
							...tagImb_postMb_lastVersionGetFilters(),
							...getPostIdObjsNotToFetchMoreStuffFor().map((o) =>
								not(
									and(
										pf.p1.eq(o.in_ms),
										pf.p4.eq(o.ms), //
										pf.p5.eq(o.by_ms),
									)!,
								),
							),
						];
						if (sectionHasRequiredTags) {
							let maxOrLeaves = 80;
							let chunkSize = Math.max(
								1,
								Math.floor(maxOrLeaves / _tag_imBy8_countEitherRows.length),
							);
							let postIdObjChunks: (typeof postIdObjsWithAllRequiredTags)[] = [];
							for (let i = 0; i < postIdObjsWithAllRequiredTags.length; i += chunkSize) {
								postIdObjChunks.push(postIdObjsWithAllRequiredTags.slice(i, i + chunkSize));
							}
							let chunkedRows = await Promise.all(
								postIdObjChunks.map((postIdObjChunk) =>
									db
										.select()
										.from(pTable)
										.where(
											and(
												...tagImb_postMb_lastVersionCommonFilters,
												or(
													..._tag_imBy8_countEitherRows.flatMap((_tag_imBy8_countEitherRow) =>
														postIdObjChunk.map((postIdObj) =>
															and(
																pf.p1.eq(_tag_imBy8_countEitherRow.p1!),
																pf.p2.eq(_tag_imBy8_countEitherRow.p2!),
																pf.p3.eq(_tag_imBy8_countEitherRow.p3!),
																pf.p4.eq(postIdObj.ms),
																pf.p5.eq(postIdObj.by_ms),
															),
														),
													),
												),
											),
										)
										.orderBy(newFirst ? pf.p4.desc : pf.p4.asc),
								),
							);
							tagImb_postMb_lastVersionRowsForThisLoop = chunkedRows.flat();
						} else {
							tagImb_postMb_lastVersionRowsForThisLoop = await db
								.select()
								.from(pTable)
								.where(
									and(
										...tagImb_postMb_lastVersionCommonFilters,
										or(
											..._tag_imBy8_countEitherRows.map((_tag_imBy8_countEitherRow) =>
												and(
													pf.p1.eq(_tag_imBy8_countEitherRow.p1!),
													pf.p2.eq(_tag_imBy8_countEitherRow.p2!),
													pf.p3.eq(_tag_imBy8_countEitherRow.p3!),
												),
											),
										),
									),
								)
								.orderBy(newFirst ? pf.p4.desc : pf.p4.asc)
								.limit(section.topLvlPostLimit);
						}
						let postIdStrToHasEitherTagsSet = new Set<string>();
						for (let i = 0; i < tagImb_postMb_lastVersionRowsForThisLoop.length; i++) {
							let { p1, p4, p5 } = tagImb_postMb_lastVersionRowsForThisLoop[i];
							postIdStrToHasEitherTagsSet.add(`${p1}_${p4}_${p5}`);
						}
						postIdObjsWithRequiredTagsAndEitherTags = [...postIdStrToHasEitherTagsSet].map((s) =>
							getIdStrAsIdObj(s),
						);
						if (!tagImb_postMb_lastVersionRowsForThisLoop.length) lastLoopForSection = true;
					} else lastLoopForSection = true;
				}
				if (
					sectionHasCores &&
					(postIdObjsWithRequiredTagsAndEitherTags.length || !sectionHasTags)
				) {
					let _core_postImb_lastVersion_mRows = await db
						.select()
						.from(pTable)
						.where(
							and(
								pf.code.eq(pc._core_postImb_lastVersion_m),
								...section.requiredCoreIncludes.map((coreIncludes) =>
									pf.txt.likeEscaped(`%${escapeLikePattern(coreIncludes)}%`),
								),
								or(
									...section.eitherCoreIncludes.map((coreIncludes) =>
										pf.txt.likeEscaped(`%${escapeLikePattern(coreIncludes)}%`),
									),
								),
								or(...sectionInMssToCheck.map((inMs) => pf.p1.eq(inMs))),
								msGte === undefined ? undefined : pf.p2.gte(msGte),
								msLte === undefined ? undefined : pf.p2.lte(msLte),
								...getPostIdObjsNotToFetchMoreStuffFor().map((o) =>
									not(
										and(
											pf.p1.eq(o.in_ms),
											pf.p2.eq(o.ms), //
											pf.p3.eq(o.by_ms),
										)!,
									),
								),
								or(
									...postIdObjsWithRequiredTagsAndEitherTags.map((o) =>
										and(
											pf.p1.eq(o.in_ms),
											pf.p2.eq(o.ms), //
											pf.p3.eq(o.by_ms),
										),
									),
								),
							),
						)
						.orderBy(newFirst ? pf.p2.desc : pf.p2.asc)
						.limit(section.topLvlPostLimit);
					if (_core_postImb_lastVersion_mRows.length) {
						for (let i = 0; i < _core_postImb_lastVersion_mRows.length; i++) {
							let { p1, p2, p3 } = _core_postImb_lastVersion_mRows[i];
							possibleResultingPostIdObjsForSection.push({
								in_ms: p1!,
								ms: p2!,
								by_ms: p3!,
							});
						}
					} else lastLoopForSection = true;
				} else {
					possibleResultingPostIdObjsForSection.push(...postIdObjsWithRequiredTagsAndEitherTags);
				}
				let resultingPostIdObjsForSectionForThisLoop: IdObj[] = [];
				if (!sectionHasTags && !sectionHasCores) {
					let postImb_parentMb_rootMb_childCountRowsForNoTagOrCoreSearch = await db
						.select()
						.from(pTable)
						.where(
							and(
								pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
								...getPostIdObjsNotToFetchMoreStuffFor().map((o) =>
									not(
										and(
											pf.p1.eq(o.in_ms),
											pf.p2.eq(o.ms), //
											pf.p3.eq(o.by_ms),
										)!,
									),
								),
								or(...sectionInMssToCheck.map((ms) => pf.p1.eq(ms))),
								msGte === undefined ? undefined : pf.p2.gte(msGte),
								msLte === undefined ? undefined : pf.p2.lte(msLte),
								or(...section.eitherByMss.map((byMs) => pf.p3.eq(byMs))),
								or(
									...section.eitherAtByMss.map((byMs) =>
										and(
											pf.p3.notEq(byMs),
											pf.p5.eq(byMs), //
										),
									),
								),
							),
						)
						.orderBy(newFirst ? pf.p2.desc : pf.p2.asc)
						.limit(section.topLvlPostLimit);
					// possibleResultingPostIdObjsForSection.push(
					resultingPostIdObjsForSectionForThisLoop.push(
						...postImb_parentMb_rootMb_childCountRowsForNoTagOrCoreSearch.map(
							(r) => parseAncestry4postImb_parentMb_rootMb_childCount(r).postIdObj,
						),
					);
					if (!postImb_parentMb_rootMb_childCountRowsForNoTagOrCoreSearch.length)
						lastLoopForSection = true;
				}
				if (!section.eitherAtByMss.length) {
					resultingPostIdObjsForSectionForThisLoop.push(...possibleResultingPostIdObjsForSection);
					possibleResultingPostIdObjsForSection = [];
				} else if (possibleResultingPostIdObjsForSection.length) {
					let postImb_parentMb_rootMb_childCountNoAncestryRows = await db
						.select()
						.from(pTable)
						.where(
							and(
								pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
								or(
									...possibleResultingPostIdObjsForSection.map((o) =>
										and(
											pf.p1.eq(o.in_ms),
											pf.p2.eq(o.ms), //
											pf.p3.eq(o.by_ms),
										),
									),
								),
								or(
									...section.eitherAtByMss.map((byMs) =>
										and(
											pf.p3.notEq(byMs),
											pf.p5.eq(byMs), //
										),
									),
								),
							),
						);
					for (let r of postImb_parentMb_rootMb_childCountNoAncestryRows) {
						parseAncestry4postImb_parentMb_rootMb_childCount(r);
					}
					resultingPostIdObjsForSectionForThisLoop.push(
						...possibleResultingPostIdObjsForSection.filter((o) => {
							let ancestry = postIdToAncestryMap[getIdStr(o)];
							if (ancestry) return true;
							notResultingPostIdObjsForSection.push(o);
						}),
					);
				}
				if (section.flatView) {
					topLvlPostIdStrsForSection.push(
						...resultingPostIdObjsForSectionForThisLoop.map((o) => getIdStr(o)),
					);
					sectionTopLvlPostsLeft -= resultingPostIdObjsForSectionForThisLoop.length;
				} else {
					let prevTopLvlPostIdStrsForSectionLength = topLvlPostIdStrsForSection.length;
					await getMissingAncestryForPostIdStrs(
						resultingPostIdObjsForSectionForThisLoop.map((o) => getIdStr(o)),
					);
					topLvlPostIdStrsForSection = [
						...new Set([
							...topLvlPostIdStrsForSection,
							...resultingPostIdObjsForSectionForThisLoop.map((o) => {
								let { rootIdObj, postIdObj } = postIdToAncestryMap[getIdStr(o)]!;
								return getIdStr(rootIdObj ? rootIdObj : postIdObj);
							}),
						]),
					];
					sectionTopLvlPostsLeft -=
						topLvlPostIdStrsForSection.length - prevTopLvlPostIdStrsForSectionLength;
				}
				resultingPostIdObjsForSection.push(...resultingPostIdObjsForSectionForThisLoop);
			}
		}
		topLvlPostIdStrsForSection = topLvlPostIdStrsForSection.slice(0, section.topLvlPostLimit);
		if (section.flatView) {
			await getMissingAncestryForPostIdStrs(topLvlPostIdStrsForSection);
			topLvlPostIdStrsForSection
				.flatMap((s) => {
					let ancestry = postIdToAncestryMap[s];
					return ancestry
						? ancestry.parentIdObj
							? [s, getIdStr(ancestry.parentIdObj)]
							: [s] //
						: [];
				})
				.forEach((s) => postIdsToSendSet.add(s));
		} else {
			let topLvlPostIdStrsWithChildren = topLvlPostIdStrsForSection.filter(
				(s) => postIdToAncestryMap[s]?.childCount,
			);
			let topLvlPostIdStrsWithoutAncestry = topLvlPostIdStrsForSection.filter(
				(s) => !postIdToAncestryMap[s],
			);
			let postImb_parentMb_rootMb_childCountDescendentRows =
				topLvlPostIdStrsWithChildren.length || topLvlPostIdStrsWithoutAncestry.length
					? await db
							.select()
							.from(pTable)
							.where(
								and(
									pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
									or(
										...topLvlPostIdStrsWithoutAncestry.map((s) => {
											let o = getIdStrAsIdObj(s);
											return and(
												pf.p1.eq(o.in_ms),
												pf.p2.eq(o.ms), //
												pf.p3.eq(o.by_ms),
											);
										}),
										...[...topLvlPostIdStrsWithChildren, ...topLvlPostIdStrsWithoutAncestry].map(
											(s) => {
												let o = getIdStrAsIdObj(s);
												return and(
													pf.p1.eq(o.in_ms),
													pf.p6.eq(o.ms), //
													pf.p7.eq(o.by_ms),
												);
											},
										),
									),
								),
							)
					: [];
			[
				...topLvlPostIdStrsForSection,
				...postImb_parentMb_rootMb_childCountDescendentRows.map(
					(r) => parseAncestry4postImb_parentMb_rootMb_childCount(r).postIdStr,
				),
			].forEach((s) => postIdsToSendSet.add(s));
		}
		topLvlPostIdStrsSections.push(topLvlPostIdStrsForSection);
	}
	let getPostParts = async (postIdObjs: IdObj[], forCitedPosts = false) => {
		let inMssSet = new Set<number>();
		let byMssSet = new Set<number>();
		let inMsToByMssMap: Record<number, Set<number>> = {};
		for (let { in_ms, by_ms } of postIdObjs) {
			inMssSet.add(in_ms);
			byMssSet.add(by_ms);
			(inMsToByMssMap[in_ms] ??= new Set()).add(by_ms);
		}
		let inMss = [...inMssSet];
		let byMss = [...byMssSet];
		let spaceMssToCheckViewable: number[] = [];
		if (forCitedPosts) {
			let notViewableSpaceMssSet = new Set(
				allSectionInMss.filter((ms) => !viewableSpaceMssSet.has(ms)),
			);
			postIdObjs = postIdObjs.filter((o) => !notViewableSpaceMssSet.has(o.in_ms));
			spaceMssToCheckViewable = inMss.filter((ms) => !notViewableSpaceMssSet.has(ms));
		}
		let postIdObjsWithoutAncestry = postIdObjs.filter((o) => !postIdToAncestryMap[getIdStr(o)]);
		let postParts = postIdObjs.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							...spaceMssToCheckViewable.flatMap((inMs) => [
								and(
									pf.code.eq(pc.i_accountMs_permCode_mb),
									pf.p1.eq(inMs), //
									pf.p2.eq(callerMs),
								),
								and(
									pf.code.eq(pc.imb_spaceIsPublic),
									pf.p1.eq(inMs),
									pf.p4.eq(1), //
								),
							]),
							and(
								pf.code.eq(pc._spaceName_imb), //
								or(...inMss.map((ms) => pf.p1.eq(ms))),
							),
							and(
								pf.code.eq(pc._accountName_bm), //
								or(...byMss.map((ms) => pf.p1.eq(ms))),
							),
							and(
								or(
									and(
										pf.code.eq(pc._flair_i_accountMs_mb),
										pf.txt.notEq(''), //
									),
									pf.code.eq(pc.i_accountMs_roleCode_mb),
								),
								or(
									...inMss.map((inMs) =>
										and(
											pf.p1.eq(inMs),
											or(...[...inMsToByMssMap[inMs]].map((byMs) => pf.p2.eq(byMs))),
										),
									),
								),
							),
							postIdObjsWithoutAncestry.length
								? and(
										pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
										or(
											...postIdObjsWithoutAncestry.map((o) =>
												and(
													pf.p1.eq(o.in_ms),
													pf.p2.eq(o.ms), //
													pf.p3.eq(o.by_ms),
												),
											),
										),
									)
								: undefined,
							and(
								pf.code.eq(pc.tagImb_postMb_lastVersion),
								or(
									...postIdObjs.map((o) =>
										and(
											pf.p1.eq(o.in_ms),
											pf.p4.eq(o.ms), //
											pf.p5.eq(o.by_ms),
										),
									),
								),
							),
							and(
								or(
									pf.code.eq(pc._core_postImb_lastVersion_m),
									pf.code.eq(pc._emoji_postImb_count), //
								),
								or(
									...postIdObjs.map((o) =>
										and(
											pf.p1.eq(o.in_ms),
											pf.p2.eq(o.ms), //
											pf.p3.eq(o.by_ms),
										),
									),
								),
							),
							and(
								pf.code.eq(pc._emoji_reactionImb_postMb),
								or(
									...postIdObjs.map((o) =>
										and(
											pf.p1.eq(o.in_ms),
											pf.p3.eq(callerMs),
											pf.p4.eq(o.ms), //
											pf.p5.eq(o.by_ms),
										),
									),
								),
							),
						),
					)
			: [];
		// console.log('postParts:', postParts);
		return postParts;
	};
	let postIdObjsToSend: IdObj[] = [...postIdsToSendSet].map((s) => getIdStrAsIdObj(s));
	let {
		[pc.postImb_parentMb_rootMb_childCount]: postImb_parentMb_rootMb_childCountRows = [],
		[pc._core_postImb_lastVersion_m]: _core_postImb_lastVersion_mRows = [],
		[pc.tagImb_postMb_lastVersion]: tagImb_postMb_lastVersionRows = [],
		[pc._emoji_reactionImb_postMb]: _emoji_reactionImb_postMbRows = [],
		[pc.i_accountMs_roleCode_mb]: i_accountMs_roleCode_mbRows = [],
		[pc._flair_i_accountMs_mb]: _flair_i_accountMs_mbRows = [],
		[pc._emoji_postImb_count]: _emoji_postImb_countRows = [],
		[pc._accountName_bm]: _accountName_bmRows = [],
		[pc._spaceName_imb]: _spaceName_imbRows = [],
	} = channelPartsByCode(postIdObjsToSend.length ? await getPostParts(postIdObjsToSend) : []);
	let citedIdObjsToFetch = [
		...new Set(
			_core_postImb_lastVersion_mRows
				.flatMap((r) => getCitedPostIds(r.txt!))
				.filter((s) => !postIdsToSendSet.has(s)),
		),
	]
		.slice(0, 88)
		.map((s) => getIdStrAsIdObj(s));
	if (citedIdObjsToFetch.length) {
		let {
			[pc.postImb_parentMb_rootMb_childCount]: postImb_parentMb_rootMb_childCountRows2 = [],
			[pc._core_postImb_lastVersion_m]: _core_postImb_lastVersion_mRows2 = [],
			[pc.tagImb_postMb_lastVersion]: tagImb_postMb_lastVersionRows2 = [],
			[pc._emoji_reactionImb_postMb]: _emoji_reactionImb_postMbRows2 = [],
			[pc.i_accountMs_roleCode_mb]: i_accountMs_roleCode_mbRows2 = [],
			[pc._flair_i_accountMs_mb]: _flair_i_accountMs_mbRows2 = [],
			[pc.i_accountMs_permCode_mb]: i_accountMs_permCode_mbRows2 = [],
			[pc._emoji_postImb_count]: _emoji_postImb_countRows2 = [],
			[pc._accountName_bm]: _accountName_bmRows2 = [],
			[pc.imb_spaceIsPublic]: imb_spaceIsPublicRows2 = [],
			[pc._spaceName_imb]: _spaceName_imbRows2 = [],
		} = channelPartsByCode(await getPostParts(citedIdObjsToFetch, true));
		[...i_accountMs_permCode_mbRows2, ...imb_spaceIsPublicRows2].forEach((r) =>
			viewableSpaceMssSet.add(r.p1!),
		);
		_accountName_bmRows.push(..._accountName_bmRows2);
		viewableSpaceMss = [...viewableSpaceMssSet];
		let keepViewable = (rows: PartInsert[]) =>
			ownerCalled ? rows : rows.filter((r) => viewableSpaceMssSet.has(r.p1!));
		for (let i = 0; i < postImb_parentMb_rootMb_childCountRows2.length; i++) {
			let { p1, p2, p3 } = postImb_parentMb_rootMb_childCountRows2[i];
			let idObj: IdObj = { in_ms: p1!, ms: p2!, by_ms: p3! };
			if (ownerCalled || viewableSpaceMssSet.has(idObj.in_ms)) {
				let idStr = getIdStr(idObj);
				if (!postIdsToSendSet.has(idStr)) {
					postIdsToSendSet.add(idStr); // This ain't really necessary but for consistency's sake
					postIdObjsToSend.push(idObj);
				}
			}
		}

		// prettier-ignore
		postImb_parentMb_rootMb_childCountRows.push(...keepViewable(postImb_parentMb_rootMb_childCountRows2));
		_core_postImb_lastVersion_mRows.push(...keepViewable(_core_postImb_lastVersion_mRows2));
		tagImb_postMb_lastVersionRows.push(...keepViewable(tagImb_postMb_lastVersionRows2));
		_emoji_reactionImb_postMbRows.push(...keepViewable(_emoji_reactionImb_postMbRows2));
		i_accountMs_roleCode_mbRows.push(...keepViewable(i_accountMs_roleCode_mbRows2));
		_flair_i_accountMs_mbRows.push(...keepViewable(_flair_i_accountMs_mbRows2));
		_emoji_postImb_countRows.push(...keepViewable(_emoji_postImb_countRows2));
		_accountName_bmRows.push(..._accountName_bmRows2);
		_spaceName_imbRows.push(...keepViewable(_spaceName_imbRows2));
	}
	for (let r of postImb_parentMb_rootMb_childCountRows) {
		parseAncestry4postImb_parentMb_rootMb_childCount(r);
	}

	let alreadyFetchedTagIdStrSet = new Set(
		_tag_imBy8_countRowsFromInput.map((r) => `${r.p1}_${r.p2}_${r.p3}`),
	);
	let tagIdStrsToFetch = [
		...new Set(
			tagImb_postMb_lastVersionRows
				.map((r) => `${r.p1}_${r.p2}_${r.p3}`)
				.filter((s) => !alreadyFetchedTagIdStrSet.has(s)),
		),
	];
	// let _tag_imBy8_countRowsForFetchedPosts = tagIdStrsToFetch.length
	// 	? await db
	// 			.select()
	// 			.from(pTable)
	// 			.where(
	// 				or(
	// 					...tagIdStrsToFetch.map((s) => {
	// 						let o = getIdStrAsIdObj(s);
	// 						return and(
	// 							pf.code.eq(pc._tag_imBy8_count),
	// 							pf.p1.eq(o.in_ms),
	// 							pf.p2.eq(o.ms),
	// 							pf.p3.eq(o.by_ms),
	// 						);
	// 					}),
	// 				),
	// 			)
	// 	: [];

	let CHUNK_SIZE = 88;

	let chunkArray = (array: string[], size: number) => {
		let chunks: string[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	};
	let _tag_imBy8_countRowsForFetchedPosts: PartSelect[] = [];
	if (tagIdStrsToFetch.length > 0) {
		let chunks = chunkArray(tagIdStrsToFetch, CHUNK_SIZE);
		let results = await Promise.all(
			chunks.map(async (chunk) => {
				return await db
					.select()
					.from(pTable)
					.where(
						or(
							...chunk.map((s) => {
								let o = getIdStrAsIdObj(s);
								return and(
									pf.code.eq(pc._tag_imBy8_count),
									pf.p1.eq(o.in_ms),
									pf.p2.eq(o.ms),
									pf.p3.eq(o.by_ms),
								);
							}),
						),
					);
			}),
		);
		_tag_imBy8_countRowsForFetchedPosts = results.flat();
	}

	for (let i = 0; i < _tag_imBy8_countRowsForFetchedPosts.length; i++) {
		let { txt, p1, p2, p3 } = _tag_imBy8_countRowsForFetchedPosts[i];
		tagIdToTxtMap[`${p1}_${p2}_${p3}`] = txt!;
	}
	let idToPostMap: Record<string, Post> = {};
	for (let i = 0; i < postIdObjsToSend.length; i++) {
		let idStr = getIdStr(postIdObjsToSend[i]);
		let { postIdObj, parentIdObj, childCount } = postIdToAncestryMap[idStr]!;
		idToPostMap[idStr] = {
			...postIdObj,
			childCount,
			at_ms: parentIdObj?.ms ?? undefined,
			at_by_ms: parentIdObj?.by_ms ?? undefined,
			history: null,
		};
	}
	let subParts = [
		..._core_postImb_lastVersion_mRows,
		...tagImb_postMb_lastVersionRows,
		..._emoji_reactionImb_postMbRows,
		...i_accountMs_roleCode_mbRows,
		..._flair_i_accountMs_mbRows,
		..._emoji_postImb_countRows,
		..._accountName_bmRows,
		..._spaceName_imbRows,
	];
	let msToAccountNameTxtMap: Record<number, string> = {};
	let msToSpaceNameTxtMap: Record<number, string> = {};
	let spaceMsToAccountMsToMembershipMap: Record<number, PartialMembership> = {};
	for (let i = 0; i < subParts.length; i++) {
		let part = subParts[i];
		let { code, txt, p1, p2, p3, p4, p5, p6 } = part;
		if (code === pc._core_postImb_lastVersion_m) {
			let postIdStr = `${p1}_${p2}_${p3}`;
			idToPostMap[postIdStr].history ??= {};
			idToPostMap[postIdStr].history[p4!] = {
				ms: p5!,
				tags: [],
				core: txt!,
			};
		} else if (code === pc.tagImb_postMb_lastVersion) {
			let tagIdStr = `${p1}_${p2}_${p3}`;
			let postIdStr = `${p1}_${p4}_${p5}`;
			idToPostMap[postIdStr].history ??= {};
			idToPostMap[postIdStr].history[p6!]!.tags!.push(tagIdToTxtMap[tagIdStr] || tagIdStr);
			// idToPostMap[postIdStr].history[p6!]!.tags!.push(tagIdStr);
		} else if (code === pc._emoji_reactionImb_postMb) {
			(idToPostMap[`${p1}_${p4}_${p5}`].myRxnEmojis ??= []).push(txt!);
		} else if (code === pc.i_accountMs_roleCode_mb) {
			((spaceMsToAccountMsToMembershipMap[p1!] ??= {})[p2!] ??= {}).roleCode = { num: p3! };
		} else if (code === pc._flair_i_accountMs_mb) {
			((spaceMsToAccountMsToMembershipMap[p1!] ??= {})[p2!] ??= {}).flair = { txt: txt! };
		} else if (code === pc._emoji_postImb_count) {
			(idToPostMap[`${p1}_${p2}_${p3}`].rxnEmojiCount ??= {})[txt!] = p4!;
		} else if (code === pc._accountName_bm) {
			msToAccountNameTxtMap[p1!] = txt!;
		} else if (code === pc._spaceName_imb) {
			msToSpaceNameTxtMap[p1!] = txt!;
		}
	}
	if (
		input.setLastViewMsInMs &&
		viewableSpaceMssSet.has(input.setLastViewMsInMs) &&
		!dbIsLocal &&
		callerMs
	) {
		await db
			.update(pTable)
			.set({ p3: accentCodes.none, p4: Date.now() })
			.where(
				and(
					pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
					pf.p1.eq(input.setLastViewMsInMs),
					pf.p2.eq(callerMs),
				),
			);
	}
	// let allPostsInMapHaveUniqueTags = Object.entries(idToPostMap).every(([k, v]) => {
	// 	let lastVersion = getLastVersion(v);
	// 	return (
	// 		v.history![lastVersion]!.tags.length === [...new Set(v.history![lastVersion]!.tags)].length
	// 	);
	// });
	// console.log('allPostsInMapHaveUniqueTags:', allPostsInMapHaveUniqueTags);
	return {
		topLvlPostIdStrsSections,
		idToPostMap,
		msToAccountNameTxtMap,
		msToSpaceNameTxtMap,
		spaceMsToAccountMsToMembershipMap,
	};
};

let escapeLikePattern = (input: string) =>
	input
		.replace(/\\/g, '\\\\') // escape existing backslashes first
		.replace(/%/g, '\\%') // escape %
		.replace(/_/g, '\\_'); // escape _

// TODO: getPostFeed needs more tweaking...
// This query
// [Documentary]! [youtube.com]
// gets more results than this query
// [Documentary] [youtube.com]!
// cuz if [youtube.com] is required, the algo will iterate through all those first
// and if there are not enough posts with [Documentary] in that first iteration
// to cause a paginated, all the potential [Documentary] post after that first
// iteration are not iterated over

// Below is AI code. Idk how it works. It queries right, except it gets "for you" stuff when it shouldn't on an unfiltered feed and it's 4-5x slower in prod. In dev it seems fine.
/*
import { getWhoObj, gsdb } from '$lib/global-state.svelte';
import { trpc } from '$lib/trpc/client';
import { and, or, sql } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { z } from 'zod';
import { getCitedPostIds } from '.';
import { type Database } from '../../local-db';
import { channelPartsByCode, WhoObjSchema, type PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getIdStr, getIdStrAsIdObj, IdObjSchema, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { accentCodes } from '../spaces';
import {
	getDefaultParsedQ,
	getParsedQPaginates,
	maxTopLvlPostLimitPerSection,
	ParsedQSchema,
} from './parseSearchQuery';

// =============================================================================
// SQLite/libSQL expression-tree depth safety
// =============================================================================
// SQLite parses `or(a, b, c, ..., z)` / `and(...)` as a LEFT-ASSOCIATIVE
// binary expression tree - a flat chain of N conditions therefore has
// parse-tree depth proportional to N, not O(1). Exceeding the engine's max
// expression depth throws at query time. Every query in this file is kept
// under a total depth budget of 100 by:
//   1. Capping any single or()/and() built from a variable-length array at
//      maxOrChainWidth, splitting longer arrays into parallel queries merged
//      in JS (runChunked) - this guarantees depth-safety regardless of how
//      large the array grows.
//   2. Using SQLite row-value IN, `(a,b,c) IN ((1,2,3), (4,5,6), ...)`, for
//      composite-key ("this exact post") lookups instead of OR-ing per-row
//      AND conditions. A row-value IN list compiles to ONE flat node, not a
//      chain, so its depth is O(1) regardless of list length.
//   3. Capping free-form arrays at the schema level (see parseSearchQuery.ts)
//      so the guarantee holds independent of chunking logic ever having a bug.

let maxOrChainWidth = 40;

let chunkArr = <T>(arr: T[], size: number): T[][] => {
	let chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
	return chunks;
};

let runChunked = async <T, R>(items: T[], queryFn: (chunk: T[]) => Promise<R[]>): Promise<R[]> => {
	if (!items.length) return [];
	let results = await Promise.all(chunkArr(items, maxOrChainWidth).map(queryFn));
	return results.flat();
};

let tupleIn = (cols: [SQLiteColumn, SQLiteColumn, SQLiteColumn], idObjs: IdObj[]) =>
	sql`(${cols[0]}, ${cols[1]}, ${cols[2]}) in (${sql.join(
		idObjs.map((o) => sql`(${o.in_ms}, ${o.ms}, ${o.by_ms})`),
		sql`, `,
	)})`;

let tupleNotIn = (cols: [SQLiteColumn, SQLiteColumn, SQLiteColumn], idObjs: IdObj[]) =>
	sql`(${cols[0]}, ${cols[1]}, ${cols[2]}) not in (${sql.join(
		idObjs.map((o) => sql`(${o.in_ms}, ${o.ms}, ${o.by_ms})`),
		sql`, `,
	)})`;

let escapeLikePattern = (input: string) =>
	input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

// =============================================================================
// Schemas
// =============================================================================

export let PostFeedSectionSchema = ParsedQSchema.extend({
	flatView: z.boolean(),
	newFirst: z.boolean(),
	msGte: z.number().optional(),
	msLte: z.number().optional(),
	// Was uncapped before - a deeply nested/viral thread could produce an
	// unbounded exclude list. Capped for the same depth-safety reasoning as
	// everything else here.
	postIdObjsExclude: z.array(IdObjSchema).max(888),
	topLvlPostLimit: z.number().gt(0).lte(maxTopLvlPostLimitPerSection),
});
export type PostFeedSection = z.infer<typeof PostFeedSectionSchema>;

export let getDefaultSection = (): PostFeedSection => ({
	...getDefaultParsedQ(),
	flatView: true,
	newFirst: true,
	msGte: undefined,
	msLte: undefined,
	postIdObjsExclude: [],
	topLvlPostLimit: maxTopLvlPostLimitPerSection,
});

export let GetPostFeedInputSchema = WhoObjSchema.extend({
	sections: z.array(PostFeedSectionSchema).max(3),
	setLastViewMsInMs: z.number().optional(),
}).strict();
export type GetPostFeedInput = z.infer<typeof GetPostFeedInputSchema>;

export let FeedHistoryLayerSchema = z.object({
	ms: z.number(),
	tags: z.array(z.string()),
	core: z.string(),
});

// Deliberately looser than the `PostSchema` used for submitting/editing
// posts: a feed row normally carries only whichever single version was
// actually fetched, not the full 1..N history chain, so this does not
// require every version key to be present.
export let FeedPostSchema = z.object({
	ms: z.number(),
	by_ms: z.number(),
	in_ms: z.number(),
	at_ms: z.number().optional(),
	at_by_ms: z.number().optional(),
	childCount: z.number().optional(),
	myRxnEmojis: z.array(z.string()).optional(),
	rxnEmojiCount: z.record(z.string(), z.number()).optional(),
	history: z.record(z.string(), FeedHistoryLayerSchema).nullable(),
});
export type FeedPost = z.infer<typeof FeedPostSchema>;

export let MembershipSummarySchema = z.object({
	roleCode: z.object({ num: z.number() }).optional(),
	flair: z.object({ txt: z.string() }).optional(),
});

export let GetPostFeedOutputSchema = z
	.object({
		topLvlPostIdStrsSections: z.array(z.array(z.string())).optional(),
		idToPostMap: z.record(z.string(), FeedPostSchema).optional(),
		msToAccountNameTxtMap: z.record(z.string(), z.string()).optional(),
		msToSpaceNameTxtMap: z.record(z.string(), z.string()).optional(),
		spaceMsToAccountMsToMembershipMap: z
			.record(z.string(), z.record(z.string(), MembershipSummarySchema))
			.optional(),
		// Only ever true if a section's true candidate pool was so large that
		// the defensive iteration cap (maxLoopsPerSection) was hit before the
		// section could be proven exhausted. Should not occur in normal usage.
		truncatedSectionIndexes: z.array(z.number()).optional(),
	})
	.strict();
export type GetPostFeedOutput = z.infer<typeof GetPostFeedOutputSchema>;

// =============================================================================
// Tag-constraint resolution
// =============================================================================

type TagRow = PartSelect;

type TagConstraint = {
	rows: TagRow[];
	totalCount: number;
};

let buildConstraint = (rows: TagRow[]): TagConstraint => ({
	rows,
	totalCount: rows.reduce((sum, r) => sum + (r.p4 ?? 0), 0),
});

let fetchTagRows = async (
	db: Database,
	spaceMss: number[],
	exactTexts: string[],
	startPatterns: string[],
	endPatterns: string[],
): Promise<TagRow[]> => {
	if (!spaceMss.length || (!exactTexts.length && !startPatterns.length && !endPatterns.length))
		return [];
	return runChunked(spaceMss, (spaceChunk) =>
		db
			.select()
			.from(pTable)
			.where(
				and(
					pf.code.eq(pc._tag_imBy8_count),
					pf.p1.in(spaceChunk),
					or(
						exactTexts.length ? pf.txt.in(exactTexts) : undefined,
						...startPatterns.map((s) => pf.txt.likeEscaped(`${escapeLikePattern(s)}%`)),
						...endPatterns.map((s) => pf.txt.likeEscaped(`%${escapeLikePattern(s)}`)),
					),
				),
			),
	);
};

// =============================================================================
// Per-section resolution
// =============================================================================

type SectionCheckedRows = {
	ancestryByKey: Map<string, TagRow>;
};

let paginateByTagRows = async (p: {
	db: Database;
	drivingRows: TagRow[];
	bound: number;
	newFirst: boolean;
	msGte?: number;
	msLte?: number;
	excludeIdObjs: IdObj[];
	needed: number;
	flatView: boolean;
	otherRequiredConstraints: TagConstraint[];
	// only set when the driving pool is NOT already the either-group itself
	eitherConstraints?: TagConstraint[];
	eitherByMss: number[];
	eitherAtByMss: number[];
	excludeByMss: number[];
	requiredCoreIncludes: string[];
	eitherCoreIncludes: string[];
}): Promise<
	{ confirmedTopLvlIdObjs: IdObj[]; exhausted: boolean; truncated: boolean } & SectionCheckedRows
> => {
	let rowsConsumed = 0;
	let confirmedTopLvlIdObjs: IdObj[] = [];
	let seenTopLvlKeys = new Set<string>();
	let excludeIdObjs = p.excludeIdObjs;
	let cursorMsGte = p.msGte;
	let cursorMsLte = p.msLte;
	let loops = 0;
	let truncated = false;
	let maxLoopsPerSection = 500;
	let ancestryByKey = new Map<string, TagRow>();

	let drivingIdentities = p.drivingRows.map((r) => ({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }));

	while (confirmedTopLvlIdObjs.length < p.needed && rowsConsumed < p.bound) {
		if (++loops > maxLoopsPerSection) {
			console.warn('getPostFeed: hit maxLoopsPerSection safety cap');
			truncated = true;
			break;
		}
		let batchLimit = Math.min(200, p.bound - rowsConsumed);

		let page = await runChunked(drivingIdentities, (idChunk) =>
			p.db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.tagImb_postMb_lastVersion),
						tupleIn([pTable.p1, pTable.p2, pTable.p3], idChunk),
						cursorMsGte === undefined ? undefined : pf.p4.gte(cursorMsGte),
						cursorMsLte === undefined ? undefined : pf.p4.lte(cursorMsLte),
						excludeIdObjs.length
							? tupleNotIn([pTable.p1, pTable.p4, pTable.p5], excludeIdObjs)
							: undefined,
					),
				)
				.orderBy(p.newFirst ? pf.p4.desc : pf.p4.asc)
				.limit(batchLimit),
		);
		page.sort((a, b) => (p.newFirst ? b.p4! - a.p4! : a.p4! - b.p4!));
		page = page.slice(0, batchLimit);
		if (!page.length) break;

		rowsConsumed += page.length;
		let pageMss = page.map((r) => r.p4!);
		if (p.newFirst) cursorMsLte = Math.min(...pageMss);
		else cursorMsGte = Math.max(...pageMss);
		excludeIdObjs = [
			...excludeIdObjs,
			...page.map((r) => ({ in_ms: r.p1!, ms: r.p4!, by_ms: r.p5! })),
		];

		let candidateMap = new Map<string, IdObj>();
		for (let r of page) {
			let o = { in_ms: r.p1!, ms: r.p4!, by_ms: r.p5! };
			candidateMap.set(getIdStr(o), o);
		}
		let candidates = [...candidateMap.values()];

		// Author filter - already have by_ms on hand, no query needed.
		if (p.eitherByMss.length) {
			let allowed = new Set(p.eitherByMss);
			candidates = candidates.filter((o) => allowed.has(o.by_ms));
		}
		if (p.excludeByMss.length) {
			let excluded = new Set(p.excludeByMss);
			candidates = candidates.filter((o) => !excluded.has(o.by_ms));
		}

		// Any other required-tag constraints (AND) not already guaranteed by
		// the driving pool itself.
		for (let constraint of p.otherRequiredConstraints) {
			if (!candidates.length) break;
			let rowIds = constraint.rows.map((r) => ({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }));
			let joinRows = rowIds.length
				? await runChunked(candidates, (candChunk) =>
						p.db
							.select()
							.from(pTable)
							.where(
								and(
									pf.code.eq(pc.tagImb_postMb_lastVersion),
									tupleIn([pTable.p1, pTable.p4, pTable.p5], candChunk),
									tupleIn([pTable.p1, pTable.p2, pTable.p3], rowIds),
								),
							),
					)
				: [];
			let satisfied = new Set(
				joinRows.map((r) => getIdStr({ in_ms: r.p1!, ms: r.p4!, by_ms: r.p5! })),
			);
			candidates = candidates.filter((o) => satisfied.has(getIdStr(o)));
		}

		// Either-tag group check - only needed when the driving pool was NOT
		// itself derived from this either-group (in which case membership is
		// already guaranteed by construction).
		if (p.eitherConstraints?.length && candidates.length) {
			let rowIds = p.eitherConstraints.flatMap((c) =>
				c.rows.map((r) => ({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! })),
			);
			let joinRows = rowIds.length
				? await runChunked(candidates, (candChunk) =>
						p.db
							.select()
							.from(pTable)
							.where(
								and(
									pf.code.eq(pc.tagImb_postMb_lastVersion),
									tupleIn([pTable.p1, pTable.p4, pTable.p5], candChunk),
									tupleIn([pTable.p1, pTable.p2, pTable.p3], rowIds),
								),
							),
					)
				: [];
			let satisfied = new Set(
				joinRows.map((r) => getIdStr({ in_ms: r.p1!, ms: r.p4!, by_ms: r.p5! })),
			);
			candidates = candidates.filter((o) => satisfied.has(getIdStr(o)));
		}

		// Ancestry - needed regardless (childCount/parent/root for output +
		// nested-view root resolution), and it's how "reply-to-author" is
		// filtered too, since a post's own row already stores its parent's
		// author (p5), no join required.
		let ancestryRows = candidates.length
			? await runChunked(candidates, (c) =>
					p.db
						.select()
						.from(pTable)
						.where(
							and(
								pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
								tupleIn([pTable.p1, pTable.p2, pTable.p3], c),
							),
						),
				)
			: [];
		for (let r of ancestryRows)
			ancestryByKey.set(getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }), r);

		if (p.eitherAtByMss.length) {
			candidates = candidates.filter((o) => {
				let a = ancestryByKey.get(getIdStr(o));
				return a && a.p5 !== null && a.p5 !== undefined && p.eitherAtByMss.includes(a.p5);
			});
		}

		// Core text filter.
		if ((p.requiredCoreIncludes.length || p.eitherCoreIncludes.length) && candidates.length) {
			let coreRows = await runChunked(candidates, (c) =>
				p.db
					.select()
					.from(pTable)
					.where(
						and(
							pf.code.eq(pc._core_postImb_lastVersion_m),
							tupleIn([pTable.p1, pTable.p2, pTable.p3], c),
							...p.requiredCoreIncludes.map((s) => pf.txt.likeEscaped(`%${escapeLikePattern(s)}%`)),
							p.eitherCoreIncludes.length
								? or(
										...p.eitherCoreIncludes.map((s) =>
											pf.txt.likeEscaped(`%${escapeLikePattern(s)}%`),
										),
									)
								: undefined,
						),
					),
			);
			let satisfied = new Set(
				coreRows.map((r) => getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! })),
			);
			candidates = candidates.filter((o) => satisfied.has(getIdStr(o)));
		}

		for (let o of candidates) {
			let key: string;
			if (p.flatView) key = getIdStr(o);
			else {
				let a = ancestryByKey.get(getIdStr(o));
				key =
					a && a.p6 !== null && a.p6 !== undefined
						? getIdStr({ in_ms: a.p1!, ms: a.p6!, by_ms: a.p7! })
						: getIdStr(o);
			}
			if (seenTopLvlKeys.has(key)) continue;
			seenTopLvlKeys.add(key);
			confirmedTopLvlIdObjs.push(getIdStrAsIdObj(key));
			if (confirmedTopLvlIdObjs.length >= p.needed) break;
		}
	}

	return {
		confirmedTopLvlIdObjs,
		exhausted: rowsConsumed >= p.bound,
		truncated,
		ancestryByKey,
	};
};

// Fallback for sections with no tag constraints at all (pure core-text
// search, or pure space/author/id/time filter). Gets an exact bound via
// COUNT(*) up front, same termination guarantee as the tag-driven path.
let paginateWithoutTags = async (p: {
	db: Database;
	allowedSpaceMss: number[];
	newFirst: boolean;
	msGte?: number;
	msLte?: number;
	excludeIdObjs: IdObj[];
	needed: number;
	flatView: boolean;
	eitherByMss: number[];
	eitherAtByMss: number[];
	excludeByMss: number[];
	requiredCoreIncludes: string[];
	eitherCoreIncludes: string[];
}): Promise<
	{ confirmedTopLvlIdObjs: IdObj[]; exhausted: boolean; truncated: boolean } & SectionCheckedRows
> => {
	let hasCore = p.requiredCoreIncludes.length || p.eitherCoreIncludes.length;
	let code = hasCore ? pc._core_postImb_lastVersion_m : pc.postImb_parentMb_rootMb_childCount;
	let msCol = hasCore ? pf.p2 : pf.p2;

	let buildFilters = (msGte?: number, msLte?: number, excludeIdObjs: IdObj[] = []) =>
		and(
			pf.code.eq(code),
			pf.p1.in(p.allowedSpaceMss),
			msGte === undefined ? undefined : msCol.gte(msGte),
			msLte === undefined ? undefined : msCol.lte(msLte),
			p.eitherByMss.length ? pf.p3.in(p.eitherByMss) : undefined,
			p.excludeByMss.length ? pf.p3.notIn(p.excludeByMss) : undefined,
			excludeIdObjs.length
				? tupleNotIn([pTable.p1, pTable.p2, pTable.p3], excludeIdObjs)
				: undefined,
			...p.requiredCoreIncludes.map((s) => pf.txt.likeEscaped(`%${escapeLikePattern(s)}%`)),
			p.eitherCoreIncludes.length
				? or(...p.eitherCoreIncludes.map((s) => pf.txt.likeEscaped(`%${escapeLikePattern(s)}%`)))
				: undefined,
		);

	// @ts-ignore
	let [{ total }] = await p.db
		// @ts-ignore
		.select({ total: sql<number>`count(*)` })
		.from(pTable)
		.where(buildFilters(p.msGte, p.msLte, p.excludeIdObjs));
	let bound = total;

	let rowsConsumed = 0;
	let confirmedTopLvlIdObjs: IdObj[] = [];
	let seenTopLvlKeys = new Set<string>();
	let excludeIdObjs = p.excludeIdObjs;
	let cursorMsGte = p.msGte;
	let cursorMsLte = p.msLte;
	let loops = 0;
	let truncated = false;
	let maxLoopsPerSection = 500;
	let ancestryByKey = new Map<string, TagRow>();

	while (confirmedTopLvlIdObjs.length < p.needed && rowsConsumed < bound) {
		if (++loops > maxLoopsPerSection) {
			console.warn('getPostFeed: hit maxLoopsPerSection safety cap');
			truncated = true;
			break;
		}
		let batchLimit = Math.min(200, bound - rowsConsumed);
		let page = await p.db
			.select()
			.from(pTable)
			.where(buildFilters(cursorMsGte, cursorMsLte, excludeIdObjs))
			.orderBy(p.newFirst ? msCol.desc : msCol.asc)
			.limit(batchLimit);
		if (!page.length) break;

		rowsConsumed += page.length;
		let pageMss = page.map((r) => r.p2!);
		if (p.newFirst) cursorMsLte = Math.min(...pageMss);
		else cursorMsGte = Math.max(...pageMss);
		excludeIdObjs = [
			...excludeIdObjs,
			...page.map((r) => ({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! })),
		];

		let candidates = page.map((r) => ({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }));

		let ancestryRows = hasCore
			? await runChunked(candidates, (c) =>
					p.db
						.select()
						.from(pTable)
						.where(
							and(
								pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
								tupleIn([pTable.p1, pTable.p2, pTable.p3], c),
							),
						),
				)
			: page;
		for (let r of ancestryRows)
			ancestryByKey.set(getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }), r);

		if (p.eitherAtByMss.length) {
			candidates = candidates.filter((o) => {
				let a = ancestryByKey.get(getIdStr(o));
				return a && a.p5 !== null && a.p5 !== undefined && p.eitherAtByMss.includes(a.p5);
			});
		}

		for (let o of candidates) {
			let key: string;
			if (p.flatView) key = getIdStr(o);
			else {
				let a = ancestryByKey.get(getIdStr(o));
				key =
					a && a.p6 !== null && a.p6 !== undefined
						? getIdStr({ in_ms: a.p1!, ms: a.p6!, by_ms: a.p7! })
						: getIdStr(o);
			}
			if (seenTopLvlKeys.has(key)) continue;
			seenTopLvlKeys.add(key);
			confirmedTopLvlIdObjs.push(getIdStrAsIdObj(key));
			if (confirmedTopLvlIdObjs.length >= p.needed) break;
		}
	}

	return { confirmedTopLvlIdObjs, exhausted: rowsConsumed >= bound, truncated, ancestryByKey };
};

let resolveSection = async (
	db: Database,
	section: PostFeedSection,
	allowedSpaceMss: number[],
): Promise<{ topLvlIdObjs: IdObj[]; truncated: boolean }> => {
	let needed = section.topLvlPostLimit;
	let topLvlIdObjs: IdObj[] = [];
	let truncated = false;

	// Direct-by-id includes are resolved first and consume part of the limit,
	// same contract as the original implementation.
	if (section.postIdObjsInclude.length) {
		let rows = await runChunked(section.postIdObjsInclude, (chunk) =>
			db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
						pf.p1.in(allowedSpaceMss),
						tupleIn([pTable.p1, pTable.p2, pTable.p3], chunk),
					),
				),
		);
		for (let r of rows.slice(0, needed))
			topLvlIdObjs.push({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! });
	}
	needed -= topLvlIdObjs.length;
	if (needed <= 0 || !getParsedQPaginates(section)) return { topLvlIdObjs, truncated };

	let hasRequiredTags =
		section.requiredTags.length ||
		section.requiredTagStarts.length ||
		section.requiredTagEnds.length;
	let hasEitherTags =
		section.eitherTags.length || section.eitherTagStarts.length || section.eitherTagEnds.length;

	if (hasRequiredTags || hasEitherTags) {
		let allTagRows = await fetchTagRows(
			db,
			allowedSpaceMss,
			[...section.requiredTags, ...section.eitherTags],
			[...section.requiredTagStarts, ...section.eitherTagStarts],
			[...section.requiredTagEnds, ...section.eitherTagEnds],
		);

		let requiredConstraints = [
			...section.requiredTags.map((t) => buildConstraint(allTagRows.filter((r) => r.txt === t))),
			...section.requiredTagStarts.map((t) =>
				buildConstraint(allTagRows.filter((r) => r.txt!.startsWith(t))),
			),
			...section.requiredTagEnds.map((t) =>
				buildConstraint(allTagRows.filter((r) => r.txt!.endsWith(t))),
			),
		];
		let eitherConstraints = [
			...section.eitherTags.map((t) => buildConstraint(allTagRows.filter((r) => r.txt === t))),
			...section.eitherTagStarts.map((t) =>
				buildConstraint(allTagRows.filter((r) => r.txt!.startsWith(t))),
			),
			...section.eitherTagEnds.map((t) =>
				buildConstraint(allTagRows.filter((r) => r.txt!.endsWith(t))),
			),
		];

		// Any single required constraint with zero matching rows means no
		// post can ever satisfy the AND - short-circuit to empty.
		if (requiredConstraints.some((c) => c.totalCount === 0)) return { topLvlIdObjs, truncated };

		let result: Awaited<ReturnType<typeof paginateByTagRows>>;
		if (hasRequiredTags) {
			let driving = requiredConstraints.reduce((min, c) =>
				c.totalCount < min.totalCount ? c : min,
			);
			let otherRequired = requiredConstraints.filter((c) => c !== driving);
			result = await paginateByTagRows({
				db,
				drivingRows: driving.rows,
				bound: driving.totalCount,
				newFirst: section.newFirst,
				msGte: section.msGte,
				msLte: section.msLte,
				excludeIdObjs: section.postIdObjsExclude,
				needed,
				flatView: section.flatView,
				otherRequiredConstraints: otherRequired,
				eitherConstraints: hasEitherTags ? eitherConstraints : undefined,
				eitherByMss: section.eitherByMss,
				eitherAtByMss: section.eitherAtByMss,
				excludeByMss: section.excludeByMss,
				requiredCoreIncludes: section.requiredCoreIncludes,
				eitherCoreIncludes: section.eitherCoreIncludes,
			});
		} else {
			// Either-only: union of all either-constraint rows drives the
			// pool. Bound is a safe upper bound (sum of counts, possibly
			// double-counting a row that matches multiple constraint texts
			// simultaneously) rather than a tight exact count - see caveats.
			let dedupedRows = new Map<string, TagRow>();
			for (let c of eitherConstraints)
				for (let r of c.rows)
					dedupedRows.set(getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }), r);
			let bound = eitherConstraints.reduce((sum, c) => sum + c.totalCount, 0);
			result = await paginateByTagRows({
				db,
				drivingRows: [...dedupedRows.values()],
				bound,
				newFirst: section.newFirst,
				msGte: section.msGte,
				msLte: section.msLte,
				excludeIdObjs: section.postIdObjsExclude,
				needed,
				flatView: section.flatView,
				otherRequiredConstraints: [],
				eitherByMss: section.eitherByMss,
				eitherAtByMss: section.eitherAtByMss,
				excludeByMss: section.excludeByMss,
				requiredCoreIncludes: section.requiredCoreIncludes,
				eitherCoreIncludes: section.eitherCoreIncludes,
			});
		}
		topLvlIdObjs.push(...result.confirmedTopLvlIdObjs);
		truncated = result.truncated;
	} else {
		let result = await paginateWithoutTags({
			db,
			allowedSpaceMss,
			newFirst: section.newFirst,
			msGte: section.msGte,
			msLte: section.msLte,
			excludeIdObjs: section.postIdObjsExclude,
			needed,
			flatView: section.flatView,
			eitherByMss: section.eitherByMss,
			eitherAtByMss: section.eitherAtByMss,
			excludeByMss: section.excludeByMss,
			requiredCoreIncludes: section.requiredCoreIncludes,
			eitherCoreIncludes: section.eitherCoreIncludes,
		});
		topLvlIdObjs.push(...result.confirmedTopLvlIdObjs);
		truncated = result.truncated;
	}

	return { topLvlIdObjs, truncated };
};

// =============================================================================
// Main entry point
// =============================================================================

export let _getPostFeed = async (
	db: Database,
	rawInput: {
		callerMs: number;
		sections: PostFeedSection[];
		setLastViewMsInMs?: number;
	},
	ownerCalled: boolean,
	dbIsLocal: boolean,
): Promise<GetPostFeedOutput> => {
	let input = GetPostFeedInputSchema.parse(rawInput);
	let { callerMs, sections } = input;

	let allSectionInMss = [
		...new Set(
			sections.flatMap((s) => [...s.eitherInMss, ...s.postIdObjsInclude.map((o) => o.in_ms)]),
		),
	];

	let { i_accountMs_permCode_mbRows, imb_spaceIsPublicRows } = await (async () => {
		if (!allSectionInMss.length)
			return { i_accountMs_permCode_mbRows: [], imb_spaceIsPublicRows: [] };
		let rows = await runChunked(allSectionInMss, (spaceChunk) =>
			db
				.select()
				.from(pTable)
				.where(
					or(
						and(pf.code.eq(pc.i_accountMs_permCode_mb), pf.p1.in(spaceChunk), pf.p2.eq(callerMs)),
						and(pf.code.eq(pc.imb_spaceIsPublic), pf.p1.in(spaceChunk), pf.p4.eq(1)),
					),
				),
		);
		let { [pc.i_accountMs_permCode_mb]: a = [], [pc.imb_spaceIsPublic]: b = [] } =
			channelPartsByCode(rows);
		return { i_accountMs_permCode_mbRows: a, imb_spaceIsPublicRows: b };
	})();

	let viewableSpaceMssSet = new Set(
		[...i_accountMs_permCode_mbRows, ...imb_spaceIsPublicRows].map((r) => r.p1!),
	);
	if (dbIsLocal) viewableSpaceMssSet.add(0);
	if (callerMs > 0) viewableSpaceMssSet.add(callerMs);
	viewableSpaceMssSet.add(1);

	if (!ownerCalled && !viewableSpaceMssSet.size) return {};

	let topLvlPostIdStrsSections: string[][] = [];
	let allPostIdObjsSet = new Map<string, IdObj>();
	let truncatedSectionIndexes: number[] = [];

	for (let i = 0; i < sections.length; i++) {
		let section = sections[i];
		let allowedSpaceMss = ownerCalled
			? section.eitherInMss.length
				? section.eitherInMss
				: [...viewableSpaceMssSet]
			: (section.eitherInMss.length ? section.eitherInMss : [...viewableSpaceMssSet]).filter((ms) =>
					viewableSpaceMssSet.has(ms),
				);

		if (!allowedSpaceMss.length && !ownerCalled) {
			topLvlPostIdStrsSections.push([]);
			continue;
		}

		let { topLvlIdObjs, truncated } = await resolveSection(db, section, allowedSpaceMss);
		if (truncated) truncatedSectionIndexes.push(i);

		let sectionIdStrs: string[] = [];
		for (let o of topLvlIdObjs) {
			let idStr = getIdStr(o);
			sectionIdStrs.push(idStr);
			allPostIdObjsSet.set(idStr, o);

			if (!section.flatView) {
				// Nested view: pull every descendant of this root too. Bounded
				// by topLvlPostLimit (max 15), so no chunking needed here.
				let descendants = await db
					.select()
					.from(pTable)
					.where(
						and(
							pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
							pf.p1.eq(o.in_ms),
							pf.p6.eq(o.ms),
							pf.p7.eq(o.by_ms),
						),
					);
				for (let d of descendants) {
					let dIdObj = { in_ms: d.p1!, ms: d.p2!, by_ms: d.p3! };
					allPostIdObjsSet.set(getIdStr(dIdObj), dIdObj);
				}
			} else {
				// Flat view: also surface the immediate parent as context.
				let ancestry = (
					await db
						.select()
						.from(pTable)
						.where(
							and(
								pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
								pf.p1.eq(o.in_ms),
								pf.p2.eq(o.ms),
								pf.p3.eq(o.by_ms),
							),
						)
				)[0];
				if (ancestry?.p4 !== null && ancestry?.p4 !== undefined) {
					let parentIdObj = { in_ms: ancestry.p1!, ms: ancestry.p4!, by_ms: ancestry.p5! };
					allPostIdObjsSet.set(getIdStr(parentIdObj), parentIdObj);
				}
			}
		}
		topLvlPostIdStrsSections.push(sectionIdStrs);
	}

	let allPostIdObjs = [...allPostIdObjsSet.values()];
	if (!allPostIdObjs.length) {
		return {
			topLvlPostIdStrsSections,
			truncatedSectionIndexes: truncatedSectionIndexes.length ? truncatedSectionIndexes : undefined,
		};
	}

	// --- Citation resolution -------------------------------------------------
	let coreRowsInitial = await runChunked(allPostIdObjs, (c) =>
		db
			.select()
			.from(pTable)
			.where(
				and(
					pf.code.eq(pc._core_postImb_lastVersion_m),
					tupleIn([pTable.p1, pTable.p2, pTable.p3], c),
				),
			),
	);
	let citedIdObjsToFetch = [
		...new Set(
			coreRowsInitial
				.flatMap((r) => getCitedPostIds(r.txt ?? ''))
				.filter((s) => !allPostIdObjsSet.has(s)),
		),
	]
		.slice(0, 88)
		.map((s) => getIdStrAsIdObj(s));

	if (citedIdObjsToFetch.length) {
		let viewabilityRows = await runChunked(
			[...new Set(citedIdObjsToFetch.map((o) => o.in_ms))],
			(spaceChunk) =>
				db
					.select()
					.from(pTable)
					.where(
						or(
							and(pf.code.eq(pc.i_accountMs_permCode_mb), pf.p1.in(spaceChunk), pf.p2.eq(callerMs)),
							and(pf.code.eq(pc.imb_spaceIsPublic), pf.p1.in(spaceChunk), pf.p4.eq(1)),
						),
					),
		);
		let viewableForCitations = new Set(viewabilityRows.map((r) => r.p1!));
		if (dbIsLocal) viewableForCitations.add(0);
		if (callerMs > 0) viewableForCitations.add(callerMs);
		viewableForCitations.add(1);

		let viewableCitedIdObjs = ownerCalled
			? citedIdObjsToFetch
			: citedIdObjsToFetch.filter((o) => viewableForCitations.has(o.in_ms));
		for (let o of viewableCitedIdObjs) allPostIdObjsSet.set(getIdStr(o), o);
	}

	allPostIdObjs = [...allPostIdObjsSet.values()];

	// --- Full data assembly ---------------------------------------------------
	let [ancestryRows, coreRows, tagJoinRows, reactionRows, reactionCountRows] = await Promise.all([
		runChunked(allPostIdObjs, (c) =>
			db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
						tupleIn([pTable.p1, pTable.p2, pTable.p3], c),
					),
				),
		),
		runChunked(allPostIdObjs, (c) =>
			db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc._core_postImb_lastVersion_m),
						tupleIn([pTable.p1, pTable.p2, pTable.p3], c),
					),
				),
		),
		runChunked(allPostIdObjs, (c) =>
			db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.tagImb_postMb_lastVersion),
						tupleIn([pTable.p1, pTable.p4, pTable.p5], c),
					),
				),
		),
		callerMs
			? runChunked(allPostIdObjs, (c) =>
					db
						.select()
						.from(pTable)
						.where(
							and(
								pf.code.eq(pc._emoji_reactionImb_postMb),
								pf.p3.eq(callerMs),
								tupleIn([pTable.p1, pTable.p4, pTable.p5], c),
							),
						),
				)
			: Promise.resolve([]),
		runChunked(allPostIdObjs, (c) =>
			db
				.select()
				.from(pTable)
				.where(
					and(pf.code.eq(pc._emoji_postImb_count), tupleIn([pTable.p1, pTable.p2, pTable.p3], c)),
				),
		),
	]);

	// Resolve tag id -> text for every tag id referenced by the join rows
	// (some may not already be in a fetched _tag_imBy8_count batch).
	let tagIdentities = [
		...new Map(
			tagJoinRows.map((r) => [
				getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }),
				{ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! },
			]),
		).values(),
	];
	let tagTextRows = await runChunked(tagIdentities, (c) =>
		db
			.select()
			.from(pTable)
			.where(and(pf.code.eq(pc._tag_imBy8_count), tupleIn([pTable.p1, pTable.p2, pTable.p3], c))),
	);
	let tagIdToTxt = new Map(
		tagTextRows.map((r) => [getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }), r.txt!]),
	);

	let idToPostMap: Record<string, FeedPost> = {};
	let ancestryByKey = new Map(
		ancestryRows.map((r) => [getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! }), r]),
	);
	for (let o of allPostIdObjs) {
		let idStr = getIdStr(o);
		let a = ancestryByKey.get(idStr);
		idToPostMap[idStr] = {
			...o,
			childCount: a?.p8 ?? 0,
			at_ms: a?.p4 ?? undefined,
			at_by_ms: a?.p5 ?? undefined,
			history: null,
		};
	}
	for (let r of coreRows) {
		let idStr = getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! });
		if (!idToPostMap[idStr]) continue;
		idToPostMap[idStr].history ??= {};
		idToPostMap[idStr].history![r.p4!] = { ms: r.p5!, tags: [], core: r.txt ?? '' };
	}
	for (let r of tagJoinRows) {
		let idStr = getIdStr({ in_ms: r.p1!, ms: r.p4!, by_ms: r.p5! });
		let tagIdStr = getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! });
		let layer = idToPostMap[idStr]?.history?.[r.p6!];
		if (layer) layer.tags.push(tagIdToTxt.get(tagIdStr) ?? tagIdStr);
	}
	for (let post of Object.values(idToPostMap))
		for (let layer of Object.values(post.history ?? {})) layer.tags.sort();
	for (let r of reactionRows) {
		let idStr = getIdStr({ in_ms: r.p1!, ms: r.p4!, by_ms: r.p5! });
		if (idToPostMap[idStr]) (idToPostMap[idStr].myRxnEmojis ??= []).push(r.txt!);
	}
	for (let r of reactionCountRows) {
		let idStr = getIdStr({ in_ms: r.p1!, ms: r.p2!, by_ms: r.p3! });
		if (idToPostMap[idStr]) (idToPostMap[idStr].rxnEmojiCount ??= {})[r.txt!] = r.p4!;
	}

	// --- Enrichment: names + membership ---------------------------------------
	let allByMss = [...new Set(Object.values(idToPostMap).map((p) => p.by_ms))];
	let allInMss = [...new Set(Object.values(idToPostMap).map((p) => p.in_ms))];

	let [accountNameRows, spaceNameRows, roleRows, flairRows] = await Promise.all([
		runChunked(allByMss, (c) =>
			db
				.select()
				.from(pTable)
				.where(and(pf.code.eq(pc._accountName_bm), pf.p1.in(c))),
		),
		runChunked(allInMss, (c) =>
			db
				.select()
				.from(pTable)
				.where(and(pf.code.eq(pc._spaceName_imb), pf.p1.in(c))),
		),
		runChunked(allInMss, (c) =>
			db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc.i_accountMs_roleCode_mb),
						pf.p1.in(c),
						pf.p2.in(allByMss.length ? allByMss : [-1]),
					),
				),
		),
		runChunked(allInMss, (c) =>
			db
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc._flair_i_accountMs_mb),
						pf.p1.in(c),
						pf.p2.in(allByMss.length ? allByMss : [-1]),
						pf.txt.notEq(''),
					),
				),
		),
	]);

	let msToAccountNameTxtMap: Record<string, string> = {};
	for (let r of accountNameRows) msToAccountNameTxtMap[r.p1!] = r.txt!;
	let msToSpaceNameTxtMap: Record<string, string> = {};
	for (let r of spaceNameRows) msToSpaceNameTxtMap[r.p1!] = r.txt!;

	let spaceMsToAccountMsToMembershipMap: Record<
		string,
		Record<string, z.infer<typeof MembershipSummarySchema>>
	> = {};
	for (let r of roleRows) {
		((spaceMsToAccountMsToMembershipMap[r.p1!] ??= {})[r.p2!] ??= {}).roleCode = { num: r.p3! };
	}
	for (let r of flairRows) {
		((spaceMsToAccountMsToMembershipMap[r.p1!] ??= {})[r.p2!] ??= {}).flair = { txt: r.txt! };
	}

	// --- Mark last-viewed ------------------------------------------------------
	if (
		input.setLastViewMsInMs &&
		viewableSpaceMssSet.has(input.setLastViewMsInMs) &&
		!dbIsLocal &&
		callerMs
	) {
		await db
			.update(pTable)
			.set({ p3: accentCodes.none, p4: Date.now() })
			.where(
				and(
					pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
					pf.p1.eq(input.setLastViewMsInMs),
					pf.p2.eq(callerMs),
				),
			);
	}

	return GetPostFeedOutputSchema.parse({
		topLvlPostIdStrsSections,
		idToPostMap,
		msToAccountNameTxtMap,
		msToSpaceNameTxtMap,
		spaceMsToAccountMsToMembershipMap,
		truncatedSectionIndexes: truncatedSectionIndexes.length ? truncatedSectionIndexes : undefined,
	});
};

export let getPostFeed = async (
	sections: PostFeedSection[],
	useLocalDb: boolean,
	setLastViewMsInMs?: number,
) => {
	let input = {
		...(await getWhoObj()),
		sections,
		setLastViewMsInMs,
	};
	return useLocalDb
		? _getPostFeed(await gsdb(), input, true, true)
		: trpc().getPostFeed.mutate(input);
};

*/
