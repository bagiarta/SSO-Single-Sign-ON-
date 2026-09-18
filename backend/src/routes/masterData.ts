import { Router } from 'express';
import { 
  getRegions, 
  getBranches, 
  getLocations, 
  getDepartments, 
  getPositions, 
  getGrades, 
  getEmployeeTypes, 
  getCostCenters,
  createMasterRecord,
  updateMasterRecord,
  deleteMasterRecord
} from '../controllers/masterDataController';

const router = Router();

// Routes for master data
router.get('/regions', getRegions);
router.get('/branches', getBranches);
router.get('/locations', getLocations);
router.get('/departments', getDepartments);
router.get('/positions', getPositions);
router.get('/grades', getGrades);
router.get('/employee-types', getEmployeeTypes);
router.get('/cost-centers', getCostCenters);

// Generic CRUD routes for master data
router.post('/:type', createMasterRecord);
router.put('/:type/:id', updateMasterRecord);
router.delete('/:type/:id', deleteMasterRecord);

export default router;
