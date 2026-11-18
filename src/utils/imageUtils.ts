export interface CompressImageOptions {
  stampTimestamp?: boolean;
  label?: string;
}

function formatPhotoTimestamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())} WIB`;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawTimestampWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  label?: string
): void {
  const stampText = formatPhotoTimestamp();
  const text = label?.trim() ? `${label.trim()} • ${stampText}` : stampText;
  const fontSize = Math.max(13, Math.min(28, Math.round(width * 0.022)));
  const padX = Math.round(fontSize * 0.65);
  const padY = Math.round(fontSize * 0.42);
  const margin = Math.max(10, Math.round(width * 0.018));

  ctx.save();
  ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const metrics = ctx.measureText(text);
  const maxBoxWidth = width - margin * 2;
  const boxW = Math.min(maxBoxWidth, Math.ceil(metrics.width) + padX * 2);
  const boxH = fontSize + padY * 2;
  const boxX = width - margin - boxW;
  const boxY = height - margin - boxH;

  drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, Math.round(fontSize * 0.42));
  ctx.fillStyle = 'rgba(10, 25, 47, 0.78)';
  ctx.fill();
  ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.08));
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, width - margin - padX, boxY + boxH / 2, maxBoxWidth - padX * 2);
  ctx.restore();
}

export async function compressImage(
  file: File,
  maxWidth = 1280,
  quality = 0.82,
  options?: CompressImageOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        if (options?.stampTimestamp) {
          drawTimestampWatermark(ctx, width, height, options.label);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Gagal memuat gambar: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar untuk render'));
    img.src = src;
  });
}

export function createMockPhotoDataUrl(
  title: string,
  subtitle: string,
  lines: string[],
  isOk: boolean,
  compact = false
): string {
  const scale = compact ? 0.6 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(800 * scale);
  canvas.height = Math.round(540 * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.scale(scale, scale);

  // Dark terminal / monitoring screen aesthetic
  const grad = ctx.createLinearGradient(0, 0, 800, 540);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 800, 540);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 800; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 540);
    ctx.stroke();
  }
  for (let y = 0; y < 540; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(800, y);
    ctx.stroke();
  }

  // Top bar
  ctx.fillStyle = '#020617';
  ctx.fillRect(28, 28, 744, 52);
  ctx.fillStyle = isOk ? '#10b981' : '#ef4444';
  ctx.beginPath();
  ctx.arc(58, 54, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(title, 82, 62);

  // Status tag on top right
  const badgeText = isOk ? 'STATUS: ONLINE / OK' : 'STATUS: ERROR / NOT OK';
  ctx.fillStyle = isOk ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.25)';
  ctx.fillRect(500, 38, 254, 32);
  ctx.fillStyle = isOk ? '#34d399' : '#f87171';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(badgeText, 518, 60);

  // Body card
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(28, 96, 744, 412);
  ctx.strokeStyle = isOk ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(28, 96, 744, 412);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText(subtitle, 52, 138);

  // Monospace metrics lines
  ctx.font = '18px monospace';
  lines.forEach((line, index) => {
    const y = 190 + index * 40;
    ctx.fillStyle =
      line.includes('FAIL') || line.includes('TIMEOUT') || line.includes('NOT OK')
        ? '#f87171'
        : '#38bdf8';
    ctx.fillText(`> ${line}`, 52, y);
  });

  // Mini simulated graph bars at bottom
  const barBaseY = 468;
  for (let i = 0; i < 24; i++) {
    const barH = isOk ? 24 + ((i * 19) % 52) : i > 16 ? 12 : 30 + ((i * 13) % 35);
    ctx.fillStyle =
      !isOk && i > 16 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.65)';
    ctx.fillRect(54 + i * 29, barBaseY - barH, 18, barH);
  }

  return canvas.toDataURL('image/jpeg', compact ? 0.78 : 0.85);
}
