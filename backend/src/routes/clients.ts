import { Router } from 'express';
import { 
  getClients, 
  getClientById, 
  createClient, 
  updateClient, 
  deleteClient,
  regenerateClientSecret 
} from '../controllers/clientController';

const router = Router();

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);
router.post('/:id/regenerate-secret', regenerateClientSecret);

export const clientRouter = router;
