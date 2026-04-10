// import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_IMAGE_BUCKET } from '../config/env';
// import { v4 as uuidv4 } from 'uuid';

// // install uuid: npm install uuid && npm install -D @types/uuid

// // S3 client setup
// const s3 = new S3Client({
//   region: AWS_REGION,
//   credentials: {
//     accessKeyId: AWS_ACCESS_KEY_ID,
//     secretAccessKey: AWS_SECRET_ACCESS_KEY,
//   },
// });

// // Upload buffer to S3 and return the public URL
// const uploadImageToS3 = async (
//   fileBuffer: Buffer,
//   mimeType: string,
//   folder: string = 'reader-profiles'
// ): Promise<string> => {
//   const key = `${folder}/${uuidv4()}.jpg`;

//   await s3.send(
//     new PutObjectCommand({
//       Bucket: S3_IMAGE_BUCKET,
//       Key: key,
//       Body: fileBuffer,
//       ContentType: mimeType,
//     })
//   );

//   // Return the public S3 URL
//   return `https://${S3_IMAGE_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
// };

// // Delete image from S3 using its URL
// const deleteImageFromS3 = async (imageUrl: string): Promise<void> => {
//   // Extract the key from URL
//   // URL format: https://bucket.s3.region.amazonaws.com/folder/filename.jpg
//   const key = imageUrl.split('.amazonaws.com/')[1];
//   if (!key) return;

//   await s3.send(
//     new DeleteObjectCommand({
//       Bucket: S3_IMAGE_BUCKET,
//       Key: key,
//     })
//   );
// };

// export { uploadImageToS3, deleteImageFromS3 };

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_IMAGE_BUCKET } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

// Upload image to S3 — returns public URL
const uploadImageToS3 = async (
  fileBuffer: Buffer,
  mimeType: string,
  folder: string = 'images'
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

  return `https://${S3_IMAGE_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
};

// Upload audio to S3 — returns public URL
const uploadAudioToS3 = async (
  fileBuffer: Buffer,
  mimeType: string,
  folder: string = 'podcast-audio'
): Promise<string> => {
  // Keep original extension — mp3 or wav
  const ext = mimeType === 'audio/wav' ? 'wav' : 'mp3';
  const key = `${folder}/${uuidv4()}.${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_IMAGE_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );

  return `https://${S3_IMAGE_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
};

// Delete any file from S3 by URL — works for both image and audio
const deleteImageFromS3 = async (fileUrl: string): Promise<void> => {
  const key = fileUrl.split('.amazonaws.com/')[1];
  if (!key) return;

  await s3.send(
    new DeleteObjectCommand({
      Bucket: S3_IMAGE_BUCKET,
      Key: key,
    })
  );
};

// Alias — same function, better name for audio deletion
const deleteFileFromS3 = deleteImageFromS3;

export { uploadImageToS3, uploadAudioToS3, deleteImageFromS3, deleteFileFromS3 };