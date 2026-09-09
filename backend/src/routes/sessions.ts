import { Router } from 'express';
import { getSessions, revokeSession, revokeAllUserSessions, clientLogout } from '../controllers/sessionController';
import { authenticateToken } from '../middleware/authMiddleware';

export const sessionRouter = Router();

// Public route: called by client app backend when user logs out
// No auth required - client app verifies on its own side
sessionRouter.post('/logout', clientLogout);

// All remaining session routes require authentication
sessionRouter.use(authenticateToken);

// List all active sessions (admin)
sessionRouter.get('/', getSessions);

// Revoke a specific session
sessionRouter.delete('/:id', revokeSession);

// Revoke all sessions of a user
sessionRouter.delete('/user/:userId', revokeAllUserSessions);
