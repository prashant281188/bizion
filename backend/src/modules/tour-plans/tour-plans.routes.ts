import { Router } from 'express';
import { tourPlansController } from './tour-plans.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', tourPlansController.listTourPlans);
router.get('/:id', tourPlansController.getTourPlan);
router.post('/', tourPlansController.createTourPlan);
router.put('/:id', tourPlansController.updateTourPlan);
router.delete('/:id', tourPlansController.deleteTourPlan);

export default router;
