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
							.orderBy(newFirst ? pf.p4.desc : pf.p4.asc)
							.limit(_tag_imBy8_countRequiredRows.length * section.topLvlPostLimit);
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
						tagImb_postMb_lastVersionRowsForThisLoop = await db
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
									sectionHasRequiredTags
										? or(
												..._tag_imBy8_countEitherRows.flatMap((_tag_imBy8_countEitherRow) =>
													postIdObjsWithAllRequiredTags.map((postIdObj) =>
														and(
															pf.p1.eq(_tag_imBy8_countEitherRow.p1!),
															pf.p2.eq(_tag_imBy8_countEitherRow.p2!),
															pf.p3.eq(_tag_imBy8_countEitherRow.p3!),
															pf.p4.eq(postIdObj.ms),
															pf.p5.eq(postIdObj.by_ms),
														),
													),
												),
											)
										: or(
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
							.limit(_tag_imBy8_countEitherRows.length * section.topLvlPostLimit);
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
