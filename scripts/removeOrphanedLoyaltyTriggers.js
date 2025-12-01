
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, remove } = require('firebase/database');
const firebaseConfig = require('./firebaseConfig.node.cjs');

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function removeOrphanedLoyaltyTriggers() {
  const loyaltyRef = ref(db, 'loyaltyTriggerEvents');
  const snapshot = await get(loyaltyRef);
  if (!snapshot.exists()) {
    console.log('No loyalty trigger events found.');
    return;
  }
  const data = snapshot.val();
  const orphanedIds = Object.entries(data)
    .filter(([id, value]) => {
      return !value.event && !value.country && !value.city;
    })
    .map(([id]) => id);

  if (orphanedIds.length === 0) {
    console.log('No orphaned records found.');
    return;
  }

  for (const id of orphanedIds) {
    await remove(ref(db, `loyaltyTriggerEvents/${id}`));
    console.log(`Deleted orphaned record: ${id}`);
  }
  console.log(`Deleted ${orphanedIds.length} orphaned records.`);
}

removeOrphanedLoyaltyTriggers().catch(console.error);
