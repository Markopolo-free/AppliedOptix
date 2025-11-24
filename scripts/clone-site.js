#!/usr/bin/env node
/**
 * Clone Site Tool - Creates a branded copy of the site
 * Usage: node scripts/clone-site.js <theme-name> [output-folder]
 * Example: node scripts/clone-site.js greentransit ../GreenTransitPortal
 */

const fs = require('fs');
const path = require('path');

// Parse command line args
const themeName = process.argv[2];
const outputFolder = process.argv[3] || `../${themeName}-portal`;

if (!themeName) {
  console.error('❌ Error: Please specify a theme name');
  console.log('Usage: node scripts/clone-site.js <theme-name> [output-folder]');
  console.log('Example: node scripts/clone-site.js greentransit ../GreenTransitPortal');
  process.exit(1);
}

const themeFile = path.join(__dirname, '..', 'themes', `${themeName}.json`);
if (!fs.existsSync(themeFile)) {
  console.error(`❌ Error: Theme file not found: ${themeFile}`);
  console.log(`Available themes: ${fs.readdirSync(path.join(__dirname, '..', 'themes')).join(', ')}`);
  process.exit(1);
}

console.log(`🎨 Loading theme: ${themeName}`);
const theme = JSON.parse(fs.readFileSync(themeFile, 'utf8'));

const rootDir = path.join(__dirname, '..');
const targetDir = path.resolve(outputFolder);

console.log(`📂 Cloning site to: ${targetDir}`);

// Files/folders to exclude from copy
const excludes = [
  'node_modules',
  'dist',
  '.git',
  '.vercel',
  'package-lock.json',
  '.env.local',
  'AppliedOptix' // nested folder
];

// Copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (excludes.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Apply theme to file content
function applyThemeToFile(filePath, theme) {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Replace colors (Tailwind classes)
  const colorMappings = {
    'blue-600': theme.branding.primaryColor,
    'blue-500': theme.branding.secondaryColor,
    'blue-400': theme.branding.accentColor,
    'gray-800': theme.branding.textPrimary,
    'gray-500': theme.branding.textSecondary,
    'green-600': theme.branding.successColor,
    'red-600': theme.branding.errorColor
  };

  // Replace text content
  if (filePath.includes('Dashboard.tsx')) {
    if (content.includes('"Dashboard"') && theme.pages.dashboard) {
      content = content.replace(
        /className="text-3xl font-bold[^"]*">Dashboard</,
        `className="text-3xl font-bold text-gray-800">${theme.pages.dashboard.title}<`
      );
      modified = true;
    }
  }

  // Update logo path
  if (content.includes('/logo.jpg') && theme.branding.logo !== '/logo.jpg') {
    content = content.replace(/\/logo\.jpg/g, theme.branding.logo);
    modified = true;
  }

  // Update package.json
  if (filePath.endsWith('package.json')) {
    const pkg = JSON.parse(content);
    pkg.name = `${theme.clientName.toLowerCase()}-staff-portal`;
    content = JSON.stringify(pkg, null, 2);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// Create theme CSS file
function createThemeCSS(targetDir, theme) {
  const cssContent = `/* Auto-generated theme for ${theme.clientName} */
:root {
  --color-primary: ${theme.branding.primaryColor};
  --color-secondary: ${theme.branding.secondaryColor};
  --color-accent: ${theme.branding.accentColor};
  --color-bg: ${theme.branding.backgroundColor};
  --color-text-primary: ${theme.branding.textPrimary};
  --color-text-secondary: ${theme.branding.textSecondary};
  --color-success: ${theme.branding.successColor};
  --color-error: ${theme.branding.errorColor};
}

/* Apply primary color to key elements */
.btn-primary {
  background-color: var(--color-primary);
}

.text-primary {
  color: var(--color-primary);
}

.bg-primary {
  background-color: var(--color-primary);
}
`;

  const cssPath = path.join(targetDir, 'theme.css');
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  console.log(`✅ Created theme.css with ${theme.clientName} colors`);
}

// Main execution
try {
  // Step 1: Copy entire site
  console.log('📋 Copying files...');
  copyDir(rootDir, targetDir);

  // Step 2: Apply theme to key files
  console.log('🎨 Applying theme...');
  const filesToUpdate = [
    path.join(targetDir, 'components', 'Dashboard.tsx'),
    path.join(targetDir, 'package.json'),
    path.join(targetDir, 'index.html')
  ];

  filesToUpdate.forEach(file => applyThemeToFile(file, theme));

  // Step 3: Create theme CSS
  createThemeCSS(targetDir, theme);

  // Step 4: Copy logo if specified
  if (theme.branding.logo && theme.branding.logo !== '/logo.jpg') {
    const srcLogo = path.join(rootDir, 'public', path.basename(theme.branding.logo));
    const destLogo = path.join(targetDir, 'public', path.basename(theme.branding.logo));
    if (fs.existsSync(srcLogo)) {
      fs.copyFileSync(srcLogo, destLogo);
      console.log(`✅ Copied logo: ${path.basename(theme.branding.logo)}`);
    }
  }

  // Step 5: Create README
  const readmeContent = `# ${theme.clientName} Staff Portal

This is a branded clone of the AppliedOptix staff portal.

## Theme: ${themeName}

### Brand Colors
- Primary: ${theme.branding.primaryColor}
- Secondary: ${theme.branding.secondaryColor}
- Accent: ${theme.branding.accentColor}

## Quick Start

\`\`\`bash
npm install
npm run dev
\`\`\`

## Build for Production

\`\`\`bash
npm run build
\`\`\`

## Deploy to Vercel

\`\`\`bash
vercel
\`\`\`
`;

  fs.writeFileSync(path.join(targetDir, 'README.md'), readmeContent, 'utf8');

  console.log('\n✅ Clone complete!');
  console.log(`\n📍 Location: ${targetDir}`);
  console.log(`\n🚀 Next steps:`);
  console.log(`   cd ${path.relative(process.cwd(), targetDir)}`);
  console.log(`   npm install`);
  console.log(`   npm run dev`);
  console.log(`\n💡 Tip: Edit themes/${themeName}.json to customize further, then re-run this script`);

} catch (error) {
  console.error('❌ Error during cloning:', error.message);
  process.exit(1);
}
