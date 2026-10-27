import assert from 'node:assert/strict';
import { test } from 'node:test';
const base=process.env.MENTAPP_TEST_BASE||'http://127.0.0.1:3000';
async function call(path:string,body?:unknown,origin=base){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Origin:origin},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};}
test('shared API lifecycle, concurrent voters, isolation, and validation',async()=>{
 const create=()=>call('/api/hangouts',{title:'API verification',description:'Local integration test',timezone:'America/Toronto',dates:['2026-11-20T18:30','2026-11-21T19:00'],places:['Cafe','Park']});
 const a=await create(),b=await create();assert.equal(a.status,201);assert.equal(b.status,201);
 const route=`/api/hangouts/${a.body.token}`, options=a.body.hangout.options;
 const results=await Promise.all(Array.from({length:12},(_,i)=>call(route,{type:'vote',name:`Test friend ${i}`,optionId:options[0].id,value:'yes'})));
 assert.ok(results.every(r=>r.status===200));
 const state=(await call(route)).body;assert.equal(state.participants.length,12);assert.ok(state.participants.every((p:any)=>p.votes[options[0].id]==='yes'));
 assert.equal((await call(route,{type:'vote',name:'Test friend 0',optionId:options[0].id,value:'maybe'})).status,200);
 assert.equal((await call(route)).body.participants.length,12);
 assert.equal((await call(route,{type:'vote',name:'Other',optionId:b.body.hangout.options[0].id,value:'yes'})).status,400);
 assert.equal((await call(`/api/hangouts/${'0'.repeat(64)}`)).status,404);
 assert.equal((await call('/api/hangouts/invalid')).status,404);
 assert.equal((await call(route,{type:'comment',name:'A',body:'hello'},'https://unrelated.example')).status,403);
 assert.equal((await call(route,{type:'finalize',dateId:options[0].id,placeId:options[2].id})).status,200);
 await call(route,{type:'rsvp',name:'Test friend 0',value:'going'});
 const calendar=await fetch(base+route+'/calendar');assert.equal(calendar.status,200);assert.match(await calendar.text(),/BEGIN:VCALENDAR/);
 await call(route,{type:'reopen'});await call(route,{type:'finalize',dateId:options[1].id,placeId:options[2].id});
 const updated=(await call(route)).body;assert.notEqual(updated.participants[0].rsvpRevision,updated.revision);
 const comment=await call(route,{type:'comment',name:'A',body:'Hello everyone'});assert.equal(comment.body.comments.length,1);
 await call(route,{type:'deleteComment',id:comment.body.comments[0].id});assert.equal((await call(route)).body.comments.length,0);
 await call(route,{type:'cancel'});assert.equal((await call(route,{type:'edit',title:'No',description:''})).status,400);
 assert.equal((await call(`/api/hangouts/${b.body.token}`)).body.status,'planning');
});
