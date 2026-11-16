export const bubbleOutline = (w: number, h: number, r: number, s: number) =>
  `M${r},${s} H${w - r} A${r - s},${r - s} 0 0 1 ${w - s},${r} V${h - 14} C${w - s},${h - 6} ${w + 2},${h - s - 1} ${w + 8},${h - s} ` +
  `C${w + 1},${h - s + 1} ${w - 5},${h - s - 1} ${w - 10},${h - s - 4} C${w - 14},${h - s - 1} ${w - 19},${h - s} ${w - 24},${h - s} ` +
  `H${r} A${r - s},${r - s} 0 0 1 ${s},${h - r} V${r} A${r - s},${r - s} 0 0 1 ${r},${s} Z`;

export const bubbleTail = "M34 0H8V12C8 18 5.4 22.8 0 26C5.5 26.6 10.4 25.4 14 22.6C17 25 20.4 26 24 26H34Z";
