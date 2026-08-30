import { dev } from '$app/environment';
import { assertInputIsOwner, atDomainRegex, emailRegex, inputIsOwner, throwIf } from '$lib/js';
import { scrape } from '$lib/scrape';
import { _getCallerContext } from '$lib/server/_getCallerContext';
import { _getPublicProfile } from '$lib/server/_getPublicProfile';
import { tdb } from '$lib/server/db';
import { _getOwnerViewAccounts } from '$lib/server/ownerView/_getOwnerViewAccounts';
import { _getOwnerViewSpaces } from '$lib/server/ownerView/_getOwnerViewSpaces';
import { _setAccountBan } from '$lib/server/ownerView/_setAccountBan';
import { _setOwnerViewAttributes } from '$lib/server/ownerView/_setOwnerViewAttributes';
import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { GetCallerContextGetArgSchema, passwordRegexStr } from '$lib/types/accounts';
import { _changeMyAccountAttributes } from '$lib/types/accounts/_changeMyAccountAttributes';
import { _changeSpaceAttributes } from '$lib/types/accounts/_changeSpaceAttributes';
import { _createAccount } from '$lib/types/accounts/_createAccount';
import { _removeSpaceMember } from '$lib/types/accounts/_removeSpaceMember';
import { _resetPasswordSignedIn } from '$lib/types/accounts/_resetPasswordSignedIn';
import { _setSpaceMemberFlair } from '$lib/types/accounts/_setSpaceMemberFlair';
import { _setSpaceMemberPermission } from '$lib/types/accounts/_setSpaceMemberPermission';
import { _setSpaceMemberRole } from '$lib/types/accounts/_setSpaceMemberRole';
import { _signIn } from '$lib/types/accounts/_signIn';
import { _signOut } from '$lib/types/accounts/_signOut';
import { _updateSavedTags } from '$lib/types/accounts/_updateSavedTags';
import { _checkOtp } from '$lib/types/otp/_checkOtp';
import { _sendOtp } from '$lib/types/otp/_sendOtp';
import {
	GranularNumPropSchema,
	GranularTxtPropSchema,
	WhoObjSchema,
	WhoWhereObjSchema,
} from '$lib/types/parts';
import { IdObjSchema } from '$lib/types/parts/partIds';
import { PostSchema } from '$lib/types/posts';
import { _addPost } from '$lib/types/posts/addPost';
import { _deletePost } from '$lib/types/posts/deletePost';
import { _editPost } from '$lib/types/posts/editPost';
import { _getPostFeed, PostFeedSectionSchema } from '$lib/types/posts/getPostFeed';
import { _getPostHistory } from '$lib/types/posts/getPostHistory';
import { EmojiStringSchema } from '$lib/types/reactions';
import { _addReaction } from '$lib/types/reactions/addReaction';
import { _getReactionHistory } from '$lib/types/reactions/getReactionHistory';
import { _removeReaction } from '$lib/types/reactions/removeReaction';
import { permissionCodes, roleCodes } from '$lib/types/spaces';
import { _checkInvite } from '$lib/types/spaces/_checkInvite';
import { _createInviteLink } from '$lib/types/spaces/_createInviteLink';
import { _createSpace } from '$lib/types/spaces/_createSpace';
import { _deleteSpace } from '$lib/types/spaces/_deleteSpace';
import { _getSpaceDots } from '$lib/types/spaces/_getSpaceDots';
import { _revokeInviteLink } from '$lib/types/spaces/_revokeInviteLink';
import { _updateSidePriority } from '$lib/types/spaces/_updateSidePriority';
import { _getSpaceTags } from '$lib/types/spaces/getSpaceTags';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import {
	emailLimiter,
	feedLimiter,
	generalLimiter,
	makeLimiter,
	postLimiter,
	reactionLimiter,
	signInLimiter,
} from '../server/rateLimiters';

let pinStrSchema = z.string().length(8);
let passwordSchema = z.string().regex(new RegExp(passwordRegexStr));
let normalizingNameSchema = z
	.string()
	.max(88)
	.transform((s) => s.trim());
