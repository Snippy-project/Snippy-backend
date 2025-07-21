import { pgEnum } from 'drizzle-orm/pg-core';

const subscriptionStatusEnum = pgEnum("subscription_status", ['active', 'expired', 'cancelled']);

export { subscriptionStatusEnum };