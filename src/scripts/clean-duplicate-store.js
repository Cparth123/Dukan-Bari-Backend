const { executeDataConnect, toUUID } = require('../config/dataconnect');

async function cleanDuplicates() {
  console.log('--- Checking current stores in Firebase Data Connect ---');
  const q = `query { stores { id name category ownerId createdAt } }`;
  const res = await executeDataConnect(q);
  console.log('Current stores:', JSON.stringify(res.data?.stores, null, 2));

  const stores = res.data?.stores || [];
  // If there are multiple stores for the same owner, delete the older one
  const storesByOwner = {};
  for (const s of stores) {
    if (!storesByOwner[s.ownerId]) {
      storesByOwner[s.ownerId] = [];
    }
    storesByOwner[s.ownerId].push(s);
  }

  for (const [ownerId, ownerStores] of Object.entries(storesByOwner)) {
    if (ownerStores.length > 1) {
      console.log(`Owner ${ownerId} has ${ownerStores.length} stores. Keeping the newest, deleting older ones...`);
      // Sort newest first
      ownerStores.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      // Keep ownerStores[0], delete the rest
      for (let i = 1; i < ownerStores.length; i++) {
        const storeToDelete = ownerStores[i];
        console.log(`Deleting duplicate store: ${storeToDelete.id} (${storeToDelete.name} - ${storeToDelete.category})`);
        const delRes = await executeDataConnect(`
          mutation DelStore($id: UUID!) {
            store_delete(id: $id)
          }
        `, { id: toUUID(storeToDelete.id) });
        console.log('Delete result:', JSON.stringify(delRes));
      }
    }
  }

  const resAfter = await executeDataConnect(q);
  console.log('\nRemaining stores in Cloud SQL:', JSON.stringify(resAfter.data?.stores, null, 2));
}

cleanDuplicates().catch(console.error);

