import { Request, Response, NextFunction } from 'express';

export const setCacheControl = (durationSeconds: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', `public, max-age=${durationSeconds}`);
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
};
