'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Renders an image into an HTML5 Canvas with progressive distortion.
 * IMPORTANT FOR TV SUSPENSE:
 * When the timer runs out (progress = 1) BEFORE the admin clicks "REVEAL",
 * the image stays at a suspense floor (e.g. 22% residual distortion) so the audience
 * and hosts can debate! Only when `isRevealed === true` does distortion drop to 0%.
 */
export default function DistortedCanvas({
  imageSrc,
  progress = 0,
  effectType = 'SWIRL_BLUR',
  isRevealed = false,
  className = '',
}) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const loadedSrcRef = useRef(null);

  useEffect(() => {
    if (!imageSrc) return;
    if (loadedSrcRef.current === imageSrc && imgRef.current) {
      drawFrame();
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      loadedSrcRef.current = imageSrc;
      drawFrame();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    drawFrame();
  }, [progress, effectType, isRevealed]);

  function drawFrame() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const imgRatio = img.width / img.height;
    const canvasRatio = width / height;
    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

    if (imgRatio > canvasRatio) {
      sWidth = img.height * canvasRatio;
      sx = (img.width - sWidth) / 2;
    } else {
      sHeight = img.width / canvasRatio;
      sy = (img.height - sHeight) / 2;
    }

    const clampedProgress = Math.max(0, Math.min(1, progress));
    // Suspense floor: even when timer reaches 0 (clampedProgress === 1),
    // keep 24% distortion until the Admin manually clicks "Revelar" (isRevealed === true)
    const suspenseFloor = 0.24;
    const distortionFactor = isRevealed
      ? 0
      : suspenseFloor + (1 - suspenseFloor) * Math.pow(1 - clampedProgress, 1.25);

    if (distortionFactor <= 0.005) {
      ctx.filter = 'none';
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
      return;
    }

    if (effectType === 'PIXELATE') {
      const sampleScale = Math.max(0.025, 1 - distortionFactor * 0.96);
      const smallW = Math.max(6, Math.floor(width * sampleScale));
      const smallH = Math.max(6, Math.floor(height * sampleScale));

      const offCanvas = document.createElement('canvas');
      offCanvas.width = smallW;
      offCanvas.height = smallH;
      const offCtx = offCanvas.getContext('2d');
      offCtx.imageSmoothingEnabled = false;
      offCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, smallW, smallH);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(offCanvas, 0, 0, smallW, smallH, 0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
    } else if (effectType === 'BLUR') {
      const blurPx = (distortionFactor * 38).toFixed(1);
      ctx.save();
      ctx.filter = `blur(${blurPx}px) saturate(${1 + distortionFactor * 0.4})`;
      const bleed = 40;
      ctx.drawImage(
        img,
        sx,
        sy,
        sWidth,
        sHeight,
        -bleed,
        -bleed,
        width + bleed * 2,
        height + bleed * 2
      );
      ctx.restore();
    } else if (effectType === 'ZOOM') {
      const maxZoom = 6.2;
      const currentZoom = 1 + distortionFactor * (maxZoom - 1);
      const zoomedW = sWidth / currentZoom;
      const zoomedH = sHeight / currentZoom;
      const zSx = sx + (sWidth - zoomedW) / 2;
      const zSy = sy + (sHeight - zoomedH) / 2;

      ctx.save();
      const slightBlur = (distortionFactor * 8).toFixed(1);
      ctx.filter = `blur(${slightBlur}px)`;
      ctx.drawImage(img, zSx, zSy, zoomedW, zoomedH, 0, 0, width, height);
      ctx.restore();
    } else {
      // SWIRL_BLUR
      const bufSize = 240;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = bufSize;
      offCanvas.height = bufSize;
      const offCtx = offCanvas.getContext('2d');

      const blurPx = (distortionFactor * 14).toFixed(1);
      offCtx.filter = `blur(${blurPx}px)`;
      offCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, bufSize, bufSize);

      const srcData = offCtx.getImageData(0, 0, bufSize, bufSize);
      const dstData = offCtx.createImageData(bufSize, bufSize);
      const src = srcData.data;
      const dst = dstData.data;

      const cx = bufSize / 2;
      const cy = bufSize / 2;
      const maxRadius = bufSize * 0.48;
      const maxAngle = distortionFactor * 5.2;

      for (let y = 0; y < bufSize; y++) {
        for (let x = 0; x < bufSize; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let sourceX = x;
          let sourceY = y;

          if (dist < maxRadius) {
            const percent = (maxRadius - dist) / maxRadius;
            const theta = percent * percent * maxAngle;
            const sinT = Math.sin(theta);
            const cosT = Math.cos(theta);
            sourceX = Math.round(cx + dx * cosT - dy * sinT);
            sourceY = Math.round(cy + dx * sinT + dy * cosT);
          }

          sourceX = Math.max(0, Math.min(bufSize - 1, sourceX));
          sourceY = Math.max(0, Math.min(bufSize - 1, sourceY));

          const dstIdx = (y * bufSize + x) * 4;
          const srcIdx = (sourceY * bufSize + sourceX) * 4;

          dst[dstIdx] = src[srcIdx];
          dst[dstIdx + 1] = src[srcIdx + 1];
          dst[dstIdx + 2] = src[srcIdx + 2];
          dst[dstIdx + 3] = src[srcIdx + 3];
        }
      }

      offCtx.putImageData(dstData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(offCanvas, 0, 0, bufSize, bufSize, 0, 0, width, height);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={520}
      onContextMenu={(e) => e.preventDefault()}
      className={`select-none pointer-events-none ${className}`}
    />
  );
}
