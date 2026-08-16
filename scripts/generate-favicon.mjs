import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svgPath = path.join(__dirname, '..', 'public', 'icon.svg');
const pngPath = path.join(__dirname, '..', 'public', 'favicon.png');
const png64Path = path.join(__dirname, '..', 'public', 'favicon-64.png');
const png32Path = path.join(__dirname, '..', 'public', 'favicon-32.png');

const svgBuffer = fs.readFileSync(svgPath);

await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile(pngPath);
console.log('Generated favicon.png');

await sharp(svgBuffer)
  .resize(64, 64)
  .png()
  .toFile(png64Path);
console.log('Generated favicon-64.png');

await sharp(svgBuffer)
  .resize(32, 32)
  .png()
  .toFile(png32Path);
console.log('Generated favicon-32.png');
