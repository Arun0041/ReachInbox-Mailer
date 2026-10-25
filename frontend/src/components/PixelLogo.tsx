import type { ReactNode } from "react";

/**
 * "ONB" logo drawn as a small pixel-art grid, matching the blocky wordmark
 * in the design. Each glyph is a 5x7 bitmap; 1 = filled pixel.
 */
const GLYPHS: Record<string, number[][]> = {
  O: [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
  N: [
    [1, 0, 0, 0, 1],
    [1, 1, 0, 0, 1],
    [1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1],
    [1, 0, 0, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  B: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
};

const GLYPH_WIDTH = 5;
const LETTER_SPACING = 1;

export function PixelLogo({ text = "ONB", size = 4 }: { text?: string; size?: number }) {
  const letters = text.toUpperCase().split("");
  const cols = letters.length * GLYPH_WIDTH + (letters.length - 1) * LETTER_SPACING;
  const unit = size;
  const width = cols * unit;
  const height = 7 * unit;

  const rects: ReactNode[] = [];
  letters.forEach((ch, li) => {
    const glyph = GLYPHS[ch];
    if (!glyph) return;
    const offsetX = li * (GLYPH_WIDTH + LETTER_SPACING);
    glyph.forEach((row, y) => {
      row.forEach((pixel, x) => {
        if (pixel) {
          rects.push(
            <rect
              key={`${li}-${y}-${x}`}
              x={(offsetX + x) * unit}
              y={y * unit}
              width={unit}
              height={unit}
              fill="#111111"
            />,
          );
        }
      });
    });
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={text}
      role="img"
    >
      {rects}
    </svg>
  );
}
