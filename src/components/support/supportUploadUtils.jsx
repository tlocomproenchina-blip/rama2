import { uploadImageNoCredits } from '@/lib/imgbbUpload';

export async function uploadSupportImages(files, maxFiles = 3) {
  const safeFiles = Array.from(files || []).slice(0, maxFiles);
  if (safeFiles.length === 0) return [];

  const uploaded = await Promise.all(
    safeFiles.map(async (file) => {
      const url = await uploadImageNoCredits(file);
      return {
        url,
        name: file.name,
      };
    })
  );

  return uploaded;
}