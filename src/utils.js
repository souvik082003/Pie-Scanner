// ============================================
// ScanPro — Utility Functions
// ============================================

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Format time ago
 */
export function timeAgo(timestamp, agoText = 'ago') {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count > 1 ? 's' : ''} ${agoText}`;
    }
  }
  return `Just now`;
}

/**
 * Read file as Data URL
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Read file as ArrayBuffer
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Load image from src
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Compress image using canvas
 */
export async function compressImage(dataUrl, quality = 0.7, maxWidth = 2000) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let { width, height } = img;
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Apply filter to image
 */
export function applyFilter(canvas, filter) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  switch (filter) {
    case 'grayscale':
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = data[i + 1] = data[i + 2] = avg;
      }
      break;

    case 'contrast':
      const factor = 1.5;
      const intercept = 128 * (1 - factor);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] * factor + intercept;
        data[i + 1] = data[i + 1] * factor + intercept;
        data[i + 2] = data[i + 2] * factor + intercept;
      }
      break;

    case 'enhance':
      // Auto levels + slight contrast boost
      let minR = 255, minG = 255, minB = 255;
      let maxR = 0, maxG = 0, maxB = 0;
      for (let i = 0; i < data.length; i += 4) {
        minR = Math.min(minR, data[i]);
        minG = Math.min(minG, data[i + 1]);
        minB = Math.min(minB, data[i + 2]);
        maxR = Math.max(maxR, data[i]);
        maxG = Math.max(maxG, data[i + 1]);
        maxB = Math.max(maxB, data[i + 2]);
      }
      for (let i = 0; i < data.length; i += 4) {
        data[i] = ((data[i] - minR) / (maxR - minR || 1)) * 255;
        data[i + 1] = ((data[i + 1] - minG) / (maxG - minG || 1)) * 255;
        data[i + 2] = ((data[i + 2] - minB) / (maxB - minB || 1)) * 255;
      }
      break;

    case 'sharpen':
      // Simple sharpen using unsharp mask approximation
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(imageData, 0, 0);
      // Enhance edges
      const sharpFactor = 0.3;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * (1 + sharpFactor));
        data[i + 1] = Math.min(255, data[i + 1] * (1 + sharpFactor));
        data[i + 2] = Math.min(255, data[i + 2] * (1 + sharpFactor));
      }
      break;

    case 'bright':
      const brightness = 30;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] + brightness);
        data[i + 1] = Math.min(255, data[i + 1] + brightness);
        data[i + 2] = Math.min(255, data[i + 2] + brightness);
      }
      break;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Download a blob as file
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download data URL as file
 */
export function downloadDataURL(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Create file input and trigger click
 */
export function createFileInput(accept, multiple = false) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = (e) => {
      resolve(multiple ? Array.from(e.target.files) : e.target.files[0]);
    };
    input.click();
  });
}

/**
 * Debounce function
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate unique ID
 */
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Apply brightness and contrast to a canvas
 */
export function applyBrightnessContrast(canvas, brightness = 0, contrast = 0) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, Math.max(0, contrastFactor * (data[i] - 128) + 128 + brightness));
    data[i + 1] = Math.min(255, Math.max(0, contrastFactor * (data[i + 1] - 128) + 128 + brightness));
    data[i + 2] = Math.min(255, Math.max(0, contrastFactor * (data[i + 2] - 128) + 128 + brightness));
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Apply blur to specific regions (eraser/privacy blur)
 */
export function applyEraserBlur(canvas, points, radius = 20) {
  const ctx = canvas.getContext('2d');
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  for (const point of points) {
    const x = Math.max(0, point.x - radius * 2);
    const y = Math.max(0, point.y - radius * 2);
    const w = Math.min(canvas.width - x, radius * 4);
    const h = Math.min(canvas.height - y, radius * 4);

    ctx.save();
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = 'blur(12px)';
    ctx.drawImage(tempCanvas, x, y, w, h, x, y, w, h);
    ctx.restore();
  }

  ctx.filter = 'none';
  return canvas;
}

/**
 * Add watermark text to canvas
 */
export function addWatermarkToCanvas(canvas, text, options = {}) {
  const ctx = canvas.getContext('2d');
  const {
    fontSize = 24,
    color = 'rgba(0, 0, 0, 0.15)',
    rotation = -30,
    position = 'center'
  } = options;

  ctx.save();
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (position === 'tiled') {
    const metrics = ctx.measureText(text);
    const tw = metrics.width + 80;
    const th = fontSize + 60;
    ctx.rotate((rotation * Math.PI) / 180);
    for (let y = -canvas.height; y < canvas.height * 2; y += th) {
      for (let x = -canvas.width; x < canvas.width * 2; x += tw) {
        ctx.fillText(text, x, y);
      }
    }
  } else {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
  }

  ctx.restore();
  return canvas;
}

/**
 * Convert data URL to Blob
 */
export function dataURLtoBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Create a ZIP blob from files
 */
export function createZipBlob(files) {
  // Minimal ZIP implementation
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);

    // Local file header
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression (stored)
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc32(data), true); // crc32
    lv.setUint32(18, data.length, true); // compressed size
    lv.setUint32(22, data.length, true); // uncompressed size
    lv.setUint16(26, nameBytes.length, true); // name length
    lv.setUint16(28, 0, true); // extra field length
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);

    // Central directory header
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc32(data), true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true); // local header offset
    central.set(nameBytes, 46);

    localHeaders.push(local);
    centralHeaders.push(central);
    offset += local.length;
  }

  const centralDirSize = centralHeaders.reduce((s, h) => s + h.length, 0);

  // End of central directory
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  return new Blob([...localHeaders, ...centralHeaders, eocd], { type: 'application/zip' });
}

// CRC32 helper for ZIP
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

