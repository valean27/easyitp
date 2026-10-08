// Dimensiunea la care incape o poza intr-un patrat de maxSide, pastrand proportiile (nu mareste pozele mici)
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Micsoreaza poza de la camera (adesea 4000px, 3–8 MB) la un JPEG de cateva sute de KB, suficient pentru citit textul
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Poza nu a putut fi procesată.'))), 'image/jpeg', quality)
  );
}

// Logo-ul statiei: PNG (pastreaza transparenta) de cel mult 800 px; serverul il reface la 400 px
export async function shrinkLogo(file: File, maxSide = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Imaginea nu a putut fi procesată.'))), 'image/png')
  );
}
