const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set } = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyDN7BhtJSFMB9DkyW5BS57zjqqVz5Y44Kk",
  authDomain: "appliedoptix-d5db9.firebaseapp.com",
  databaseURL: "https://emobility-service-default-rtdb.firebaseio.com",
  projectId: "appliedoptix-d5db9",
  storageBucket: "appliedoptix-d5db9.firebasestorage.app",
  messagingSenderId: "1025994670722",
  appId: "1:1025994670722:web:ec7097e77ab36174f99e43"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// New vibrant color scheme - Modern Blue & Teal
const newTheme = {
  clientName: 'AppliedOptix',
  branding: {
    logo: '/logo.jpg',
    siteName: 'Staff Portal',
    primaryColor: '#0ea5e9',      // Ocean Blue
    secondaryColor: '#14b8a6',    // Teal Accent
    accentColor: '#8b5cf6',       // Violet
    backgroundColor: '#f8fafc',   // Light slate
    textPrimary: '#1f2937',       // Dark gray
    textSecondary: '#64748b',     // Slate
    successColor: '#10b981',      // Emerald
    errorColor: '#ef4444'         // Rose
  },
  colorPalette: [
    '#0ea5e9', // Ocean Blue
    '#14b8a6', // Teal
    '#8b5cf6', // Violet
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Rose
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#84cc16', // Lime
    '#6366f1'  // Indigo
  ]
};

async function updateTheme() {
  try {
    // Wait a moment for Firebase to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const themeRef = ref(database, 'theme');
    await set(themeRef, newTheme);
    console.log('✅ Theme updated successfully with new color scheme!');
    console.log('New colors:');
    console.log(`  Primary: Ocean Blue (${newTheme.branding.primaryColor})`);
    console.log(`  Secondary: Teal Accent (${newTheme.branding.secondaryColor})`);
    console.log(`  Accent: Violet (${newTheme.branding.accentColor})`);
    console.log(`  Success: Emerald (${newTheme.branding.successColor})`);
    console.log(`  Error: Rose (${newTheme.branding.errorColor})`);
    console.log('\n🎨 The app will automatically reflect these changes!');
    
    // Wait a moment before exiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating theme:', error);
    process.exit(1);
  }
}

updateTheme();
