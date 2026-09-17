import { Router } from 'express';
import { transportersController } from './transporters.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', transportersController.listTransporters);
router.get('/:id', transportersController.getTransporter);
router.post('/', transportersController.createTransporter);
router.put('/:id', transportersController.updateTransporter);
router.delete('/:id', transportersController.deleteTransporter);

export default router;
