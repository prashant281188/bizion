import { Request, Response } from 'express';
import { tourPlansService } from './tour-plans.service.js';

export class TourPlansController {
  async listTourPlans(req: Request, res: Response) {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const { month, year } = req.query;
      const plans = await tourPlansService.listTourPlans(
        orgId,
        month ? String(month) : undefined,
        year ? String(year) : undefined
      );

      return res.json({ success: true, data: plans });
    } catch (err: any) {
      console.error('List tour plans error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
    }
  }

  async getTourPlan(req: Request, res: Response) {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const id = String(req.params.id);
      const plan = await tourPlansService.getTourPlan(id, orgId);
      if (!plan) return res.status(404).json({ success: false, message: 'Tour plan not found' });

      return res.json({ success: true, data: plan });
    } catch (err: any) {
      console.error('Get tour plan error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
    }
  }

  async createTourPlan(req: Request, res: Response) {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const newPlan = await tourPlansService.createTourPlan(orgId, req.body);
      return res.status(201).json({ success: true, data: newPlan });
    } catch (err: any) {
      console.error('Create tour plan error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
    }
  }

  async updateTourPlan(req: Request, res: Response) {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const id = String(req.params.id);
      const updated = await tourPlansService.updateTourPlan(id, orgId, req.body);
      if (!updated) return res.status(404).json({ success: false, message: 'Tour plan not found' });

      return res.json({ success: true, data: updated });
    } catch (err: any) {
      console.error('Update tour plan error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
    }
  }

  async deleteTourPlan(req: Request, res: Response) {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const id = String(req.params.id);
      const deleted = await tourPlansService.deleteTourPlan(id, orgId);
      if (!deleted) return res.status(404).json({ success: false, message: 'Tour plan not found' });

      return res.json({ success: true, message: 'Tour plan deleted successfully' });
    } catch (err: any) {
      console.error('Delete tour plan error:', err);
      return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
    }
  }
}

export const tourPlansController = new TourPlansController();
