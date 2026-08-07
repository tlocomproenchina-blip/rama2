import { useState } from 'react';
import ImageViewerModal from '@/components/common/ImageViewerModal';

export default function useImageViewer() {
  const [imageUrl, setImageUrl] = useState(null);
  const open = (url) => { if (url) setImageUrl(url); };
  const close = () => setImageUrl(null);
  const modal = <ImageViewerModal open={!!imageUrl} imageUrl={imageUrl} onClose={close} />;
  return { open, close, modal };
}