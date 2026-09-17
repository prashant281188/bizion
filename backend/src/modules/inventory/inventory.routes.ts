import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import * as inventoryController from './inventory.controller.js';

const router = Router();

// Protect all routes
router.use(authenticate);

router.get('/warehouses', inventoryController.listWarehouses);
router.post('/warehouses', requireMinRole('manager'), inventoryController.createWarehouse);

router.get('/stock', inventoryController.listStock);
router.post('/stock/adjust', requireMinRole('agent'), inventoryController.adjustStock);

router.get('/transactions', inventoryController.listTransactions);

export default router;
