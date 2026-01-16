// src/services/imageService.js
// Image upload service with compression for chat images

import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

// Max dimensions and file size for uploads
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const QUALITY = 0.8;

/**
 * Compress and resize an image file
 * Returns a Blob of the compressed image
 */
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to compress image"));
          }
        },
        "image/jpeg",
        QUALITY
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));

    // Load image from file
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload an image to Firebase Storage for a chat room
 * @param {File} file - The image file to upload
 * @param {string} roomId - The room ID
 * @param {string} oddie - User's oddie (emoji) for filename
 * @param {function} onProgress - Progress callback (0-100)
 * @returns {Promise<string>} - The download URL of the uploaded image
 */
export async function uploadChatImage(file, roomId, oddie, onProgress) {
  // Validate file type
  const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid file type. Please upload an image (jpg, png, gif, webp).");
  }

  // Compress the image
  let imageBlob;
  try {
    imageBlob = await compressImage(file);
  } catch (err) {
    console.error("Compression failed, using original:", err);
    imageBlob = file;
  }

  // Check file size after compression
  if (imageBlob.size > MAX_FILE_SIZE * 2) {
    throw new Error("Image is too large. Please use a smaller image.");
  }

  // Create storage path
  const timestamp = Date.now();
  const safeName = oddie || "user";
  const storagePath = `roomImages/${roomId}/${safeName}_${timestamp}.jpg`;
  const storageRef = ref(storage, storagePath);

  // Upload with progress tracking
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, imageBlob, {
      contentType: "image/jpeg",
    });

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        reject(new Error("Failed to upload image. Please try again."));
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (err) {
          reject(new Error("Failed to get image URL."));
        }
      }
    );
  });
}

export default {
  uploadChatImage,
  compressImage,
};
