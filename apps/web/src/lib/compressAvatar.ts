function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Centre-crops to a square and shrinks until it fits the server's limit
// (40,000 characters), so a phone photo becomes a few KB.
export async function compressAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  for (const size of [192, 160, 128, 96]) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) break;
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
    for (const quality of [0.82, 0.7, 0.55]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) continue;
      const url = await toDataUrl(blob);
      if (url.length <= 38_000) return url;
    }
  }
  throw new Error("image_too_large");
}
