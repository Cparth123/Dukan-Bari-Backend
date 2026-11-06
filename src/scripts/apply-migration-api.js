const admin = require('../../../backend/node_modules/firebase-admin');
const sa = require('../../../backend/serviceAccountKey.json');
const fs = require('fs');
const path = require('path');

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });

async function pollOperation(opName, token) {
  const url = `https://firebasedataconnect.googleapis.com/v1/${opName}`;
  console.log('Polling operation:', opName);
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const op = await res.json();
    if (op.done) {
      if (op.error) {
        throw new Error('Operation failed: ' + JSON.stringify(op.error));
      }
      console.log('Operation completed successfully!');
      return op.response;
    }
    console.log(`Still running... (${i + 1})`);
  }
  throw new Error('Operation timed out');
}

async function run() {
  const token = (await admin.credential.cert(sa).getAccessToken()).access_token;
  const schemaContent = fs.readFileSync(path.join(__dirname, '../../../dataconnect/schema/schema.gql'), 'utf8');

  // Step 1: Validate schema to get SQL diffs
  console.log('[Step 1] Requesting schema validation diffs...');
  const validateUrl = 'https://firebasedataconnect.googleapis.com/v1/projects/dukan-bari/locations/asia-east1/services/dukan-bari-service/schemas/main?validateOnly=true&allowMissing=true';
  const validateBody = {
    name: 'projects/dukan-bari/locations/asia-east1/services/dukan-bari-service/schemas/main',
    source: {
      files: [
        {
          path: 'schema.gql',
          content: schemaContent
        }
      ]
    },
    datasources: [
      {
        postgresql: {
          database: 'dukan-bari-database',
          cloudSql: {
            instance: 'projects/dukan-bari/locations/asia-east1/instances/dukan-bari-instance'
          },
          schemaValidation: 'COMPATIBLE'
        }
      }
    ]
  };

  const valRes = await fetch(validateUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(validateBody)
  });

  const valData = await valRes.json();
  let diffs = [];
  if (valData.error && valData.error.details) {
    const detail = valData.error.details.find(d => d['@type'] && d['@type'].includes('IncompatibleSqlSchemaError'));
    if (detail && detail.diffs) {
      diffs = detail.diffs;
    }
  }

  console.log(`Found ${diffs.length} SQL diff(s):`);
  diffs.forEach((d, i) => console.log(`  ${i + 1}. [${d.description}] -> ${d.sql}`));

  if (diffs.length > 0) {
    // Step 2: Execute schema migration with diffs
    console.log('\n[Step 2] Executing schemas/main:migrate with diffs...');
    const migrateUrl = 'https://firebasedataconnect.googleapis.com/v1/projects/dukan-bari/locations/asia-east1/services/dukan-bari-service/schemas/main:migrate';
    const migrateRes = await fetch(migrateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ diffs })
    });

    const migrateData = await migrateRes.json();
    console.log('Migrate API response:', JSON.stringify(migrateData, null, 2));

    if (migrateData.name) {
      await pollOperation(migrateData.name, token);
    }
  }

  // Step 3: Now apply the GraphQL schema
  console.log('\n[Step 3] Applying updated GraphQL Schema to schemas/main...');
  const applyUrl = 'https://firebasedataconnect.googleapis.com/v1/projects/dukan-bari/locations/asia-east1/services/dukan-bari-service/schemas/main?allowMissing=true';
  const applyRes = await fetch(applyUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(validateBody)
  });

  const applyData = await applyRes.json();
  console.log('Apply Schema response:', JSON.stringify(applyData, null, 2));
  if (applyData.name) {
    await pollOperation(applyData.name, token);
  }

  console.log('\n🎉 ALL DONE! Tables created and schema updated successfully!');
}

run().catch(err => {
  console.error('Fatal Error:', err);
  process.exit(1);
});

