import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import * as dispatchesController from './dispatches.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', dispatchesController.listDispatches);
router.post('/', dispatchesController.createDispatch);
router.get('/:id', dispatchesController.getDispatch);
router.patch('/:id/status', dispatchesController.updateStatus);

export default router;
