const { io: ioClient } = require('socket.io-client');
const http = require('http');

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let resp = '';
      res.on('data', (d) => (resp += d));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(resp) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: resp });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('================================================================');
  console.log('   TESTING REAL-TIME SHOP OPEN / CLOSE STATUS VIA SOCKET.IO    ');
  console.log('================================================================\n');

  // 1. Get Store ID
  const storeRes = await getJSON('http://localhost:5000/api/stores?limit=1');
  const store = storeRes.data?.stores?.[0];
  if (!store) {
    console.error('No store found!');
    process.exit(1);
  }
  const storeId = store.id;
  console.log(`[Step 1] Target Store: "${store.name}" (${storeId})`);
  console.log(`         Initial Status: ${store.is_live_open ? 'LIVE OPEN 🟢' : 'CLOSED 🔴'}\n`);

  // 2. Connect Customer Socket
  console.log('[Step 2] Connecting Customer Socket Client...');
  const customerSocket = ioClient('http://localhost:5000', {
    transports: ['websocket'],
    forceNew: true
  });

  await new Promise((resolve) => customerSocket.on('connect', resolve));
  console.log(`         Customer connected: Socket ID = ${customerSocket.id}`);

  // Customer joins store room
  customerSocket.emit('join_store', storeId);

  // 3. Connect Merchant Socket
  console.log('\n[Step 3] Connecting Merchant Socket Client...');
  const merchantSocket = ioClient('http://localhost:5000', {
    transports: ['websocket'],
    forceNew: true
  });

  await new Promise((resolve) => merchantSocket.on('connect', resolve));
  console.log(`         Merchant connected: Socket ID = ${merchantSocket.id}`);

  // 4. Test Toggling to CLOSED 🔴
  console.log('\n[Step 4] Merchant toggles store status to: CLOSED (false)...');
  const customerReceivedClosed = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for CLOSED status event')), 5000);
    customerSocket.on('store_status_changed', (payload) => {
      if (payload.storeId === storeId || payload.store_id === storeId) {
        clearTimeout(timeout);
        resolve(payload);
      }
    });
  });

  const startTime1 = Date.now();
  merchantSocket.emit('toggle_store_status', { storeId, isOpen: false });

  const closedPayload = await customerReceivedClosed;
  const elapsed1 = Date.now() - startTime1;
  console.log(`         ✓ Customer received live event in ${elapsed1}ms!`);
  console.log('         Payload:', closedPayload);
  if (closedPayload.is_live_open !== false) {
    throw new Error('Expected is_live_open to be false!');
  }

  // 5. Test Toggling back to LIVE OPEN 🟢
  console.log('\n[Step 5] Merchant toggles store status back to: LIVE OPEN (true)...');
  const customerReceivedOpen = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for OPEN status event')), 5000);
    customerSocket.on('store_status_changed', (payload) => {
      if ((payload.storeId === storeId || payload.store_id === storeId) && payload.is_live_open === true) {
        clearTimeout(timeout);
        resolve(payload);
      }
    });
  });

  const startTime2 = Date.now();
  merchantSocket.emit('toggle_store_status', { storeId, isOpen: true });

  const openPayload = await customerReceivedOpen;
  const elapsed2 = Date.now() - startTime2;
  console.log(`         ✓ Customer received live event in ${elapsed2}ms!`);
  console.log('         Payload:', openPayload);
  if (openPayload.is_live_open !== true) {
    throw new Error('Expected is_live_open to be true!');
  }

  // Clean disconnect
  customerSocket.disconnect();
  merchantSocket.disconnect();

  console.log('\n================================================================');
  console.log('   🎉 LIVE STORE STATUS SOCKET.IO BROADCAST VERIFIED 100%!     ');
  console.log('================================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});

