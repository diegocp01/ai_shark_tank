import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOpenAIClient, AIError } from '../../src/lib/openai/client.js';
import { createLiveProviders, PITCH_SCHEMA, IDEA_SCHEMA } from '../../src/lib/openai/providers.js';
import { createSpeechService, CAST_VOICES } from '../../src/lib/openai/speech.js';
import { createEpisode, resolvePitch } from '../../src/lib/scriptedEngine.js';
import { createPitchDeck } from '../../src/lib/pitchDeck.js';
import { createApp } from '../../server.js';
import request from 'supertest';

const response = data => new Response(JSON.stringify({status:'completed',model:'gpt-6.1-sol',service_tier:'ultrafast',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data)}]}]}),{headers:{'Content-Type':'application/json'}});
test('generation uses exact requested model, reasoning and tier with strict schema',async()=>{
 let sent;
 const client=createOpenAIClient({apiKey:'test-secret',fetchImpl:async(url,options)=>{sent={url,...options};return response({idea:'A shared freezer service for apartment buildings'});}});
 const result=await client.json({name:'idea',schema:IDEA_SCHEMA,system:'Invent',input:{theme:'renters'}});
 const body=JSON.parse(sent.body);
 assert.equal(sent.url,'https://api.openai.com/v1/responses');assert.equal(body.model,'gpt-6.1-sol');assert.deepEqual(body.reasoning,{effort:'medium'});assert.equal(body.service_tier,'ultrafast');assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(result.metadata.servedTier,'ultrafast');assert.equal(JSON.stringify(result).includes('test-secret'),false);
});
test('API errors, refusals and malformed results cannot silently fall back or leak provider bodies',async()=>{
 for(const reply of [new Response('{"error":"test-secret"}',{status:401}),new Response('{}',{status:429}),new Response('{}',{status:400}),new Response(JSON.stringify({status:'incomplete'})),response({idea:5}),new Response(JSON.stringify({status:'completed',output:[{content:[{type:'refusal',refusal:'no'}]}]}))]){
  const client=createOpenAIClient({apiKey:'test-secret',fetchImpl:async()=>reply});
  await assert.rejects(client.json({name:'idea',schema:IDEA_SCHEMA,system:'x',input:{}}),e=>e instanceof AIError&&!e.message.includes('test-secret'));
 }
});
test('live authored custom pitch feeds the existing episode and HTML provider contract',async()=>{
 const pitch=resolvePitch({pitchId:'barklight'});const data=Object.fromEntries(Object.keys(PITCH_SCHEMA.properties).map(key=>[key,pitch[key]]));
 const client={settings:{},json:async({name,input})=>({metadata:{model:'gpt-6.1-sol',servedTier:'ultrafast'},data:name==='founder_pitch'?data:{title:'Live deck',slides:[{title:'Start',beatId:input.beats[0].id,html:'<h1>Generated HTML</h1><script>bad()</script>'}]}})};
 const providers=createLiveProviders(client);const episode=await providers.episodeProvider.createEpisode({idea:'A brighter dog collar',seed:1});
 assert.equal(episode.pitch.startupName,pitch.startupName);assert.equal(episode.provider,'openai-pitch');assert.match(episode.beats[2].text,/dog/);assert.equal(episode.generation.servedTier,'ultrafast');
 const deck=await createPitchDeck(episode,providers.deckProvider);assert.equal(deck.provider.id,'openai-html');assert.equal(deck.slides[0].html,'<h1>Generated HTML</h1>');assert.equal(deck.generation.servedTier,'ultrafast');
});
test('seven distinct server-owned voices, bounded sessions and deduplicated audio',async()=>{
 assert.equal(new Set(Object.values(CAST_VOICES).map(v=>v.voice)).size,7);
 let calls=0,resolve,now=1000;const client={speech:async()=>{calls++;return new Promise(r=>resolve=r);}};
 const service=createSpeechService(client,{now:()=>now});const episode=createEpisode({pitchId:'barklight'});const {token}=service.register(episode);
 await assert.rejects(service.audio('wrong',episode.beats[0].id),e=>e.status===410);
 await assert.rejects(service.audio(token,'missing'),e=>e.status===400);
 const first=service.audio(token,episode.beats[0].id),second=service.audio(token,episode.beats[0].id);assert.equal(calls,1);resolve(Buffer.from('audio'));
 assert.deepEqual(await first,await second);await service.audio(token,episode.beats[0].id);assert.equal(calls,1);
 now+=3*60*60*1000;await assert.rejects(service.audio(token,episode.beats[0].id),e=>e.status===410);
});
test('speech failure is retryable and the endpoint rejects cross-site spending',async()=>{
 let calls=0;const service=createSpeechService({speech:async()=>{calls++;if(calls===1)throw new AIError('Unavailable');return Buffer.from('audio');}});
 const episode=createEpisode({pitchId:'barklight'});const {token}=service.register(episode);
 await assert.rejects(service.audio(token,episode.beats[0].id));await service.audio(token,episode.beats[0].id);assert.equal(calls,2);
 const app=createApp({speechService:service,generateIdea:async()=>({idea:'A useful thing'})});
 await request(app).post('/api/ideas').set('Origin','https://foreign.example').send({}).expect(403);
 await request(app).post('/api/speech').send({text:'arbitrary paid text'}).expect(400);
 const audio=await request(app).post('/api/speech').send({token,beatId:episode.beats[0].id}).expect(200);
 assert.match(audio.headers['content-type'],/audio\/mpeg/);assert.equal(calls,2);
});
