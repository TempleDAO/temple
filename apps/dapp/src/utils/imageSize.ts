// Calculate dimensions of image used as background-size: cover
export const getBgImgDimensions = (element: Element | null, src: string) => {
  if (!element) return;
  const computedDim: { w: any; h: any } = { w: 'auto', h: 'auto' };

  // Get container dimensions
  const computedStyle = window.getComputedStyle(element);
  const dimensions: { w: any; h: any } = {
    w: parseInt(computedStyle.width.replace('px', ''), 10),
    h: parseInt(computedStyle.height.replace('px', ''), 10),
  };

  // Get image ratio
  const image = document.createElement('img');
  image.src = src;
  let ratio =
    image.width > image.height
      ? image.width / image.height
      : image.height / image.width;

  // Width is greater than height
  if (dimensions.w > dimensions.h) {
    // Is the container ratio GTE the img ratio
    if (dimensions.w / dimensions.h >= ratio) {
      computedDim.w = dimensions.w;
      computedDim.h = 'auto';
    } else {
      computedDim.w = 'auto';
      computedDim.h = dimensions.h;
    }
  } else {
    computedDim.w = 'auto';
    computedDim.h = dimensions.h;
  }

  // If both values are set to auto, return image's original width and height
  if (computedDim.w === 'auto' && computedDim.h === 'auto') {
    computedDim.w = image.width;
    computedDim.h = image.height;
  } else {
    // Depending on whether width or height is auto, calculate the value in pixels of auto.
    // ratio in here is just getting proportions.
    ratio =
      computedDim.w === 'auto'
        ? image.height / computedDim.h
        : image.width / computedDim.w;
    computedDim.w =
      computedDim.w === 'auto' ? image.width / ratio : computedDim.w;
    computedDim.h =
      computedDim.h === 'auto' ? image.height / ratio : computedDim.h;
  }
  // Finally, return an object with the width and height of the background image.
  return {
    width: computedDim.w,
    height: computedDim.h,
    scaleH: (computedDim.h / image.height) * 100,
    scaleW: (computedDim.w / image.width) * 100,
    imageWidth: image.width,
    imageHeight: image.height,
  };
};
