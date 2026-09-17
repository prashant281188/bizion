import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import * as ordersController from './orders.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requireMinRole('agent'), ordersController.listOrders);
router.get('/pending-report', requireMinRole('agent'), ordersController.getPendingOrdersReport);
router.post('/', requireMinRole('agent'), ordersController.createOrder);
router.get('/replenishment', requireMinRole('agent'), ordersController.getReplenishment);
router.post('/replenishment/draft', requireMinRole('agent'), ordersController.draftReplenishmentPOs);
router.post('/bulk/status', requireMinRole('agent'), ordersController.bulkStatus);
router.get('/:id', requireMinRole('agent'), ordersController.getOrder);
router.put('/:id', requireMinRole('agent'), ordersController.updateOrder);
router.patch('/:id/status', requireMinRole('agent'), ordersController.updateStatus);
router.post('/:id/fulfill', requireMinRole('agent'), ordersController.fulfillOrder);

export default router;
