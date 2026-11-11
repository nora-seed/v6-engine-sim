import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Use wasm32 build for Android/Termux compatibility
sharp.simd(false);

const svg = fs.readFileSync('public/icons/icon.svg');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outDir = 'public/icons';

await Promise.all(sizes.map(s =>
  sharp(svg, { density: 300 })
    .resize(s, s, { fit: 'contain', background: { r: 13, g: 27, b: 42, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, `icon-${s}.png`))
));
console.log('Icons generated:', sizes.join(', '));