// Script to find duplicate keys in reference data JSON
// Usage: node findDuplicates.js <path-to-json-file>

const fs = require('fs');
const path = process.argv[2];
if (!path) {
  console.error('Usage: node findDuplicates.js <path-to-json-file>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const seen = new Set();
const duplicates = [];

for (const key in data) {
  if (seen.has(key)) {
    duplicates.push(key);
  } else {
    seen.add(key);
  }
}

if (duplicates.length === 0) {
  console.log('No duplicate keys found.');
} else {
  console.log('Duplicate keys found:');
  duplicates.forEach(k => console.log(k));
}
