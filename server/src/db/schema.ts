// import path from 'path';
// import { migrate } from 'drizzle-orm/libsql/migrator';
// import { drizzleClient } from '.';
import { integer, text, sqliteTable, primaryKey, index } from 'drizzle-orm/sqlite-core';

// SQLite column types
// https://orm.drizzle.team/docs/column-types/sqlite

export const authorsTable = sqliteTable('authors', {
	id: text('id').primaryKey(),
	name: text('name'),
	frozen: integer('frozen', { mode: 'boolean' }),
	walletAddress: text('wallet_address').unique(),
	writeDate: integer('write_date'),
	// above are what signature should sign
	signature: text('signature'),
	addDate: integer('add_date').notNull(),
	addedById: text('added_by_id'),
});
export type InsertPersona = typeof authorsTable.$inferInsert;
export type SelectPersona = typeof authorsTable.$inferSelect;

export const thoughtsTable = sqliteTable(
	'thoughts',
	{
		createDate: integer('create_date').notNull(),
		authorId: text('author_id'),
		spaceHost: text('space_host'),
		content: text('content'),
		tags: text('tags', { mode: 'json' }).$type<string[]>(),
		parentId: text('parent_id'),
		signature: text('signature'),

		// https://orm.drizzle.team/docs/column-types/sqlite#blob
		// tags: blob('tags', { mode: 'json' }).$type<string[]>().notNull(),
	},
	(table) => {
		return {
			// https://orm.drizzle.team/docs/indexes-constraints#composite-primary-key
			pkWithCustomName: primaryKey({
				name: 'id',
				columns: [table.createDate, table.authorId, table.spaceHost],
			}),
			createDateIdx: index('create_date_idx').on(table.createDate),
			authorIdIdx: index('author_id_idx').on(table.authorId),
			spaceHostIdx: index('space_host_idx').on(table.spaceHost),
			contentIdx: index('content_idx').on(table.content),
			tagsIdx: index('tags_idx').on(table.tags),
			parentIdIdx: index('parent_id_idx').on(table.parentId),
		};
	},
);
export type InsertThought = typeof thoughtsTable.$inferInsert;
export type SelectThought = typeof thoughtsTable.$inferSelect;

export const votesTable = sqliteTable(
	'votes',
	{
		thoughtCreateDate: integer('thought_create_date').notNull(),
		thoughtAuthorId: text('thought_author_id'),
		thoughtSpaceHost: text('thought_space_host'),
		up: integer('up', { mode: 'boolean' }),
		voterId: text('voter_id').notNull(),
		voteDate: integer('vote_date').notNull(),
		txHash: text('tx_hash').unique(),
		signature: text('signature'),
	},
	(table) => {
		return {
			pkWithCustomName: primaryKey({
				name: 'id',
				columns: [
					table.thoughtCreateDate,
					table.thoughtAuthorId,
					table.thoughtSpaceHost,
					table.voterId,
				],
			}),
			upIdx: index('up_idx').on(table.up),
			thoughtCreateDateIdx: index('thought_create_date_idx').on(table.thoughtCreateDate),
			thoughtAuthorIdIdx: index('thought_author_id_idx').on(table.thoughtAuthorId),
			thoughtSpaceHostIdx: index('thought_space_host_idx').on(table.thoughtSpaceHost),
			voterIdIdx: index('voter_id_idx').on(table.voterId),
			voteDateIdx: index('vote_date_idx').on(table.voteDate),
			txHashIdx: index('tx_hash_idx').on(table.txHash),
		};
	},
);
export type InsertVote = typeof votesTable.$inferInsert;
export type SelectVote = typeof votesTable.$inferSelect;

// (async () => {
// 	// https://orm.drizzle.team/learn/tutorials/drizzle-with-turso#applying-changes-to-the-database
// 	await migrate(drizzleClient, { migrationsFolder: path.resolve(__dirname, './migrations') });
// })();

// run this to generate new migrations
// cd server && npx drizzle-kit generate:sqlite && cd ..
// or just run this to apply current schema
// cd server && npx drizzle-kit push:sqlite && cd ..
