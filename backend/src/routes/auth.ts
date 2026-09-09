import { Router } from 'express';
import { login, logout, authorize, token, userinfo, forgotPassword, resetPassword } from '../controllers/authController';

export const authRouter = Router();

// Core OIDC / OAuth2 Endpoints
authRouter.post('/login', login);
authRouter.post('/logout', logout);
authRouter.get('/authorize', authorize);
authRouter.post('/token', token);
authRouter.get('/userinfo', userinfo);

// Password Management
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password', resetPassword);
