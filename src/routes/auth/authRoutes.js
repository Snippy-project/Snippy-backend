import express from 'express';
import { 
  register, 
  login, 
  logout, 
  verifyEmail, 
  resendVerification, 
  forgotPassword, 
  resetPassword, 
  me 
} from '../../controllers/authController.js';
import { requireAuth } from '../../middlewares/authMiddleware.js';
import { createValidationMiddleware } from '../../middlewares/validationMiddleware.js';
import { 
  registerSchema, 
  loginSchema, 
  forgotPasswordSchema,
  resetPasswordSchema
} from '../../validations/authValidation.js';

const router = express.Router();

router.post('/register', createValidationMiddleware(registerSchema), register);
router.post('/login', createValidationMiddleware(loginSchema), login);
router.post('/forgot-password', createValidationMiddleware(forgotPasswordSchema), forgotPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/reset-password/:token', createValidationMiddleware(resetPasswordSchema), resetPassword);
router.post('/resend-verification', resendVerification);

router.use(requireAuth);
router.post('/logout', logout);
router.get('/me', me);

export default router;