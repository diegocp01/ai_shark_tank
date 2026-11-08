import dotenv from 'dotenv';
import {writeFile} from 'node:fs/promises';
import {createOpenAIClient} from '../../src/lib/openai/client.js';
import {createLiveProviders} from '../../src/lib/openai/providers.js';
import {CAST_VOICES} from '../../src/lib/openai/speech.js';
import {createPitchDeck} from '../../src/lib/pitchDeck.js';
dotenv.config({path:'.env.local',quiet:true});
const client=createOpenAIClient({apiKey:process.env.OPENAI_API_KEY});
const providers=createLiveProviders(client);
try{
 const episode=await providers.episodeProvider.createEpisode({idea:'ClosetLift: No-drill storage towers for apartment renters, installed and moved to their next home.',seed:1});
 console.log(JSON.stringify({stage:'pitch',name:episode.pitch.startupName,generation:episode.generation}));
 const deck=await createPitchDeck(episode,providers.deckProvider);
 await writeFile('review/openai/generated-show.json',JSON.stringify({episode,deck},null,2)+'\n');
 await writeFile('review/openai/generated-deck.html',deck.download.content);
 console.log(JSON.stringify({stage:'deck',slides:deck.slides.length,generation:deck.generation}));
 const voices=[];
 for(const [speaker,{voice,direction}] of Object.entries(CAST_VOICES)){
  const audio=await client.speech({text:speaker==='founder'?"Hi, Sharks. I'm building a better way for renters to make room at home.":"Welcome to the tank. Tell us what makes your business worth investing in.",voice,instructions:direction});
  await writeFile(`review/openai/${speaker}.mp3`,audio);
  voices.push({speaker,voice,bytes:audio.length});
 }
 await writeFile('review/openai/live-check.json',JSON.stringify({pitch:episode.generation,deck:deck.generation,voices},null,2)+'\n');
 console.log(JSON.stringify({stage:'voices',voices}));
}catch(error){console.error(JSON.stringify({error:error.message,status:error.status}));process.exitCode=1;}
