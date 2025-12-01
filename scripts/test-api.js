// scripts/test-api.js
// Polls the local dev server and tests GET /api/days, POST /start and POST /complete
const fetch = global.fetch || require('node-fetch');
const base = 'http://localhost:3001';

function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

async function waitForServer(timeoutMs = 20000){
  const start = Date.now();
  while (Date.now() - start < timeoutMs){
    try {
      const res = await fetch(base + '/api/days');
      if (res.ok) return true;
    } catch (e) {}
    await delay(500);
  }
  throw new Error('Server did not become ready in time');
}

async function main(){
  try{
    console.log('Waiting for dev server...');
    await waitForServer(30000);
    console.log('Server ready — fetching days');
    let res = await fetch(base + '/api/days');
    console.log('GET /api/days status', res.status);
    let days = await res.json();
    console.log('Days count:', Array.isArray(days) ? days.length : 'not-array');
    if (!Array.isArray(days) || days.length === 0){
      console.log('No days found — creating a test day');
      res = await fetch(base + '/api/days', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: 'Teste (migração)', subtitle: 'migração' }) });
      console.log('POST /api/days =>', res.status);
      const created = await res.json();
      console.log('Created day', created);
      days = [created];
    }
    const day = days[0];
    console.log('Using day id', day.id);

    // Start
    res = await fetch(base + `/api/days/${day.id}/start`, { method: 'POST' });
    console.log('POST /api/days/' + day.id + '/start =>', res.status);
    try{ const body = await res.json(); console.log('Start body:', body); } catch(e){ console.log('No JSON body'); }

    // wait a bit
    await delay(1500);

    // Complete
    res = await fetch(base + `/api/days/${day.id}/complete`, { method: 'POST' });
    console.log('POST /api/days/' + day.id + '/complete =>', res.status);
    try{ const body = await res.json(); console.log('Complete body:', body); } catch(e){ console.log('No JSON body'); }

    console.log('API tests finished');
    process.exit(0);
  } catch (e){
    console.error('Test failed', e);
    process.exit(2);
  }
}

main();
