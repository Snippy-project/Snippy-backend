import { pgEnum } from 'drizzle-orm/pg-core';

const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "failed", "cancelled"]);

export { orderStatusEnum };