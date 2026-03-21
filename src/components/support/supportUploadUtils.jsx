import { base44 } from '@/components/api/ApiQueueManager';

export async function uploadSupportImages(files) {
  const safeFiles = Array.from(files || []).slice(0, 3);
  if (safeFiles.length === 0) return [];

  const uploaded = await Promise.all(
    safeFiles.map(async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return {
        url: file_url,
        name: file.name,
      };
    })
  );

  return uploaded;
}