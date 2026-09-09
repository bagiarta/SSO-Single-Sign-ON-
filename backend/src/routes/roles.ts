import { Router } from 'express';
import {
  getRoles,
  createRole,
  deleteRole,
  assignUserRoles,
} from '../controllers/roleController';

export const roleRouter = Router();

roleRouter.get('/', getRoles);
roleRouter.post('/', createRole);
roleRouter.delete('/:id', deleteRole);
roleRouter.post('/user/:userId', assignUserRoles);
