// Script to add Manjari user to Firebase database
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, set, serverTimestamp } = require('firebase/database');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAgZxO77EwYqP4AZzgo4M1nGv28yf8T9Ic",
  authDomain: "emobility-service.firebaseapp.com",
  databaseURL: "https://emobility-service-default-rtdb.firebaseio.com",
  projectId: "emobility-service",
  storageBucket: "emobility-service.firebasestorage.app",
  messagingSenderId: "535363619209",
  appId: "1:535363619209:web:25eb5330be538a45de3958",
  measurementId: "G-PXPDV2Z0Q2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function addUser() {
  try {
    const usersRef = ref(db, 'users');
    const newUserRef = push(usersRef);
    
    const userData = {
      name: 'Manjari Jaladdin',
      email: 'manjari.jaladdinproj@gmail.com',
      role: 'Staff',
      createdAt: serverTimestamp(),
      lastModifiedAt: serverTimestamp(),
      lastModifiedBy: 'system_script'
    };

    await set(newUserRef, userData);
    console.log('✓ Successfully added user: Manjari Jaladdin (manjari.jaladdinproj@gmail.com)');
    console.log('  Role: Staff');
    console.log('  User can now log in with password: user123');
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error adding user:', error.message);
    process.exit(1);
  }
}

console.log('Adding user to Firebase database...');
addUser();
