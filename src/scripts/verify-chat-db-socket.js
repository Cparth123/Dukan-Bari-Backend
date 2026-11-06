const { executeDataConnect, toUUID } = require('../config/dataconnect');
const { Conversation, Message, User, Store } = require('../models');
const ioClient = require('socket.io-client');

async function verify() {
  console.log('========================================================');
  console.log('   DUKAN BARI - VERIFY CHAT, SOCKET & FIREBASE DATA CONNECT');
  console.log('========================================================\n');

  // 1. Get an existing customer and store from Data Connect
  console.log('[Step 1] Fetching live Users and Stores from Firebase Data Connect...');
  const usersRes = await executeDataConnect(`
    query {
      users {
        id
        fullName
        role
      }
      stores {
        id
        name
        ownerId
      }
    }
  `);

  const users = usersRes.data?.users || [];
  const stores = usersRes.data?.stores || [];
  console.log(`Found ${users.length} user(s) and ${stores.length} store(s) in Cloud SQL.`);

  if (users.length === 0 || stores.length === 0) {
    throw new Error('Please ensure at least 1 user and 1 store exist in database.');
  }

  const customer = users.find(u => u.role === 'customer') || users[0];
  const store = stores[0];
  console.log(`Selected Customer: ${customer.fullName} (${customer.id})`);
  console.log(`Selected Store: ${store.name} (${store.id})`);

  // 2. Find or Create Conversation
  console.log('\n[Step 2] Creating / Finding Conversation in Firebase Data Connect...');
  const conv = await Conversation.findOrCreate({
    customer_id: customer.id,
    store_id: store.id
  });
  console.log(`Conversation ID: ${conv.id}`);

  // 3. Connect Socket.io client
  console.log('\n[Step 3] Connecting Socket.io Client & Joining Conversation Room...');
  const socket = ioClient('http://localhost:5000', {
    transports: ['websocket'],
    auth: { token: '' }
  });

  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log(`Socket.io connected with client ID: ${socket.id}`);
      resolve();
    });
    socket.on('connect_error', reject);
  });

  // Join room
  socket.emit('join_conversation', conv.id);
  await new Promise(r => setTimeout(r, 200));

  // 4. Set up socket listener for live message
  let socketReceivedMessage = null;
  socket.on('new_message', (msg) => {
    console.log(`[Socket Received] new_message event caught: "${msg.text}"`);
    socketReceivedMessage = msg;
  });

  // 5. Send message via Message.create (which commits to Data Connect Cloud SQL)
  console.log('\n[Step 4] Creating & Persisting Message to Firebase Data Connect Cloud SQL...');
  const testMessageText = `Verification message at ${new Date().toLocaleTimeString()} [${Date.now()}]`;
  const createdMsg = await Message.create({
    conversation_id: conv.id,
    sender_id: customer.id,
    sender_role: 'customer',
    text: testMessageText
  });
  console.log(`Message created: ID ${createdMsg.id}, text: "${createdMsg.text}"`);

  // Emit over socket room as the client would
  socket.emit('send_message', {
    id: createdMsg.id,
    conversation_id: conv.id,
    sender_id: customer.id,
    sender_role: 'customer',
    text: testMessageText
  });

  // Wait 1 second for socket propagation
  await new Promise(r => setTimeout(r, 1000));

  // 6. Verify directly in Cloud SQL via Data Connect GraphQL Query
  console.log('\n[Step 5] Direct Cloud SQL Introspection via executeDataConnect...');
  const verifyDbRes = await executeDataConnect(`
    query VerifyHistory($convId: UUID!) {
      messages(where: { conversationId: { eq: $convId } }, orderBy: [{ createdAt: DESC }], limit: 5) {
        id
        conversationId
        senderId
        senderRole
        text
        createdAt
      }
    }
  `, { convId: toUUID(conv.id) });

  const persistedMessages = verifyDbRes.data?.messages || [];
  console.log(`Direct Cloud SQL query returned ${persistedMessages.length} message(s) for conversation:`);
  persistedMessages.forEach((m, idx) => {
    console.log(`  ${idx + 1}. [${m.senderRole}] ${m.text} (ID: ${m.id})`);
  });

  const foundInDb = persistedMessages.some(m => m.text === testMessageText);

  console.log('\n========================================================');
  if (foundInDb) {
    console.log('  SUCCESS! MESSAGE IS COMMITTED IN CLOUD SQL POSTGRESQL!');
  } else {
    console.log('  WARNING: Message not found in direct Cloud SQL query.');
  }

  if (socketReceivedMessage) {
    console.log('  SUCCESS! SOCKET.IO REALTIME EVENT RECEIVED INSTANTLY!');
  } else {
    console.log('  Socket event was not received within timeout.');
  }
  console.log('========================================================\n');

  socket.disconnect();
}

verify().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});

