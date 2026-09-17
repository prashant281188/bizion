import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET, isMockS3, getS3PublicUrl, extractS3Key } from '../../config/s3.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { sendSuccess } from '../../utils/api-response.js';
import { ApiError } from '../../utils/api-error.js';

const router = Router();

// Multer memory storage configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept images only
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed (jpeg, jpg, png, gif, webp, svg)'));
    }
  },
});

/**
 * POST /api/v1/media/upload
 * Expects a file field named "file" (multer single upload)
 */
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: any, res: any, next: any) => {
    try {
      const orgId = req.user?.orgId;
      if (!orgId) {
        throw ApiError.unauthorized('Not authenticated');
      }

      if (!req.file) {
        throw ApiError.badRequest('No file uploaded');
      }

      const file = req.file;
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${Date.now()}_${uuidv4().substring(0, 8)}_${sanitizedName}`;
      const relativeKey = `organizations/${orgId}/products/${filename}`;

      if (isMockS3()) {
        // Fallback: Save file locally under public/uploads
        const publicUploadsDir = path.join(process.cwd(), 'public/uploads/organizations', orgId, 'products');
        
        // Ensure folders exist recursively
        await fs.promises.mkdir(publicUploadsDir, { recursive: true });
        
        const destinationPath = path.join(publicUploadsDir, filename);
        await fs.promises.writeFile(destinationPath, file.buffer);
        
        const absoluteUrl = getS3PublicUrl(relativeKey);
        
        return sendSuccess(
          res,
          {
            key: relativeKey,
            url: absoluteUrl,
          },
          'Image uploaded successfully (Local development fallback)'
        );
      } else {
        // Production: Upload to S3
        const command = new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: relativeKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        await s3Client.send(command);
        const absoluteUrl = getS3PublicUrl(relativeKey);

        return sendSuccess(
          res,
          {
            key: relativeKey,
            url: absoluteUrl,
          },
          'Image uploaded successfully to S3'
        );
      }
    } catch (error: any) {
      if (error instanceof Error) {
        return next(ApiError.badRequest(error.message));
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/media
 * Deletes an uploaded file from S3 (or local fallback)
 */
router.delete('/', authenticate, async (req: any, res: any, next: any) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== 'string') {
      throw ApiError.badRequest('Missing url parameter');
    }

    const key = extractS3Key(url);
    if (!key) {
      throw ApiError.badRequest('Invalid url parameter');
    }

    if (isMockS3()) {
      // Local fallback deletion
      const filepath = path.join(process.cwd(), 'public/uploads', key);
      if (fs.existsSync(filepath)) {
        await fs.promises.unlink(filepath);
      }
      return sendSuccess(res, null, 'Image deleted successfully (Local)');
    } else {
      // S3 Deletion
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: decodeURIComponent(key),
      });
      await s3Client.send(command);
      return sendSuccess(res, null, 'Image deleted successfully from S3');
    }
  } catch (error: any) {
    if (error instanceof Error) {
      return next(ApiError.badRequest(error.message));
    }
    next(error);
  }
});

export default router;
