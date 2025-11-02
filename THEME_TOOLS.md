# Theme Cloning & Branding Tools

This project includes two powerful tools for creating branded versions of the site:

## 🎨 Option A: Clone-Site Script (Node.js)

Creates a complete branded copy of the site in a new folder with applied theme colors and text.

### Usage

```bash
# Clone with a theme
node scripts/clone-site.js greentransit ../GreenTransitPortal

# Or specify custom output folder
node scripts/clone-site.js <theme-name> [output-folder]
```

### What it does:
- ✅ Copies entire site structure
- ✅ Applies colors from theme JSON
- ✅ Updates titles and branding text
- ✅ Swaps logo references
- ✅ Updates package.json with new name
- ✅ Creates custom theme.css file
- ✅ Generates README for the new site

### Creating a new theme:

1. Copy `themes/default.json` to `themes/yourclient.json`
2. Edit the JSON with your colors and branding:
```json
{
  "clientName": "YourClient",
  "branding": {
    "primaryColor": "#10b981",
    "siteName": "Your Portal"
  }
}
```
3. Run: `node scripts/clone-site.js yourclient`

---

## 🌐 Option C: Web Theme Configurator

Interactive UI for designing themes with live preview—no code needed!

### Access

1. Start the dev server: `npm run dev`
2. Navigate to **🎨 Theme Builder** in the sidebar
3. Or visit: `http://localhost:5173` and click "Theme Builder"

### Features:
- ✅ **Color Palette Grid**: Click any preset color to apply
- ✅ **Color Pickers**: Fine-tune each brand color
- ✅ **Live Preview**: See changes instantly
- ✅ **Export JSON**: Download theme file for clone-site script
- ✅ **Presets**: Quick-load example themes (Default, GreenTransit)

### Workflow:

1. Open Theme Builder in the app
2. Choose a preset or customize colors/titles
3. Preview the design in real-time
4. Click **"Download theme.json"**
5. Save to `themes/` folder
6. Run clone script with your new theme

---

## 📁 Theme File Structure

```json
{
  "clientName": "ClientName",
  "branding": {
    "logo": "/logo.jpg",
    "siteName": "Portal Name",
    "primaryColor": "#3b82f6",
    "secondaryColor": "#2563eb",
    "accentColor": "#60a5fa",
    "backgroundColor": "#f8fafc",
    "textPrimary": "#1f2937",
    "textSecondary": "#6b7280",
    "successColor": "#10b981",
    "errorColor": "#ef4444"
  },
  "pages": {
    "dashboard": {
      "title": "Dashboard",
      "statCards": [...]
    }
  },
  "colorPalette": ["#3b82f6", "#10b981", ...]
}
```

---

## 🚀 Complete Example

### 1. Design in browser:
```bash
npm run dev
# Open browser → Theme Builder → Customize → Export
```

### 2. Clone the site:
```bash
node scripts/clone-site.js myclient ../MyClientPortal
```

### 3. Deploy new site:
```bash
cd ../MyClientPortal
npm install
npm run build
vercel
```

---

## 📦 What gets cloned?

✅ All components and pages  
✅ Dependencies (package.json)  
✅ Build configuration (vite.config.ts)  
✅ Firebase/API setup  
✅ Custom theme CSS  
❌ node_modules (install after clone)  
❌ .env files (create fresh)  
❌ .git history (fresh repo)

---

## 💡 Tips

- **Logos**: Add your logo to `public/logos/` and reference in theme JSON
- **Advanced colors**: Use the web configurator's color picker for exact hex codes
- **Bulk changes**: Edit theme JSON directly for page titles/text
- **Version control**: Commit theme files to track client brands over time

---

## 🛠 Troubleshooting

**"Theme file not found"**  
→ Make sure theme JSON is in `themes/` folder

**Colors not applying**  
→ Clone script targets Tailwind classes; manual CSS may need adjustment

**Build errors after clone**  
→ Run `npm install` in the cloned folder first

---

**Happy theming!** 🎨
