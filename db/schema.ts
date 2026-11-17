import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const documents = sqliteTable('documents', {key: text('key').primaryKey(), value: text('value').notNull(), updatedAt: text('updated_at').notNull()});
export const editors = sqliteTable('editors', {email: text('email').primaryKey(), addedAt: text('added_at').notNull()});
