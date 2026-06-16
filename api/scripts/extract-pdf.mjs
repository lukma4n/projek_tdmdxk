import fs from 'fs';
import { PDFParse } from 'pdf-parse';

const filePath = '/Users/lukma4n/Documents/projek_tdmdxk/file/LMC 136 - Petunjuk Pelaksanaan Program Sales Discount Reguler Periode 01-30 Juni 2026.pdf';
const buffer = fs.readFileSync(filePath);
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
await parser.destroy();
console.log('--- RAW TEXT (first 3000 chars) ---');
console.log(result.text.slice(0, 3000));
console.log('--- END RAW TEXT ---');
console.log('--- NORMALIZED TEXT (first 3000 chars) ---');
const normalized = result.text.replace(/\r/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ');
console.log(normalized.slice(0, 3000));
console.log('--- END NORMALIZED TEXT ---');

// Test regex
const rowRegex = /([A-Z0-9,;\s]+?)\s+(Cash\s*&\s*Credit|Cash|Credit)\s+((?:\d{1,3}(?:\.\d{3})+\s+){2,3}\d{1,3}(?:\.\d{3})+)\s+All Area/gi;
const matches = [];
let match;
while ((match = rowRegex.exec(normalized))) {
  matches.push({ codes: match[1], saleType: match[2], amounts: match[3] });
  if (matches.length >= 10) break;
}
console.log('--- REGEX MATCHES (first 10) ---');
console.log(JSON.stringify(matches, null, 2));
console.log('Total matches:', matches.length);
