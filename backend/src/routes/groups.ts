import { Router } from 'express';
import { getAllGroups, getGroupById, createGroup, updateGroup, deleteGroup } from '../controllers/groupController';
import { authenticateToken } from '../middleware/authMiddleware';

const groupRouter = Router();

groupRouter.use(authenticateToken);

groupRouter.get('/', getAllGroups);
groupRouter.get('/:id', getGroupById);
groupRouter.post('/', createGroup);
groupRouter.put('/:id', updateGroup);
groupRouter.delete('/:id', deleteGroup);

export { groupRouter };
