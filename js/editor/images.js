// Image picking and downscaling. Images are stored as data URLs inside the deck (export-friendly).
const MAX_EDGE = 2560;

export function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      try { resolve(await downscale(file)); } catch { alert('That image could not be loaded.'); resolve(null); }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}

async function downscale(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const keepAlpha = /png|gif|webp|svg/.test(file.type);
    return { src: c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.85), w, h, name: file.name.replace(/\.[^.]+$/, '') };
  } finally {
    URL.revokeObjectURL(url);
  }
}
