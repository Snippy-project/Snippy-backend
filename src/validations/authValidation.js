import { z } from 'zod';

const registerSchema = z.object({
  username: z.string()
    .min(2, '姓名不可少於 2 個字元')
    .max(50, '姓名最多為 50 個字元')
    .refine(val => val.trim().length > 0, '姓名不能只包含空白字元'),
  email: z.string()
    .email('Email 格式不正確'),
  password: z.string()
    .min(8, '密碼至少需要 8 個字元')
    .max(128, '密碼不可超過 128 個字元')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, '密碼必須包含至少 1 個大寫字母、小寫字母和數字'),
  phone: z.string()
    .regex(/^09\d{8}$|^09\d{2}-\d{3}-\d{3}$/, '請輸入正確的手機號碼格式')
    .optional(),
});

const loginSchema = z.object({
  email: z.string()
    .min(1, 'Email 不能為空')
    .email('Email 格式不正確')
    .max(100, 'Email 長度不可超過 100 個字元'),
  password: z.string()
    .min(1, '密碼不能為空')
    .max(128, '密碼長度不可超過 128 個字元')
});

const forgotPasswordSchema = z.object({
  email: z.string()
    .min(1, 'Email 不能為空')
    .email('Email 格式不正確')
    .max(100, 'Email 長度不可超過 100 個字元')
});

const resetPasswordSchema = z.object({
  password: z.string()
    .min(6, '密碼至少需要 6 個字元')
    .max(128, '密碼不可超過 128 個字元')
});

export { 
  registerSchema,
  loginSchema, 
  forgotPasswordSchema,
  resetPasswordSchema
};