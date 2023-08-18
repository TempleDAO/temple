import { useEffect } from 'react';

function usePreloadImages(images: string[]) {
  useEffect(() => {
    const preloadImage = (src: string) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(src);
      });
    };

    const loadImages = async () => {
      await Promise.all(images.map((image) => preloadImage(image)));
    };

    loadImages();
  }, [images]);
}

export default usePreloadImages;
