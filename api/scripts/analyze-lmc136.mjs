import fs from 'fs';
import { PDFParse } from 'pdf-parse';

const filePath = '/Users/lukma4n/Documents/projek_tdmdxk/file/LMC 136 - Petunjuk Pelaksanaan Program Sales Discount Reguler Periode 01-30 Juni 2026.pdf';
const buffer = fs.readFileSync(filePath);
const parser = new PDFParse({ data: buffer });
const result = await parser.getText();
await parser.destroy();

const text = result.text;
const normalized = text.replace(/\r/g, '').replace(/\n+/g, ' ').replace(/\s+/g, ' ');

console.log('=== FULL NORMALIZED TEXT ===');
console.log(normalized);
console.log('=== END FULL TEXT ===');

console.log('\n=== Document Number ===');
console.log(text.match(/LMC\.[A-Z/]+\/\d+\/[IVXLCDM]+\/20\d{2}/)?.[0] || 'NOT FOUND');

console.log('\n=== Period ===');
const periodMatch = text.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})/i);
console.log(periodMatch ? periodMatch[0] : 'NOT FOUND');

console.log('\n=== Regex match count ===');
const rowRegex = /([A-Z0-9,;\s]+?)\s+(Cash\s*&\s*Credit|Cash|Credit)\s+((?:\d{1,3}(?:\.\d{3})+\s+){2,3}\d{1,3}(?:\.\d{3})+)\s+All Area/gi;
const matches = [];
let match;
while ((match = rowRegex.exec(normalized))) {
  matches.push({ codes: match[1], saleType: match[2], amounts: match[3] });
}
console.log('Matches:', matches.length);
console.log(JSON.stringify(matches, null, 2));
