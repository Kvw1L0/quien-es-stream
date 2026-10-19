'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Renders an image into an HTML5 Canvas with progressive distortion.
 * progress: 0 (maximum distortion at start of timer) -> 1 (100% clear at end/reveal)
 * effectType: 'SWIRL_BLUR' | 'PIXELATE' | 'BLUR' | 'ZOOM'
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

  // Load image into offscreen HTMLImageElement
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

  // Redraw whenever progress, effectType, or isRevealed changes
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

    // Calculate aspect-fill (cover) coordinates for square canvas
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

    const effectiveProgress = isRevealed ? 1 : Math.max(0, Math.min(1, progress));
    // Non-linear curve so the image stays challenging for the first 70% of the timer, then clarifies
    const distortionFactor = isRevealed ? 0 : Math.pow(1 - effectiveProgress, 1.35);

    if (distortionFactor <= 0.005) {
      ctx.filter = 'none';
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
      return;
    }

    if (effectType === 'PIXELATE') {
      // Pixel size goes from 48px down to 1px
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
      ctx.filter = `blur(${blurPx}px) saturate(${1 + distortionFactor * 0.5})`;
      // Draw slightly oversized to avoid dark blur edges
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
      // Extreme center zoom that gradually zooms out
      const maxZoom = 6.5;
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
      // SWIRL_BLUR (Deformación + Difuminado)
      // Render to a smaller buffer for ultra-fast 60fps pixel swirl manipulation
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
      const maxAngle = distortionFactor * 5.2; // radians of twist

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
