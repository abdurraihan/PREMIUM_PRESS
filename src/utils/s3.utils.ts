import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_IMAGE_BUCKET } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

// install uuid: npm install uuid && npm install -D @types/uuid

// S3 client setup
const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Upload buffer to S3 and return the public URL
const uploadImageToS3 = async (
  fileBuffer: Buffer,
  mimeType: string,
  folder: string = 'reader-profiles'
): Promise<string> => {
  const key = `${folder}/${uuidv4()}.jpg`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_IMAGE_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  // Return the public S3 URL
  return `https://${S3_IMAGE_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
};

// Delete image from S3 using its URL
const deleteImageFromS3 = async (imageUrl: string): Promise<void> => {
  // Extract the key from URL
  // URL format: https://bucket.s3.region.amazonaws.com/folder/filename.jpg
  const key = imageUrl.split('.amazonaws.com/')[1];
  if (!key) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_IMAGE_BUCKET,
      Key: key,
    })
  );
};

export { uploadImageToS3, deleteImageFromS3 };