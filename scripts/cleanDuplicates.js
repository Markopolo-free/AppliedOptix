// Script to automatically remove duplicate keys in reference data JSON
// Usage: node cleanDuplicates.js <path-to-json-file>

const fs = require('fs');
const path = process.argv[2];
if (!path) {
  console.error('Usage: node cleanDuplicates.js <path-to-json-file>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const seen = new Set();
const cleaned = {};
const duplicates = [];

for (const key in data) {
  if (seen.has(key)) {
    duplicates.push(key);
    // Skip duplicate
    continue;
  }
  seen.add(key);
  cleaned[key] = data[key];
}

fs.writeFileSync(path, JSON.stringify(cleaned, null, 2));

if (duplicates.length === 0) {
  console.log('No duplicate keys found. File is clean.');
} else {
  console.log('Duplicate keys removed:');
  duplicates.forEach(k => console.log(k));
  console.log('File has been cleaned and saved.');
}
