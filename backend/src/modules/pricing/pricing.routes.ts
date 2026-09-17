import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import * as pricingController from './pricing.controller.js';

const router = Router();

router.use(authenticate);

router.get('/lists', pricingController.getPriceLists);
router.post('/lists', pricingController.createPriceList);
router.get('/lists/:id', pricingController.getPriceList);
router.put('/lists/:id', pricingController.updatePriceList);
router.delete('/lists/:id', pricingController.deletePriceList);
router.get('/lists/:id/items', pricingController.getPriceListItems);
router.patch('/lists/:id/items', pricingController.updatePriceListItems);

router.get('/schemes', pricingController.getSchemes);
router.post('/schemes', pricingController.createScheme);
router.get('/schemes/:id', pricingController.getScheme);
router.put('/schemes/:id', pricingController.updateScheme);
router.delete('/schemes/:id', pricingController.deleteScheme);

router.post('/resolve-price', pricingController.resolvePrice);

export default router;
