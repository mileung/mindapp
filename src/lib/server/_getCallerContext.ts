import { hasDefinedKeysBesidesMs, ranStr } from '$lib/js';
import { getValidAuthCookie, setCookie, type CookieObj } from '$lib/server/sessions';
import { hour, minute, week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import {
	reduceMyAccountUpdateRows,
	type CallerContext,
	type GetCallerContextGetArg,
	type MyAccountUpdates,
} from '$lib/types/accounts';
import {
	channelPartsByCode,
	sameGranularNum,
	type GranularNumProp,
	type PartInsert,
} from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { pTable } from '$lib/types/parts/partsTable';
import { PostFeedSectionSchema } from '$lib/types/posts/getPostFeed';
import {
	permissionCodes,
	reduceMySpaceUpdateRows,
	roleCodes,
	type MySpaceUpdate,
} from '$lib/types/spaces';
import { and, or } from 'drizzle-orm';
import { z } from 'zod';
import { tdb } from './db';

// export let getCallerContext = async (get: GetCallerContextGetArg) => {
// 	let baseInput = await getWhoWhereObj();
// 	// TODO: use local tdb as a fallback when cloud tdb can't find a post
// 	return baseInput.spaceMs
// 		? trpc().getCallerContext.mutate({ ...baseInput, get })
// 		: _getCallerContext(await gsdb(), null, baseInput, get);
// };

export let GetCallerContextAndThenSchema = z
	.strictObject({
		getPostFeed: z
			.strictObject({
				sections: z.array(PostFeedSectionSchema).max(3),
				setLastViewMsInMs: z.number().optional(),
			})
			.optional(),
	})
	.optional();
export type GetCallerContextAndThen = z.infer<typeof GetCallerContextAndThenSchema>;

export let _getCallerContext = async (
	ctx: Context,
	{
		callerMs,
		spaceMs,
	}: {
		callerMs: number;
		spaceMs?: number;
	},
	get: GetCallerContextGetArg,
	andThen?: GetCallerContextAndThen, // TODO: _getCallerContext should return the subsequent call to be made so there isn't multiple API calls on page load
): Promise<CallerContext> => {
	// console.log('get:', get);
	// console.log('get', JSON.stringify(get, null, 2));
	if (!get.signedIn && (get.roleCode || get.permissionCode))
		throw new Error('must get signed in to get callerRole or permissionCode');
	if (
		(get.isPublic || get.roleCode || get.permissionCode) &&
		(spaceMs === undefined || spaceMs < 1)
	)
		throw new Error('spaceMs must be gt0');
	// if (!get.roleCode && get.permissionCode)
	// 	throw new Error('must get roleCode to get permissionCode');

	let now = Date.now();
	let sessionIdObj = getValidAuthCookie(ctx, 'ms_sessionKey');

	let signedIn: undefined | boolean;
	let isPublic: undefined | GranularNumProp;
	let roleCode: undefined | GranularNumProp;
	let permissionCode: undefined | GranularNumProp;
	let inGlobal: undefined | boolean;

	let {
		spaceUpdatesFrom = [], //
		signedInAccountUpdatesFrom = [],
	} = get;

	if (
		(get.signedIn || get.isPublic || get.roleCode || get.permissionCode) &&
		(spaceUpdatesFrom.length || signedInAccountUpdatesFrom.length)
	)
		throw new Error(
			`Cannot use get[signedIn/isPublic/roleCode/permissionCode] and spaceUpdatesFrom/signedInAccountUpdatesFrom at the same time`,
		);
	if (spaceMs && (get.isPublic || get.roleCode || get.permissionCode)) {
		spaceUpdatesFrom.push({
			ms: spaceMs,
			isPublic: get.isPublic ? { num: -1 } : undefined,
			roleCode: get.roleCode ? { num: -1 } : undefined,
			permissionCode: get.permissionCode ? { num: -1 } : undefined,
		});
	}
	if (get.inGlobal) spaceUpdatesFrom.push({ ms: 1 });

	if (sessionIdObj && callerMs && !signedInAccountUpdatesFrom.some((a) => a.ms === callerMs))
		signedInAccountUpdatesFrom.push({ ms: callerMs });
	let callerAccountUpdatesFrom: undefined | MyAccountUpdates;
	signedInAccountUpdatesFrom = signedInAccountUpdatesFrom.filter((a) => {
		if (a.ms) {
			if (a.ms === callerMs) callerAccountUpdatesFrom = a;
			return true;
		}
	});

	// Assume spaceUpdatesFrom and signedInAccountUpdatesFrom do not
	// have duplicate spaces/accounts otherwise garbage out

	// if ([new Set(spaceUpdatesFrom.map((s) => s.ms))].length !== spaceUpdatesFrom.length)
	// 	throw new Error(`duplicate spaces in spaceUpdatesFrom`);
	// if (
	// 	[new Set(signedInAccountUpdatesFrom.map((a) => a.ms))].length !==
	// 	signedInAccountUpdatesFrom.length
	// )
	// 	throw new Error(`duplicate accounts in signedInAccountUpdatesFrom`);

	let forcedSpaceUpdateRows: PartInsert[] = [];

	let filters = [
		...(sessionIdObj
			? [
					signedInAccountUpdatesFrom.length
						? and(
								pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
								pf.txt.eq(sessionIdObj.txt),
								pf.p1.eq(sessionIdObj.ms),
								or(...signedInAccountUpdatesFrom.map((a) => pf.p2.eq(a.ms))),
								pf.p3.gt(now),
							)
						: undefined,
					callerMs && get.allJoinedSpaces
						? and(
								pf.code.eq(pc.acceptIbm_inviteMb),
								...spaceUpdatesFrom.map((su) => pf.p1.notEq(su.ms)),
								pf.p2.eq(callerMs),
							)
						: undefined,
					// pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
				]
			: []),
		...spaceUpdatesFrom.flatMap((su) => {
			if (!su.ms) throw new Error(`cannot get updates from local space`);
			if (su.ms === callerMs) {
				su.isPublic &&
					su.isPublic.num !== 0 &&
					forcedSpaceUpdateRows.push({
						code: pc.imb_spaceIsPublic,
						p1: su.ms,
						p2: 0,
						p3: 0,
						p4: 0,
					});
				if (su.ms === spaceMs) {
					forcedSpaceUpdateRows.push({
						code: pc.i_accountMs_permCode_mb,
						p1: callerMs,
						p2: callerMs,
						p3: permissionCodes.reactAndPost,
						p4: callerMs,
					});
					su.roleCode &&
						su.roleCode.num !== roleCodes.admin &&
						forcedSpaceUpdateRows.push({
							code: pc.i_accountMs_roleCode_mb,
							p1: callerMs,
							p2: callerMs,
							p3: roleCodes.admin,
							p4: callerMs,
							p5: 0,
						});
				}
				// su.accentCode!==undefined&&su.accentCode!==accentCodes.none &&
				// 	forcedSpaceUpdateRows.push({
				// 		code: pc.i_accountMs_accentCode_lastViewMs_sidePriority,
				// 		p3: accentCodes.none,
				// 	});
			}

			if (su.ms === 1 && su.isPublic && su.isPublic.num !== 1)
				forcedSpaceUpdateRows.push({
					code: pc.imb_spaceIsPublic,
					p1: 1,
					p2: 0,
					p3: 0,
					p4: 1,
				});
			return [
				su.ms &&
				su.ms !== callerMs &&
				(su.accentCode !== undefined || su.sidePriority !== undefined)
					? and(
							pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
							pf.p1.eq(su.ms),
							pf.p2.eq(callerMs),
							or(
								su.accentCode === undefined ? undefined : pf.p3.notEq(su.accentCode),
								su.sidePriority === undefined ? undefined : pf.p5.notEq(su.sidePriority),
							),
						)
					: undefined,
				su.ms === spaceMs && su.pinnedQuery
					? and(
							pf.code.eq(pc._spacePinnedQuery_imb),
							pf.p1.eq(su.ms),
							or(
								pf.p2.notEq(su.pinnedQuery.ms ?? 0),
								pf.txt.notEq(su.pinnedQuery.txt), //
							),
						)
					: undefined,
				...(su.ms && su.ms !== callerMs
					? [
							and(
								pf.code.eq(pc.i_accountMs_permCode_mb),
								pf.p1.eq(su.ms), //
								pf.p2.eq(callerMs),
							),
							su.ms > 1 && su.name
								? and(
										pf.code.eq(pc._spaceName_imb),
										pf.p1.eq(su.ms),
										or(
											pf.p2.notEq(su.name.ms ?? 0),
											pf.txt.notEq(su.name.txt), //
										),
									)
								: undefined,
							...(su.ms === spaceMs
								? [
										su.ms > 1 && su.isPublic
											? and(
													pf.code.eq(pc.imb_spaceIsPublic),
													pf.p1.eq(su.ms),
													or(
														pf.p2.notEq(su.isPublic.ms ?? 0),
														pf.p4.notEq(su.isPublic.num), //
													),
												)
											: undefined,
										su.roleCode
											? and(
													pf.code.eq(pc.i_accountMs_roleCode_mb),
													pf.p1.eq(su.ms),
													pf.p2.eq(callerMs),
													or(
														pf.p3.notEq(su.roleCode.num), //
														pf.p4.notEq(su.roleCode.ms ?? 0),
													),
												)
											: undefined,
										su.flair
											? and(
													pf.code.eq(pc._flair_i_accountMs_mb),
													pf.p1.eq(su.ms),
													pf.p2.eq(callerMs),
													or(
														pf.p3.notEq(su.flair.ms ?? 0),
														pf.txt.notEq(su.flair.txt), //
													),
												)
											: undefined,
									]
								: []),
						]
					: []),
			];
		}),
		...signedInAccountUpdatesFrom.flatMap((signedInAccountUpdate) => [
			signedInAccountUpdate.email &&
				and(
					pf.code.eq(pc._accountEmail_bm),
					pf.p1.eq(signedInAccountUpdate.ms),
					or(
						pf.p2.notEq(signedInAccountUpdate.email.ms ?? 0),
						pf.txt.notEq(signedInAccountUpdate.email.txt), //
					),
				),
			signedInAccountUpdate.name &&
				and(
					pf.code.eq(pc._accountName_bm),
					pf.p1.eq(signedInAccountUpdate.ms),
					or(
						pf.p2.notEq(signedInAccountUpdate.name.ms ?? 0),
						pf.txt.notEq(signedInAccountUpdate.name.txt), //
					),
				),
			signedInAccountUpdate.bio &&
				and(
					pf.code.eq(pc._accountBio_bm),
					pf.p1.eq(signedInAccountUpdate.ms),
					or(
						pf.p2.notEq(signedInAccountUpdate.bio.ms ?? 0),
						pf.txt.notEq(signedInAccountUpdate.bio.txt), //
					),
				),
			signedInAccountUpdate.savedTags &&
				and(
					pf.code.eq(pc._accountSavedTags_bm),
					pf.p1.eq(signedInAccountUpdate.ms),
					or(
						pf.p2.notEq(signedInAccountUpdate.savedTags.ms ?? 0),
						pf.txt.notEq(signedInAccountUpdate.savedTags.txt), //
					),
				),
		]),
	];
	let {
		// prettier-ignore
		[pc.i_accountMs_accentCode_lastViewMs_sidePriority]: i_accountMs_accentCode_lastViewMs_sidePriorityRows = [],
		[pc._sessionKey_m_accountMs_expiryMs]: _sessionKey_m_accountMs_expiryMsRows = [],
		[pc.i_accountMs_roleCode_mb]: i_accountMs_roleCode_mbRows = [],
		[pc.i_accountMs_permCode_mb]: i_accountMs_permCode_mbRows = [],
		[pc._spacePinnedQuery_imb]: _spacePinnedQuery_imbRows = [],
		[pc._flair_i_accountMs_mb]: _flair_i_accountMs_mbRows = [],
		[pc._accountSavedTags_bm]: _accountSavedTags_bmRows = [],
		[pc.acceptIbm_inviteMb]: acceptIbm_inviteMbRows = [],
		[pc.imb_spaceIsPublic]: imb_spaceIsPublicRows = [],
		[pc._accountEmail_bm]: _accountEmail_bmRows = [],
		[pc._accountName_bm]: _accountName_bmRows = [],
		[pc._spaceName_imb]: _spaceName_imbRows = [],
		[pc._accountBio_bm]: _accountBio_bmRows = [],
	} = channelPartsByCode([
		...(filters.some((f) => f)
			? await tdb
					.select()
					.from(pTable)
					.where(or(...filters))
			: []),
		...forcedSpaceUpdateRows,
	]);

	if (
		i_accountMs_roleCode_mbRows.some(
			({ p3 }) =>
				p3 !== roleCodes.member &&
				p3 !== roleCodes.mod && //
				p3 !== roleCodes.admin,
		)
	)
		throw new Error(`invalid roleCode num`);
	if (
		i_accountMs_permCode_mbRows.some(
			({ p3 }) =>
				p3 !== permissionCodes.viewOnly &&
				p3 !== permissionCodes.reactOnly &&
				p3 !== permissionCodes.postOnly &&
				p3 !== permissionCodes.reactAndPost,
		)
	)
		throw new Error(`invalid permissionCode num`);

	let _sessionKey_m_accountMs_expiryMsCallerRow = _sessionKey_m_accountMs_expiryMsRows.find(
		(row) => row.p2 === callerMs,
	);
	let msToSpaceUpdatesFrom: Record<number, undefined | MySpaceUpdate> = {};
	for (let i = 0; i < spaceUpdatesFrom.length; i++) {
		let u = spaceUpdatesFrom[i];
		msToSpaceUpdatesFrom[u.ms] = u;
	}
	if (get.allJoinedSpaces && _sessionKey_m_accountMs_expiryMsCallerRow) {
		let unfetchedSpaceMss: number[] = [];
		for (let i = 0; i < acceptIbm_inviteMbRows.length; i++) {
			let { p1 } = acceptIbm_inviteMbRows[i];
			if (!msToSpaceUpdatesFrom[p1!]) unfetchedSpaceMss.push(p1!);
		}
		if (unfetchedSpaceMss.length) {
			let {
				// prettier-ignore
				[pc.i_accountMs_accentCode_lastViewMs_sidePriority]: i_accountMs_accentCode_lastViewMs_sidePriorityRows_ = [],
				[pc.i_accountMs_roleCode_mb]: i_accountMs_roleCode_mbRows_ = [],
				[pc.i_accountMs_permCode_mb]: i_accountMs_permCode_mbRows_ = [],
				[pc._spacePinnedQuery_imb]: _spacePinnedQuery_imbRows_ = [],
				[pc.imb_spaceIsPublic]: imb_spaceIsPublicRows_ = [],
				[pc._spaceName_imb]: _spaceName_imbRows_ = [],
			} = channelPartsByCode(
				await tdb
					.select()
					.from(pTable)
					.where(
						or(
							and(
								or(...unfetchedSpaceMss.map((ms) => pf.p1.eq(ms))),
								or(
									pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
									pf.code.eq(pc.i_accountMs_roleCode_mb),
									pf.code.eq(pc.i_accountMs_permCode_mb),
									pf.code.eq(pc._spacePinnedQuery_imb),
									pf.code.eq(pc.imb_spaceIsPublic),
									pf.code.eq(pc._spaceName_imb),
								),
							),
						),
					),
			);
			// prettier-ignore
			i_accountMs_accentCode_lastViewMs_sidePriorityRows.push(...i_accountMs_accentCode_lastViewMs_sidePriorityRows_);
			i_accountMs_roleCode_mbRows.push(...i_accountMs_roleCode_mbRows_);
			i_accountMs_permCode_mbRows.push(...i_accountMs_permCode_mbRows_);
			_spacePinnedQuery_imbRows.push(..._spacePinnedQuery_imbRows_);
			imb_spaceIsPublicRows.push(...imb_spaceIsPublicRows_);
			_spaceName_imbRows.push(..._spaceName_imbRows_);
		}
	}

	let spaceUpdatedRows = [
		...i_accountMs_accentCode_lastViewMs_sidePriorityRows,
		...i_accountMs_permCode_mbRows,
		...i_accountMs_roleCode_mbRows,
		..._spacePinnedQuery_imbRows,
		..._flair_i_accountMs_mbRows,
		...imb_spaceIsPublicRows,
		..._spaceName_imbRows,
	];
	let spaceMsToRowsMap: Record<number, PartInsert[]> = {};
	for (let i = 0; i < spaceUpdatedRows.length; i++) {
		let row = spaceUpdatedRows[i];
		spaceMsToRowsMap[row.p1!] ??= [];
		spaceMsToRowsMap[row.p1!].push(row);
	}
	let spaceMssWithPermission = _sessionKey_m_accountMs_expiryMsCallerRow
		? i_accountMs_permCode_mbRows.map((r) => r.p1!)
		: [];
	let callerJoinedSpaceMs = false;
	let spaceUpdates: MySpaceUpdate[] = spaceMssWithPermission.map((ms) => {
		if (ms === spaceMs) callerJoinedSpaceMs = true;
		let su = reduceMySpaceUpdateRows(spaceMsToRowsMap[ms], ms);
		let spaceUpdateFrom = msToSpaceUpdatesFrom[ms];
		// Need this if statement since i_accountMs_permCode_mb is fetched every time `su.ms && su.ms !== callerMs`
		if (
			!spaceUpdateFrom?.permissionCode ||
			su.ms === callerMs ||
			sameGranularNum(su.permissionCode, spaceUpdateFrom?.permissionCode)
		)
			su.permissionCode = undefined;
		if (spaceUpdateFrom?.accentCode === su.accentCode) su.accentCode = undefined;
		if (spaceUpdateFrom?.sidePriority === su.sidePriority) su.sidePriority = undefined;
		return su;
	});
	let visitingPublicSpaceUpdate: undefined | MySpaceUpdate =
		spaceMs !== undefined &&
		!callerJoinedSpaceMs &&
		(spaceMs === 1 || imb_spaceIsPublicRows.some((r) => r.p1 === spaceMs && r.p4))
			? reduceMySpaceUpdateRows(spaceMsToRowsMap[spaceMs], spaceMs)
			: undefined;

	if (visitingPublicSpaceUpdate) {
		let spaceUpdateFrom = msToSpaceUpdatesFrom[visitingPublicSpaceUpdate.ms];
		if (sameGranularNum(visitingPublicSpaceUpdate.isPublic, spaceUpdateFrom?.isPublic))
			visitingPublicSpaceUpdate.isPublic = undefined;
		if (!hasDefinedKeysBesidesMs(visitingPublicSpaceUpdate)) visitingPublicSpaceUpdate = undefined;
	}

	let accountUpdatedRows = [
		..._accountSavedTags_bmRows,
		..._accountEmail_bmRows,
		..._accountName_bmRows,
		..._accountBio_bmRows,
	];
	let accountMsToRowsMap: Record<number, PartInsert[]> = {};
	for (let i = 0; i < accountUpdatedRows.length; i++) {
		let row = accountUpdatedRows[i];
		accountMsToRowsMap[row.p1!] ??= [];
		accountMsToRowsMap[row.p1!].push(row);
	}
	let signedInAccountUpdates: MyAccountUpdates[] = _sessionKey_m_accountMs_expiryMsRows.map(
		({ p2 }) => {
			let accountUpdate = reduceMyAccountUpdateRows(accountMsToRowsMap[p2!], p2!);
			if (accountUpdate.savedTags && callerAccountUpdatesFrom?.savedTags) {
				let savedTagsFrom = JSON.parse(callerAccountUpdatesFrom?.savedTags.txt) as string[];
				let latestSavedTags = JSON.parse(accountUpdate.savedTags.txt) as string[];

				let savedTagsFromSet = new Set(savedTagsFrom);
				let latestSavedTagsSet = new Set(latestSavedTags);

				accountUpdate.savedTagChanges = {
					ms: accountUpdate.savedTags.ms!,
					addedTags: latestSavedTags.filter((t) => !savedTagsFromSet.has(t)),
					removedTags: savedTagsFrom.filter((t) => !latestSavedTagsSet.has(t)),
				};
				delete accountUpdate.savedTags;
			}
			return accountUpdate;
		},
	);

	if (_sessionKey_m_accountMs_expiryMsCallerRow) {
		if (get.signedIn) {
			signedIn = true;
			if (get.roleCode) {
				if (spaceMs === callerMs) roleCode = { num: roleCodes.admin };
				else {
					let i_accountMs_roleCode_mbRowInCallerSpace = i_accountMs_roleCode_mbRows.find(
						(row) => row.p1 === spaceMs && row.p2 === callerMs,
					);
					if (i_accountMs_roleCode_mbRowInCallerSpace) {
						let { p4, p3 } = i_accountMs_roleCode_mbRowInCallerSpace;
						roleCode = { ms: p4!, num: p3! };
					}
				}
			}
			if (get.permissionCode) {
				if (spaceMs === callerMs) {
					permissionCode = { num: permissionCodes.reactAndPost };
				} else {
					let i_accountMs_permCode_mbRowInCallerSpace = i_accountMs_permCode_mbRows.find(
						(row) => row.p1 === spaceMs && row.p2 === callerMs,
					);
					if (i_accountMs_permCode_mbRowInCallerSpace) {
						let { p4, p3 } = i_accountMs_permCode_mbRowInCallerSpace;
						permissionCode = { ms: p4!, num: p3! };
					}
				}
			}
			if (get.inGlobal) {
				inGlobal = i_accountMs_permCode_mbRows.some((row) => row.p1 === 1 && row.p2 === callerMs);
			}
		}
		if (now - _sessionKey_m_accountMs_expiryMsCallerRow.p1! > hour) {
			let newSessionObj: CookieObj = { ms: now, txt: ranStr() };
			setCookie(ctx, 'ms_sessionKey', newSessionObj);
			await tdb.insert(pTable).values({
				code: pc._sessionKey_m_accountMs_expiryMs,
				txt: newSessionObj.txt,
				p1: newSessionObj.ms,
				p2: callerMs,
				p3: now + week,
			});
			let _sessionKey_m_accountMs_expiryMsPartialFilter = [
				pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
				pf.txt.eq(_sessionKey_m_accountMs_expiryMsCallerRow.txt!),
				pf.p1.eq(_sessionKey_m_accountMs_expiryMsCallerRow.p1!),
			];
			await tdb
				.update(pTable)
				.set({ p3: now + minute })
				// TODO: Apparently the client can be closed before knowing the cookie is updated
				.where(
					and(
						..._sessionKey_m_accountMs_expiryMsPartialFilter,
						pf.p2.eq(callerMs), //
					),
				);
			await tdb
				.update(pTable)
				.set({
					txt: newSessionObj.txt,
					p1: newSessionObj.ms,
					p3: now + week,
				})
				.where(
					and(
						..._sessionKey_m_accountMs_expiryMsPartialFilter,
						pf.p2.notEq(callerMs), //
					),
				);
		}
	} else if (callerMs) spaceUpdates = [];

	if (get.isPublic) {
		if (spaceMs === 1) isPublic = { num: 1 };
		else if (spaceMs === callerMs) isPublic = { num: 0 };
		else {
			let imb_spaceIsPublicRowInCallerSpace = imb_spaceIsPublicRows.find(
				(row) => row.p1 === spaceMs,
			);
			if (imb_spaceIsPublicRowInCallerSpace) {
				let { p2, p4 } = imb_spaceIsPublicRowInCallerSpace;
				isPublic = permissionCode || p4 ? { ms: p2!, num: p4! } : undefined;
			}
		}
	}

	let removedSpaceMss: number[] = spaceUpdatesFrom
		.filter((su) => su.ms && !su.visiting && !spaceMssWithPermission.includes(su.ms))
		.map((su) => su.ms);
	let signedOutAccountMss: number[] = signedInAccountUpdatesFrom
		.filter(
			(accountFrom) =>
				!sessionIdObj ||
				!signedInAccountUpdates.some((accountUpdate) => accountUpdate.ms === accountFrom.ms),
		)
		.map((su) => su.ms);
	spaceUpdates = spaceUpdates.filter((s) => hasDefinedKeysBesidesMs(s));
	signedInAccountUpdates = signedInAccountUpdates.filter((s) => hasDefinedKeysBesidesMs(s));

	return {
		signedIn,
		roleCode,
		permissionCode,
		isPublic,
		inGlobal,

		visitingPublicSpaceUpdate,
		removedSpaceMss: removedSpaceMss.length ? removedSpaceMss : undefined,
		signedOutAccountMss: signedOutAccountMss.length ? signedOutAccountMss : undefined,
		spaceUpdates: spaceUpdates.length ? spaceUpdates : undefined,
		signedInAccountUpdates: signedInAccountUpdates.length ? signedInAccountUpdates : undefined,
	};
};
