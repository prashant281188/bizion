import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import * as controller from './goods-receipts.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', controller.listGoodsReceipts);
router.post('/', requireMinRole('agent'), controller.createGoodsReceipt);
router.get('/:id', controller.getGoodsReceipt);

export default router;
