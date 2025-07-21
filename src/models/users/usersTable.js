import { pgTable, serial, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { providerTypeEnum } from '../enums/providerTypeEnum.js';
import { roleEnum } from '../enums/roleEnum.js';
import { statusEnum } from '../enums/statusEnum.js';


const usersTable = pgTable("users", {
  id: serial().primaryKey(),
  username: varchar({ length: 100 }).notNull(),
  email: varchar({ length: 100 }).unique(),
  password: varchar({ length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),

  role: roleEnum("role").default('user'),
  providerType: providerTypeEnum("provider_type").notNull(),
  status: statusEnum("status").notNull(),

	isVerifiedEmail: boolean('is_verified_email').default(false),
	emailVerificationToken: varchar('email_verification_token', { length: 255 }),
	emailVerificationExpires: timestamp('email_verification_expires'),
	lastVerificationEmailSent: timestamp('last_verification_email_sent'),

	passwordResetToken: varchar('password_reset_token', { length: 255 }),
	passwordResetExpires: timestamp('password_reset_expires'),
	lastPasswordResetSent: timestamp('last_password_reset_sent'),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export { usersTable };