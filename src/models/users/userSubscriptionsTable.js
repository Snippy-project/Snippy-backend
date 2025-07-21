import { pgTable, serial, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { subscriptionStatusEnum } from '../enums/subscriptionStatusEnum.js';
import { usersTable } from './usersTable.js';

const userSubscriptionsTable = pgTable("user_subscriptions", {
  id: serial().primaryKey(),
  userId: integer('user_id').references(() => usersTable.id).notNull(),
  subscriptionType: varchar('subscription_type', { length: 50 }).notNull(),
  subscriptionStatus: subscriptionStatusEnum('subscription_status').default('active'),
  
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { userSubscriptionsTable };