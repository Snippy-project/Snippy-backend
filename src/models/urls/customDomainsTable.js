import { pgTable, serial, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { usersTable } from '../users/usersTable.js';

const customDomainsTable = pgTable("custom_domains", {
  id: serial().primaryKey(),
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  domain: varchar('domain', { length: 255 }).unique().notNull(),
  isActive: boolean('is_active').default(true),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { customDomainsTable };