// import multer from 'multer';

// // Store file in memory as buffer — we send it directly to S3
// const storage = multer.memoryStorage();

// const upload = multer({
//   storage,
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
//   fileFilter: (_req, file, cb) => {
//     // Only allow image files
//     if (file.mimetype.startsWith('image/')) {
//       cb(null, true);
//     } else {
//       cb(new Error('Only image files are allowed'));
//     }
//   },
// });

// export { upload };

import multer from 'multer';

// Store in memory — send directly to S3
const storage = multer.memoryStorage();

// Image uploader — for profile images, story covers, podcast covers
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Audio uploader — for podcast audio files
const uploadAudio = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 or WAV audio files are allowed'));
    }
  },
});

// Combined uploader — podcast needs both audio + cover image in one request
// fields: [{ name: 'audioFile' }, { name: 'coverImage' }]
const uploadPodcastFiles = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB covers both
  fileFilter: (_req, file, cb) => {
    const allowedImage = ['image/jpeg', 'image/png', 'image/jpg'];
    const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/mp3'];

    if (allowedImage.includes(file.mimetype) || allowedAudio.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image or audio files are allowed'));
    }
  },
}).fields([
  { name: 'audioFile', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
]);

export { upload, uploadAudio, uploadPodcastFiles };