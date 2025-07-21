import { pgEnum } from 'drizzle-orm/pg-core';

const productTypeEnum = pgEnum("product_type", ['quota', 'custom_domain', 'custom_domain_yearly']);

export { productTypeEnum };