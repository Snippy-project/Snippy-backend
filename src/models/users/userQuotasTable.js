import { pgTable, serial, integer, timestamp } from 'drizzle-orm/pg-core';
import { usersTable } from './usersTable.js';

const userQuotasTable = pgTable("user_quotas", {
  id: serial().primaryKey(),
	userId: integer('user_id').references(() => usersTable.id).unique().notNull(),
  totalQuota: integer('total_quota').notNull().default(20),
  usedQuota: integer('used_quota').notNull().default(0),
  remainingQuota: integer('remaining_quota').notNull().default(20),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { userQuotasTable };