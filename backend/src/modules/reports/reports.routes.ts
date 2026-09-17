import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.get('/dashboard-stats', authenticate, reportsController.getDashboardStats);
router.get('/gst/gstr1', authenticate, reportsController.getGstr1Report);
router.get('/gst/gstr3b', authenticate, reportsController.getGstr3bReport);
router.get('/gst/hsn-summary', authenticate, reportsController.getHsnSummaryReport);
router.get('/financial/profit-loss', authenticate, reportsController.getProfitLossReport);
router.get('/financial/balance-sheet', authenticate, reportsController.getBalanceSheetReport);
router.get('/business/sales-summary', authenticate, reportsController.getSalesSummaryReport);
router.get('/business/receivables', authenticate, reportsController.getReceivablesReport);
router.get('/business/payables', authenticate, reportsController.getPayablesReport);

export default router;
