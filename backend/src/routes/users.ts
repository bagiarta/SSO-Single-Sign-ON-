import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  resetMfa,
  unlockAccount,
  forcePasswordChange,
  revokeAllSessions,
  getAllowedApplications,
  updateAllowedApplications
} from '../controllers/userController';

export const userRouter = Router();

userRouter.get('/', getUsers);
userRouter.get('/:id', getUserById);
userRouter.post('/', createUser);
userRouter.put('/:id', updateUser);
userRouter.delete('/:id', deleteUser);
userRouter.post('/:id/status', toggleUserStatus);
userRouter.post('/:id/reset-mfa', resetMfa);
userRouter.post('/:id/unlock', unlockAccount);
userRouter.post('/:id/force-password-change', forcePasswordChange);
userRouter.post('/:id/revoke-sessions', revokeAllSessions);
userRouter.get('/:id/allowed-applications', getAllowedApplications);
userRouter.post('/:id/allowed-applications', updateAllowedApplications);
