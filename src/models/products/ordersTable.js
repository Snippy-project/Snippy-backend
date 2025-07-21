import { pgTable, serial, integer, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { orderStatusEnum } from '../enums/orderStatusEnum.js';
import { usersTable } from '../users/usersTable.js';
import { productsTable } from './productsTable.js';

const ordersTable = pgTable("orders", {
	id: serial().primaryKey(),
	userId: integer('user_id').references(() => usersTable.id).notNull(),
	productId: integer('product_id').references(() => productsTable.id).notNull(),
	orderNumber: varchar('order_number', { length: 50 }).unique().notNull(),
	price: integer('price').notNull().default(10),
	orderStatus: orderStatusEnum('order_status').notNull().default('pending'),
	
	ecpayTradeNo: varchar('ecpay_trade_no', { length: 20 }).unique(),
	ecpayPaymentDate: timestamp('ecpay_payment_date'),
	ecpaySimulatePaid: integer('ecpay_simulate_paid').default(0),
	ecpayCheckMacValue: text('ecpay_check_mac_value'),
	
	failureReason: text('failure_reason'),
	
	paidAt: timestamp("paid_at"),
	cancelledAt: timestamp("cancelled_at"),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow()
});

export { ordersTable };