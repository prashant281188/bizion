import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { s3Client, S3_BUCKET, getS3PublicUrl, extractS3Key } from '../config/s3.js';

/**
 * Uploads a file buffer to S3 and returns the public URL.
 */
export async function uploadImageToS3(buffer: Buffer, mimetype: string, originalName: string, folder: string = 'products'): Promise<string> {
  if (!S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is missing.');
  }

  const extension = path.extname(originalName) || '';
  const fileKey = `${folder}/${uuidv4()}${extension}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: fileKey,
    Body: buffer,
    ContentType: mimetype,
  });

  await s3Client.send(command);

  return getS3PublicUrl(fileKey);
}

/**
 * Deletes an object from S3 given its public URL or key.
 */
export async function deleteImageFromS3(fileUrlOrKey: string): Promise<void> {
  if (!S3_BUCKET) {
    throw new Error('AWS_S3_BUCKET environment variable is missing.');
  }

  const fileKey = extractS3Key(fileUrlOrKey);
  if (!fileKey) return;

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: decodeURIComponent(fileKey),
  });

  await s3Client.send(command);
}
