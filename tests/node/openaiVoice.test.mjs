import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createOpenAIVoice} from '../../public/js/openaiVoice.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(fetchImpl){
 const contexts=[];
 class Context {
  constructor(){this.currentTime=0;this.destination={};this.sources=[];contexts.push(this);}
  async resume(){} async decodeAudioData(){return {duration:5};}
  createBufferSource(){const node={playbackRate:{value:1},connect(){},disconnect(){},start(...args){this.args=args;},stop(){this.stopped=true;this.onended?.();}};this.sources.push(node);return node;}
 }
 globalThis.window={AudioContext:Context};globalThis.fetch=fetchImpl;
 return contexts;
}
const audio=()=>new Response(new Uint8Array([1,2,3]));
test('OpenAI playback resumes from its paused offset, caches a line and settles on cancel',async()=>{
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch;
 try{
  let calls=0;const contexts=harness(async()=>{calls++;return audio();});
  const voice=createOpenAIVoice();voice.prepare({}, {token:'session'});
  const speaking=voice.speak('founder','line',1.5,'b1');await tick();
  const context=contexts[0];assert.equal(context.sources.length,1);context.currentTime=1;voice.pause();assert.equal(context.sources[0].stopped,true);
  voice.resume();await tick();assert.equal(context.sources[1].args[1],1.5);
  voice.cancel();await speaking;
  const replay=voice.speak('founder','line',1,'b1');await tick();voice.cancel();await replay;assert.equal(calls,1);
 }finally{globalThis.window=originalWindow;globalThis.fetch=originalFetch;}
});
test('paused pending speech never starts until resumed; stale requests cannot speak after cancel',async()=>{
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch;
 try{
  let deliver;const contexts=harness(()=>new Promise(resolve=>deliver=resolve));const voice=createOpenAIVoice();voice.prepare({}, {token:'session'});
  const pending=voice.speak('founder','line',1,'b1');await tick();voice.pause();deliver(audio());await tick();assert.equal(contexts[0].sources.length,0);voice.resume();await tick();assert.equal(contexts[0].sources.length,1);voice.cancel();await pending;
  const cancelled=voice.speak('rex','other',1,'b2');await tick();voice.cancel();await cancelled;deliver(audio());await tick();assert.equal(contexts[0].sources.length,1);
 }finally{globalThis.window=originalWindow;globalThis.fetch=originalFetch;}
});
test('failed speech reports an error and releases the playback promise',async()=>{
 const originalWindow=globalThis.window,originalFetch=globalThis.fetch;
 try{
  const contexts=harness(async()=>new Response(JSON.stringify({detail:'Quota reached'}),{status:429}));const errors=[];const voice=createOpenAIVoice({onError:message=>errors.push(message)});voice.prepare({}, {token:'session'});
  await voice.speak('founder','line',1,'b1');assert.deepEqual(errors,['Quota reached']);assert.equal(contexts[0].sources.length,0);
 }finally{globalThis.window=originalWindow;globalThis.fetch=originalFetch;}
});
