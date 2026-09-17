import { Router } from 'express';
import { portalController } from './portal.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/rbac.middleware.js';

const router = Router();

// Ensure all portal routes require 'customer' role
router.use(authenticate, authorize(['customer']));

router.get('/orders', portalController.getOrders);
router.get('/invoices', portalController.getInvoices);
router.get('/payments', portalController.getPayments);
router.get('/products', portalController.getProducts);
router.get('/ledger', portalController.getLedger);
router.get('/profile', portalController.getProfile);

export default router;
