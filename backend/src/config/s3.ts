import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

/**
 * AWS S3 client configured with credentials from environment variables.
 * Used for file uploads (invoices, product images, attachments).
 */
export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

export const S3_BUCKET = env.AWS_S3_BUCKET;

/**
 * Check if the S3 credentials are mocks (development fallback mode).
 */
export function isMockS3(): boolean {
  const key = env.AWS_ACCESS_KEY_ID || '';
  return key.includes('mock') || key.includes('your') || !key;
}

/**
 * Reconstruct a public absolute URL from an S3/Local key stored in the database.
 */
export function getS3PublicUrl(key: string | null | undefined): string {
  if (!key) return '';
  // If it's already an absolute URL (like a external seed image), return it as-is
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }

  if (isMockS3()) {
    return `http://localhost:${env.PORT}/uploads/${key}`;
  }

  const cloudfront = process.env.CLOUDFRONT_URL?.trim();
  if (cloudfront) {
    const base = cloudfront.replace(/\/+$/, '');
    return `${base}/${key.replace(/^\/+/, '')}`;
  }

  return `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Extract a relative path key from a public URL.
 */
export function extractS3Key(url: string | null | undefined): string {
  if (!url) return '';

  const localPrefix = `http://localhost:${env.PORT}/uploads/`;
  if (url.startsWith(localPrefix)) {
    return url.replace(localPrefix, '');
  }

  const cloudfront = process.env.CLOUDFRONT_URL?.trim();
  if (cloudfront) {
    const base = cloudfront.replace(/\/+$/, '') + '/';
    if (url.startsWith(base)) {
      return url.replace(base, '');
    }
  }

  const s3Prefix = `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/`;
  if (url.startsWith(s3Prefix)) {
    return url.replace(s3Prefix, '');
  }

  // If it is already a relative key (does not start with http/https), return it
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }

  // Otherwise, it is an external URL (e.g. Unsplash) -> return it as is
  return url;
}

