/**
 * Image Compression Utility for texō
 * Automatically downscales large images (max 1200px width/height) and compresses them
 * to high-quality WebP or JPEG (0.82 quality) before inserting into notes.
 * Keeps note payload sizes tiny (<100 KB instead of 5–15 MB) to ease storage and speed up Supabase sync.
 */

export async function compressImageFile(
  file: File | Blob,
  maxDim = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        resolve('');
        return;
      }
      compressImageDataUrl(dataUrl, maxDim, quality).then(resolve).catch(reject);
    };
    reader.readAsDataURL(file);
  });
}

export async function compressImageDataUrl(
  dataUrl: string,
  maxDim = 1200,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first for optimal compression ratio
        let compressed = canvas.toDataURL('image/webp', quality);
        if (!compressed.startsWith('data:image/webp')) {
          // Fallback to JPEG if browser doesn't support WebP export
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        // Use compressed if it saves bytes or resized; otherwise use original
        if (compressed.length < dataUrl.length || width !== img.width || height !== img.height) {
          resolve(compressed);
        } else {
          resolve(dataUrl);
        }
      } catch (err) {
        console.warn('Image compression fallback:', err);
        resolve(dataUrl);
      }
    };
    img.src = dataUrl;
  });
}
