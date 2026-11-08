import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLiveEpisode, ACTOR_PROVIDERS } from '../../src/lib/liveEpisode.js';
import { resolvePitch, assertEpisodeConsistency } from '../../src/lib/scriptedEngine.js';
import { createAnthropicClient } from '../../src/lib/anthropic/client.js';
import { createLiveProviders, IDEA_SCHEMA } from '../../src/lib/openai/providers.js';
import { scriptedClients } from '../fixtures/liveCast.mjs';
const pitch = resolvePitch({ pitchId: 'barklight' });

test('all six actors use their assigned provider and receive the shared transcript', async () => {
 const clients = scriptedClients();
 const episode = await createLiveEpisode(pitch, 1, clients);
 assert.equal(episode.provider, 'multi-model');
 assert.deepEqual(episode.sharks.map(s => s.displayName), ['Kevin O’Leary','Lori Greiner','Daymond John','Barbara Corcoran','Mark Cuban']);
 assert.equal(new Set(clients.calls.map(c => c.input.actorId)).size, 6);
 for (const call of clients.calls) assert.equal(call.provider, ACTOR_PROVIDERS[call.input.actorId]);
 const answer = clients.calls.find(c => c.name === 'answer');
 assert.equal(answer.input.transcript.at(-1).speakerId, 'rex');
 assert.match(answer.input.transcript.at(-1).text, /reach customers/);
 assert.equal(episode.result.offer.cashUsd, 200000);
 assert.equal(episode.result.offer.equityPct, 20);
 assert.deepEqual(episode.result.sharkIds, ['rex']);
 assertEpisodeConsistency(episode);
});
for (const scenario of [
 { decision:'out',outcome:'no_deal' }, { choice:'decline',outcome:'no_deal' },
 { choice:'counter',response:'accept',equity:15 }, { choice:'counter',response:'revise',equity:17.5 },
 { choice:'counter',response:'out',equity:20 }, { choice:'counter',rejectFinal:true,outcome:'no_deal' },
]) test(`scripted provider negotiation ${JSON.stringify(scenario)}`, async () => {
 const episode = await createLiveEpisode(pitch, 1, scriptedClients(scenario));
 assert.equal(episode.result.outcome, scenario.outcome || 'deal');
 if (scenario.equity) assert.equal(episode.result.offer.equityPct, scenario.equity);
 if (scenario.choice === 'decline') assert.equal(episode.result.declinedFrom.length,5);
 if (scenario.response === 'out') assert.deepEqual(episode.result.sharkIds,['luna']);
 assert.equal(episode.beats.filter(b => b.effects.some(e => ['deal','no_deal'].includes(e.type))).length,1);
 assertEpisodeConsistency(episode);
});
test('invalid choices, invented terms and unavailable investors fail instead of falling back', async () => {
 for (const bad of [
  { action:'accept',sharkId:'rex',offer:{cashUsd:1,equityPct:20},reason:'yes' },
  { action:'accept',sharkId:'rex',offer:{cashUsd:300000,equityPct:20},reason:'yes' },
  { action:'accept',sharkId:'missing',offer:{cashUsd:200000,equityPct:20},reason:'yes' },
  { action:'decline',sharkId:'rex',offer:null,reason:'no' },
 ]) {
  const clients=scriptedClients();const json=clients.openai.json.bind(clients.openai);
  clients.openai.json=async request=>request.name==='choice'?{data:bad}:json(request);
  await assert.rejects(createLiveEpisode(pitch,1,clients), /Invalid|inconsistent/);
 }
});
test('missing Anthropic fails before any paid OpenAI pitch request', async () => {
 let calls=0;const openai={json:async()=>{calls++;throw new Error('must not run');}};
 const providers=createLiveProviders(openai,createAnthropicClient());
 await assert.rejects(providers.episodeProvider.createEpisode({idea:'New startup',seed:1}), /Anthropic is not configured/);
 assert.equal(calls,0);
});
test('Claude uses direct Anthropic Messages with schema constraints validated locally',async()=>{
 let sent;
 const client=createAnthropicClient({apiKey:'test-only-secret',fetchImpl:async(url,options)=>{sent={url,...options};return new Response(JSON.stringify({model:'claude-sonnet-5-5',stop_reason:'end_turn',content:[{type:'thinking',thinking:'ignored'},{type:'text',text:JSON.stringify({idea:'Local fixture'})}]}));}});
 const result=await client.json({schema:IDEA_SCHEMA,system:'invent',input:{theme:'products'}});
 const body=JSON.parse(sent.body);
 assert.equal(sent.url,'https://api.anthropic.com/v1/messages');assert.equal(body.model,'claude-sonnet-5-5');
 assert.equal(body.output_config.effort,'medium');assert.equal(body.output_config.format.type,'json_schema');
 assert.equal(body.output_config.format.schema.properties.idea.maxLength,undefined);
 assert.match(body.output_config.format.schema.properties.idea.description,/maxLength: 140/);
 assert.equal(result.metadata.provider,'anthropic');assert.equal(JSON.stringify(result).includes('test-only-secret'),false);
});
test('Claude rejects refusals, truncation, invalid schemas and provider failures without leaking bodies',async()=>{
 for(const reply of [new Response('test-only-secret',{status:401}),new Response('test-only-secret',{status:429}),new Response('test-only-secret',{status:500}),new Response('not json'),...['refusal','max_tokens','end_turn'].map(stop_reason=>new Response(JSON.stringify({stop_reason,content:[{type:'text',text:JSON.stringify({idea:'x'.repeat(141)})}]})))]){
  const client=createAnthropicClient({apiKey:'test-only-secret',fetchImpl:async()=>reply});
  await assert.rejects(client.json({schema:IDEA_SCHEMA,system:'x',input:{}}),e=>!e.message.includes('test-only-secret'));
 }
});
test('test process blocks real external model requests',()=>{
 assert.throws(()=>fetch('https://api.openai.com/v1/responses'),/Offline tests prohibit/);
 assert.throws(()=>fetch('https://api.anthropic.com/v1/messages'),/Offline tests prohibit/);
});
