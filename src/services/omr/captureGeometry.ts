export const PORTRAIT_CAMERA_ASPECT = 3 / 4;

export function fitCameraFrame(width: number, height: number, aspect = PORTRAIT_CAMERA_ASPECT) {
  const frameWidth = Math.max(0, Math.min(width, height * aspect));
  return { width: frameWidth, height: frameWidth / aspect };
}

export function selectPictureSize(sizes: string[]) {
  const candidates = sizes.map((size) => {
    const [width, height] = size.split('x').map(Number);
    return { size, long: Math.max(width, height), short: Math.min(width, height) };
  }).filter(({ long, short }) => short > 0 && Math.abs(short / long - PORTRAIT_CAMERA_ASPECT) < 0.02);
  // Keep at least 1200 pixels across the sheet without capturing a full 50 MP sensor image.
  return candidates.filter(({ short }) => short >= 1200).sort((a, b) => a.long - b.long)[0]?.size
    ?? candidates.sort((a, b) => b.long - a.long)[0]?.size;
}
