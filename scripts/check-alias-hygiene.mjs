import fs from 'fs';
import path from 'path';

const bannedPatterns = [
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\bgoogle\b/i,
  /\bmistral\b/i,
  /\bxai\b/i,
  /\bgemini\b/i,
  /\bclaude\b/i,
  /\bllama\b/i,
  /\bmixtral\b/i,
  /\bwhisper(?:-[a-z0-9.-]+)?\b/i,
  /\bgpt(?:-[a-z0-9.-]+)?\b/i,
  /\bo1(?:-[a-z0-9.-]+)?\b/i,
  /\bo3(?:-[a-z0-9.-]+)?\b/i,
  /\bo4(?:-[a-z0-9.-]+)?\b/i,
];

const distDir = path.join(process.cwd(), 'dist');
if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Run `npm run build` first.');
  process.exit(1);
}

const files = [];
const walk = dir => {
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (/\.(js|css|html|txt)$/i.test(name)) {
      files.push(fullPath);
    }
  }
};
walk(distDir);

const violations = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of bannedPatterns) {
    if (pattern.test(content)) {
      violations.push({ file, pattern: pattern.toString() });
    }
  }
}

if (violations.length > 0) {
  console.error('Alias hygiene check failed. Banned vendor/model strings found in bundle:');
  for (const violation of violations) {
    console.error(`- ${violation.file} matches ${violation.pattern}`);
  }
  process.exit(1);
}

console.log('Alias hygiene check passed.');
