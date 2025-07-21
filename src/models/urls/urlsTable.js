import { pgTable, serial, integer, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { usersTable } from '../users/usersTable.js';
import { customDomainsTable } from './customDomainsTable.js';

const urlsTable = pgTable("urls", {
  id: serial().primaryKey(),
	userId: integer('user_id').references(() => usersTable.id).notNull(),
  shortId: varchar('short_id', { length: 10 }).unique().notNull(),
	customDomainId: integer('custom_domain_id').references(() => customDomainsTable.id),
  originalUrl: text('original_url').notNull(),
  title: varchar('title', { length: 255 }),
  clickCount: integer('click_count').default(0),
  isActive: boolean('is_active').default(true),

  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at")
});

export { urlsTable };