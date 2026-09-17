import { Router } from 'express';
import { orgController } from './org.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireMinRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { updateOrgSchema } from './org.schema.js';

const router = Router();

// Retrieve organization profile for the current user
router.get('/me', authenticate, orgController.getOrg);

// Update organization profile (requires admin role or higher)
router.put('/me', authenticate, requireMinRole('admin'), validate({ body: updateOrgSchema }), orgController.updateOrg);

export default router;
