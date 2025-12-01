// scripts/test-db.js
// Directly tests the DB adapter: getDays, startDay, completeDay
(async ()=>{
  const db = require('../lib/db');
  try{
    const days = await db.getDays();
    console.log('Days count:', days.length);
    if (!days || days.length === 0){
      console.log('No days found — creating one');
      const d = await db.addDay('Teste DB','migração DB');
      console.log('Created day:', d);
      days.push(d);
    }
    const day = days[0];
    console.log('Using day id', day.id);
    const started = await db.startDay(day.id);
    console.log('startDay result:', started);
    const completed = await db.completeDay(day.id);
    console.log('completeDay result:', completed);
    process.exit(0);
  } catch (e){ console.error('DB test failed', e); process.exit(2); }
})();
