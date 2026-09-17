import { Router } from 'express';
import { searchController } from './search.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.get('/', searchController.globalSearch);

export default router;
