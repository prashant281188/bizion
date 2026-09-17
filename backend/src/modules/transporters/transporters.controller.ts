import { Request, Response, NextFunction } from 'express';
import { transportersService } from './transporters.service.js';

export class TransportersController {
  async listTransporters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const data = await transportersService.listTransporters(orgId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async getTransporter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      const data = await transportersService.getTransporter(orgId, id);
      if (!data) {
        res.status(404).json({ success: false, message: 'Transporter not found' });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async createTransporter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const data = await transportersService.createTransporter(orgId, req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async updateTransporter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      const data = await transportersService.updateTransporter(orgId, id, req.body);
      if (!data) {
        res.status(404).json({ success: false, message: 'Transporter not found' });
        return;
      }
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  async deleteTransporter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const id = req.params.id as string;
      const data = await transportersService.deleteTransporter(orgId, id);
      if (!data) {
        res.status(404).json({ success: false, message: 'Transporter not found' });
        return;
      }
      res.json({ success: true, message: 'Transporter deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

export const transportersController = new TransportersController();
