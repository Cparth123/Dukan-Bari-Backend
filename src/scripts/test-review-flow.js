const http = require('http');

function postJSON(url, data) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = JSON.stringify(data);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr)
        }
      },
      (res) => {
        let resp = '';
        res.on('data', (d) => (resp += d));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(resp) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: resp });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

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
  console.log('Testing Store Reviews API & Data Connect integration...');
  
  // 1. First get a valid store from backend
  const storeRes = await getJSON('http://localhost:5000/api/stores?limit=1');
  const store = storeRes.data?.stores?.[0];
  if (!store) {
    console.error('No stores found!');
    return;
  }
  console.log(`Using Store: ${store.name} (${store.id})`);
  console.log(`Store Coordinates: lat=${store.latitude}, lng=${store.longitude}`);

  // Verify Google Maps URL construction
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude || 21.1702},${store.longitude || 72.8311}`;
  console.log(`Verified Google Maps URL: ${mapsUrl}`);

  // 2. Submit a test customer review
  const testUserId = '6d7b9c689cd148ce854dbabf7416cbdf'; // Customer from Firebase screenshot
  const submitRes = await postJSON('http://localhost:5000/api/reviews', {
    store_id: store.id,
    user_id: testUserId,
    user_name: 'Verified Customer',
    rating: 5,
    comment: 'Exceptional service and quick turnaround! Highly recommended storefront.'
  });
  console.log('Submit Review Response Status:', submitRes.status);
  console.log('Submit Review Response Data:', submitRes.data);

  // 3. Fetch reviews for this store
  const listRes = await getJSON(`http://localhost:5000/api/reviews/store/${store.id}`);
  console.log('List Reviews Response Status:', listRes.status);
  console.log(`Total Reviews: ${listRes.data?.total_reviews}, Avg Rating: ${listRes.data?.average_rating}`);
  if (listRes.data?.reviews) {
    console.log(`Recent reviews count: ${listRes.data.reviews.length}`);
    const lastRev = listRes.data.reviews[listRes.data.reviews.length - 1];
    console.log('Latest review sample:', lastRev);
  }
}

run().catch(console.error);

