import { Router } from 'express';
import {
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
  toggleProviderStatus,
  testConnection,
  getRecommendations,
} from '../controllers/providerController';

export const providerRouter = Router();

providerRouter.get('/recommendations', getRecommendations);
providerRouter.get('/', getProviders);
providerRouter.get('/:id', getProviderById);
providerRouter.post('/', createProvider);
providerRouter.put('/:id', updateProvider);
providerRouter.delete('/:id', deleteProvider);
providerRouter.post('/test', testConnection);
providerRouter.post('/:id/toggle', toggleProviderStatus);
