import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
const icoPath = path.join(__dirname, '..', 'public', 'favicon.ico');

const svgBuffer = fs.readFileSync(svgPath);

try {
  const icoBuffer = await sharp(svgBuffer)
    .resize(64, 64)
    .toFormat('ico')
    .toBuffer();
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Generated favicon.ico');
} catch (e) {
  console.log('ICO generation not supported by sharp, skipping:', e.message);
}