let normalizingBioOrDescriptionSchema = z
	.string()
	.max(888)
	.transform((s) => s.trim());
let normalizingEmailSchema = z
	.string()
	.min(6)
	.max(254)
	.transform((s) => s.trim().toLowerCase())
	.refine((s) => emailRegex.test(s), 'invalid email');

let t = initTRPC.context<Context>().create();

let makeProcedure = (
	rateLimiter: {
		ping: (ctx: Context) => Promise<void>;
	} = generalLimiter,
) =>
	t.procedure.use(async ({ ctx, next }) => {
		if (dev) {
			let simulateNetworkLatency = false;
			simulateNetworkLatency = true;
			if (simulateNetworkLatency) await new Promise((res) => setTimeout(res, 800));
		}
		await rateLimiter.ping(ctx);
		return next();
	});

let test = 0;
let testLimiter = makeLimiter(3, 1 / 6);
export let router = t.router({
	test: makeProcedure(testLimiter).query(() => ({ test: ++test })),
	scrape: makeProcedure()
		.input(z.strictObject({ url: z.string().url() }).strict())
		.mutation(async ({ input }) => {
			if (1) return;
			// TODO: paste a url in mindapp url as a search or maybe under /parse/[text].
			// fetch the page and scrape it as if using the extension shortcut.
			// Useful for environments where the Mindapp browser extension can't be used
			try {
				// TODO: DOMParser not available server side
				return scrape(input.url, await (await fetch(input.url)).text());
			} catch (error) {
				throw new Error(`Fetch error: ${error}`);
			}
		}),
	sendOtp: makeProcedure(emailLimiter)
		.input(
			z.strictObject({
				email: normalizingEmailSchema,
				will: z.strictObject({
					createAccount: z.boolean().optional(),
					signIn: z.boolean().optional(),
					resetPassword: z.boolean().optional(),
				}),
			}),
		)
		.mutation(({ input }) => _sendOtp(input)),
	checkOtp: makeProcedure()
		.input(
			z.strictObject({
				otpMs: z.number(),
				pinStr: pinStrSchema,
				email: normalizingEmailSchema,
			}),
		)
		.mutation(async ({ input }) => _checkOtp({ ...input, deleteIfCorrect: false })),
	createAccount: makeProcedure()
		.input(
			z.strictObject({
				name: normalizingNameSchema,
				otpMs: z.number(),
				pinStr: pinStrSchema,
				email: normalizingEmailSchema,
				password: passwordSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => _createAccount(ctx, input)),
	signIn: makeProcedure(signInLimiter)
		.input(
			z.strictObject({
				otpMs: z.number().optional(),
				pinStr: pinStrSchema.optional(),
				email: normalizingEmailSchema,
				password: passwordSchema,
				resetPassword: z.boolean().optional(),
			}),
		)
		.mutation(({ ctx, input }) => _signIn(ctx, input)),
	getPublicProfile: makeProcedure()
		.input(
			WhoObjSchema.extend({
				profileMs: z.number(),
				possibleMutualSpaceMss: z.array(z.number()).optional(),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			if (ownerCalled || (input.callerMs && input.possibleMutualSpaceMss?.length)) {
				let c = await _getCallerContext(ctx, input, { signedIn: true });
				throwIf(!c.signedIn);
			}
			return _getPublicProfile(input, ownerCalled);
		}),
	getCallerContext: makeProcedure()
		.input(
			WhoObjSchema.extend({
				spaceMs: z.number().optional(), // this is the only api function that can be called when urlInMs = 0
				get: GetCallerContextGetArgSchema,
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => _getCallerContext(ctx, input, input.get)),
	resetPasswordSignedIn: makeProcedure()
		.input(
			WhoObjSchema.extend({
				oldPassword: passwordSchema,
				newPassword: passwordSchema,
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(!input.callerMs);
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _resetPasswordSignedIn(input);
		}),
	signOut: makeProcedure()
		.input(WhoObjSchema.extend({ everywhere: z.boolean() }).strict())
		.mutation(async ({ ctx, input }) => {
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _signOut(ctx, input);
		}),
	updateSavedTags: makeProcedure()
		.input(
			WhoObjSchema.extend({
				addTags: z.array(z.string().max(88)).max(8888),
				removeTags: z.array(z.string().max(88)).max(8888),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, { signedIn: true, inGlobal: !ownerCalled });
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.inGlobal);
			return _updateSavedTags(input);
		}),
	checkInvite: makeProcedure()
		.input(
			WhoObjSchema.extend({
				inviteMs: z.number(),
				slugEnd: z.string(),
				useIfValid: z.boolean(),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			if (input.useIfValid) {
				let c = await _getCallerContext(ctx, input, { signedIn: input.useIfValid });
				throwIf(!c.signedIn);
			}
			return _checkInvite(input);
		}),
	changeMyAccountAttributes: makeProcedure()
		.input(
			WhoObjSchema.extend({
				nameTxt: normalizingNameSchema.optional(),
				bioTxt: normalizingBioOrDescriptionSchema.optional(),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(input.nameTxt === undefined && input.bioTxt === undefined);
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, { signedIn: true, inGlobal: !ownerCalled });
			throwIf(!c.signedIn || (!ownerCalled && !c.inGlobal));
			return _changeMyAccountAttributes(input);
		}),
	createSpace: makeProcedure()
		.input(
			WhoObjSchema.extend({
				spaceNameTxt: normalizingNameSchema,
				spaceDescriptionTxt: normalizingBioOrDescriptionSchema,
				spacePinnedQueryTxt: normalizingBioOrDescriptionSchema,
				spaceIsPublicBin: z.number().gte(0).lte(1),
				newMemberPermissionCodeNum: z
					.number()
					.gte(permissionCodes.viewOnly)
					.lte(permissionCodes.reactAndPost),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, { signedIn: true, inGlobal: !ownerCalled });
			throwIf(!c.signedIn || (!ownerCalled && !c.inGlobal));
			return _createSpace(input);
		}),
	deleteSpace: makeProcedure()
		.input(WhoWhereObjSchema.strict())
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: !ownerCalled,
			});
			throwIf(!c.signedIn);
			if (!ownerCalled) throwIf(c.roleCode?.num !== roleCodes.admin);
			return _deleteSpace(input);
		}),
	updateSidePriority: makeProcedure()
		.input(
			WhoObjSchema.extend({
				spaceMsToSidePriorityMap: z.record(z.string(), z.number()),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _updateSidePriority(input);
		}),
	removeSpaceMember: makeProcedure()
		.input(WhoWhereObjSchema.extend({ accountMs: z.number() }).strict())
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: !ownerCalled,
				inGlobal: !ownerCalled,
			});
			throwIf(!c.signedIn);
			if (!ownerCalled) {
				throwIf(!c.inGlobal && input.accountMs !== input.callerMs);
				throwIf(
					!c.roleCode ||
						(input.accountMs !== input.callerMs && //
							c.roleCode.num !== roleCodes.admin),
				);
			}
			return _removeSpaceMember(
				{ ...input, callerRoleCodeNum: c.roleCode?.num },
				ownerCalled, //
			);
		}),
	setSpaceMemberFlair: makeProcedure()
		.input(
			WhoWhereObjSchema.extend({
				accountMs: z.number(),
				flairTxt: z.string().max(88),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: !ownerCalled,
				inGlobal: !ownerCalled,
			});
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.inGlobal || !c.roleCode);
			return _setSpaceMemberFlair(
				{ ...input, callerRoleCodeNum: c.roleCode?.num },
				ownerCalled, //
			);
		}),
	setSpaceMemberPermission: makeProcedure()
		.input(
			WhoWhereObjSchema.extend({
				accountMs: z.number(),
				newPermissionCodeNum: z
					.literal(permissionCodes.viewOnly)
					.or(z.literal(permissionCodes.reactOnly))
					.or(z.literal(permissionCodes.postOnly))
					.or(z.literal(permissionCodes.reactAndPost)),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: !ownerCalled,
				inGlobal: !ownerCalled,
			});
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.inGlobal || !c.roleCode);
			return _setSpaceMemberPermission(
				{ ...input, callerRoleCodeNum: c.roleCode?.num },
				ownerCalled,
			);
		}),
	setSpaceMemberRole: makeProcedure()
		.input(
			WhoWhereObjSchema.extend({
				accountMs: z.number(),
				newRoleCodeNum: z
					.literal(roleCodes.member)
					.or(z.literal(roleCodes.mod))
					.or(z.literal(roleCodes.admin)),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: !ownerCalled,
				inGlobal: !ownerCalled,
			});
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.inGlobal || !c.roleCode);
			return _setSpaceMemberRole({ ...input, callerRoleCodeNum: c.roleCode?.num }, ownerCalled);
		}),
	changeSpaceAttributes: makeProcedure()
		.input(
			WhoWhereObjSchema.extend({
				nameTxt: normalizingNameSchema.optional(),
				descriptionTxt: normalizingBioOrDescriptionSchema.optional(),
				pinnedQueryTxt: normalizingBioOrDescriptionSchema.optional(),
				isPublicNum: z.number().gte(0).lte(1).optional(),
				newMemberPermissionCodeNum: z
					.number()
					.gte(permissionCodes.viewOnly)
					.lte(permissionCodes.reactAndPost)
					.optional(),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(
				input.nameTxt === undefined &&
					input.descriptionTxt === undefined &&
					input.pinnedQueryTxt === undefined &&
					input.isPublicNum === undefined &&
					input.newMemberPermissionCodeNum === undefined,
			);
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: !ownerCalled,
				inGlobal: !ownerCalled,
			});
			throwIf(!c.signedIn);
			if (!ownerCalled) {
				throwIf(!c.inGlobal);
				throwIf(c.roleCode?.num !== roleCodes.admin);
			}
			return _changeSpaceAttributes(input);
		}),
	addPost: makeProcedure(postLimiter)
		.input(
			WhoObjSchema.extend({
				post: PostSchema,
				citedPostIdObjsToFetch: z.array(IdObjSchema).max(88),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let { post } = input;
			// TODO: allow non zero ms if the caller is an admin of the space (useful for importing old posts)
			throwIf(!post.in_ms || post.ms || !post.by_ms);
			if (!post.history || Object.keys(post.history).length !== 1 || !post.history['1'])
				throw new Error('History must have only version 1');
			if (post.history['1'].ms) throw new Error('version 1 ms must be 0');
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(
				ctx,
				{ ...input, spaceMs: post.in_ms },
				{
					signedIn: true,
					permissionCode: !ownerCalled,
					inGlobal: !ownerCalled,
				},
			);
			throwIf(!c.signedIn);
			if (!ownerCalled) {
				throwIf(!c.inGlobal);
				throwIf(
					c.permissionCode?.num !== permissionCodes.postOnly &&
						c.permissionCode?.num !== permissionCodes.reactAndPost,
				);
			}
			return _addPost(tdb, post, false, false, input.citedPostIdObjsToFetch);
		}),
	editPost: makeProcedure(postLimiter)
		.input(PostSchema.strict())
		.mutation(async ({ ctx, input }) => {
			let callerMs = input.by_ms;
			let spaceMs = input.in_ms;
			throwIf(!callerMs || !spaceMs);
			let ownerCalled = inputIsOwner({ callerMs });
			let c = await _getCallerContext(
				ctx,
				{ callerMs, spaceMs },
				{
					signedIn: true,
					permissionCode: true,
					inGlobal: !ownerCalled,
				},
			);
			throwIf(!c.signedIn);
			if (!ownerCalled) {
				throwIf(!c.inGlobal);
				throwIf(
					c.permissionCode?.num !== permissionCodes.postOnly &&
						c.permissionCode?.num !== permissionCodes.reactAndPost,
				);
			}
			return _editPost(tdb, input, false);
		}),
	deletePost: makeProcedure(postLimiter)
		.input(
			WhoObjSchema.extend({
				postIdObj: IdObjSchema,
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let { postIdObj, callerMs } = input;
			let ownerCalled = inputIsOwner(input);
			throwIf(!callerMs || (postIdObj.by_ms !== callerMs && !ownerCalled));
			let c = await _getCallerContext(
				ctx,
				{ ...input, spaceMs: input.postIdObj.in_ms },
				{ signedIn: true, roleCode: !ownerCalled },
			);
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.roleCode);
			return _deletePost(tdb, postIdObj);
		}),
	addReaction: makeProcedure(reactionLimiter)
		.input(
			WhoObjSchema.extend({
				postIdObj: IdObjSchema,
				emoji: EmojiStringSchema,
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(!input.callerMs || !input.postIdObj.in_ms || !input.postIdObj.by_ms);
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(
				ctx,
				{ ...input, spaceMs: input.postIdObj.in_ms },
				{
					signedIn: true,
					permissionCode: !ownerCalled,
					inGlobal: !ownerCalled,
				},
			);
			throwIf(!c.signedIn);
			if (!ownerCalled) {
				throwIf(!c.inGlobal);
				throwIf(
					c.permissionCode?.num !== permissionCodes.reactOnly &&
						c.permissionCode?.num !== permissionCodes.reactAndPost,
				);
			}
			return _addReaction(tdb, input, false);
		}),
	removeReaction: makeProcedure(reactionLimiter)
		.input(
			WhoObjSchema.extend({
				postIdObj: IdObjSchema,
				emoji: EmojiStringSchema,
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(!input.callerMs || !input.postIdObj.in_ms || !input.postIdObj.by_ms);
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(
				ctx,
				{ ...input, spaceMs: input.postIdObj.in_ms },
				{
					signedIn: true,
					permissionCode: !ownerCalled,
				},
			);
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.permissionCode);
			return _removeReaction(tdb, input, false);
		}),
	getSpaceDots: makeProcedure(postLimiter)
		.input(
			WhoWhereObjSchema.extend({
				memberCount: z.number().optional(),
				description: GranularTxtPropSchema.optional(),
				newMemberPermissionCode: GranularNumPropSchema.optional(),
				getCallerMembership: z.boolean().optional(),
				msLte: z.number().optional(),
				excludeMemberMss: z.array(z.number()).optional(),
				lastMemberListRoleCodeNum: z.number().optional(),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				isPublic: !ownerCalled,
				roleCode: !ownerCalled,
				inGlobal: !ownerCalled,
			});
			throwIf((input.callerMs || ownerCalled) && !c.signedIn);
			!ownerCalled && throwIf(!c.isPublic?.num && !c.roleCode);
			return _getSpaceDots(
				tdb,
				{ ...input, callerRoleCodeNum: c.roleCode?.num },
				ownerCalled,
				c.inGlobal,
			);
		}),
	createInviteLink: makeProcedure()
		.input(
			WhoWhereObjSchema.extend({
				validFor: z.number().min(0).max(week),
				maxUses: z.number().min(0).max(99999999),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: !ownerCalled,
				inGlobal: !ownerCalled,
			});
			throwIf(!c.signedIn);
			if (!ownerCalled) {
				throwIf(!c.inGlobal);
				throwIf(c.roleCode?.num !== roleCodes.mod && c.roleCode?.num !== roleCodes.admin);
			}
			return _createInviteLink(input);
		}),
	revokeInviteLink: makeProcedure()
		.input(
			WhoWhereObjSchema.extend({
				inviteMs: z.number(),
				slugEnd: z.string(),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				roleCode: !ownerCalled,
			});
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.roleCode);
			return _revokeInviteLink(input);
		}),
	getPostHistory: makeProcedure()
		.input(
			WhoObjSchema.extend({
				postIdObj: IdObjSchema,
				version: z.number().gt(0),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(!input.callerMs || !input.postIdObj.in_ms);
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(
				ctx,
				{ ...input, spaceMs: input.postIdObj.in_ms },
				{
					permissionCode: !ownerCalled,
					signedIn: true,
					isPublic: !ownerCalled,
				},
			);
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.isPublic && c.permissionCode === undefined);
			return _getPostHistory(tdb, input.postIdObj, input.version);
		}),
	getReactionHistory: makeProcedure()
		.input(
			WhoObjSchema.extend({
				postIdObj: IdObjSchema,
				msLte: z.number(),
				rxnMsByMssExclude: z.array(IdObjSchema.omit({ in_ms: true })),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.callerMs) throw new Error('anon disallowed');
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(
				ctx,
				{ ...input, spaceMs: input.postIdObj.in_ms },
				{
					permissionCode: !ownerCalled,
					signedIn: true,
					isPublic: !ownerCalled,
				},
			);
			throwIf(!c.signedIn);
			!ownerCalled && throwIf(!c.isPublic && c.permissionCode === undefined);
			return _getReactionHistory(tdb, input);
		}),
	getPostFeed: makeProcedure(feedLimiter)
		.input(
			WhoObjSchema.extend({
				sections: z.array(PostFeedSectionSchema).max(3),
				setLastViewMsInMs: z.number().optional(),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(input.callerMs && !c.signedIn);
			return _getPostFeed(tdb, input, ownerCalled, false);
		}),
	getOwnerViewAccounts: makeProcedure(feedLimiter)
		.input(WhoObjSchema.merge(z.object({ msLt: z.number().optional() })).strict())
		.mutation(async ({ ctx, input }) => {
			assertInputIsOwner(input);
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _getOwnerViewAccounts(input);
		}),
	setOwnerViewAttributes: makeProcedure()
		.input(
			WhoObjSchema.merge(
				z.object({
					signedInEmailRules: z
						.array(z.string().max(254))
						.max(88888)
						.refine(
							(arr) => {
								return (
									[...new Set(arr)].length === arr.length &&
									arr.every(
										(p) =>
											p.length === p.trim().length && //
											(atDomainRegex.test(p) || emailRegex.test(p)),
									)
								);
							},
							{ message: 'Every pattern must be a unique trimmed email or @domain' },
						),
				}),
			).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			assertInputIsOwner(input);
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _setOwnerViewAttributes(input);
		}),
	setAccountBan: makeProcedure()
		.input(
			WhoObjSchema.merge(
				z.object({
					accountMs: z.number(),
					banned: z.boolean(),
				}),
			).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			throwIf(input.accountMs === input.callerMs);
			assertInputIsOwner(input);
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _setAccountBan(input);
		}),
	getOwnerViewSpaces: makeProcedure(feedLimiter)
		.input(WhoObjSchema.merge(z.object({ msLt: z.number().optional() })).strict())
		.mutation(async ({ ctx, input }) => {
			assertInputIsOwner(input);
			let c = await _getCallerContext(ctx, input, { signedIn: true });
			throwIf(!c.signedIn);
			return _getOwnerViewSpaces(input);
		}),
	getSpaceTags: makeProcedure(feedLimiter)
		.input(
			WhoWhereObjSchema.extend({
				fromCount: z.number(),
				lastTag: z.string().optional(),
			}).strict(),
		)
		.mutation(async ({ ctx, input }) => {
			let ownerCalled = inputIsOwner(input);
			let c = await _getCallerContext(ctx, input, {
				signedIn: true,
				isPublic: !ownerCalled,
				roleCode: !ownerCalled,
			});
			throwIf(input.callerMs && !c.signedIn);
			!ownerCalled && throwIf(!c.isPublic?.num && !c.roleCode);
			return _getSpaceTags(tdb, input);
		}),
});

export type Router = typeof router;
