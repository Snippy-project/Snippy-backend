import { pgTable, serial, integer, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { productTypeEnum } from '../enums/productTypeEnum.js';

const productsTable = pgTable("products", {
	id: serial().primaryKey(),
	name: varchar({ length: 255 }).notNull(),
	description: varchar({ length: 255 }).notNull(),
	quotaAmount: integer('quota_amount').notNull().default(0),
	price: integer('price').notNull().default(10),
	productType: productTypeEnum('product_type').notNull(),
	isActive: boolean('is_active').notNull().default(true),
	
	subscriptionDurationDays: integer('subscription_duration_days'),
	
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow()
});

export { productsTable };