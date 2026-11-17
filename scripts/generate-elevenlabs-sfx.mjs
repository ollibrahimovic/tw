import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = await readFile(path.join(root, '.env.local'), 'utf8')
const key = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim()
if (!key) throw new Error('ELEVENLABS_API_KEY fehlt in .env.local')

const sounds = {
  hit: {
    file: 'hit.mp3',
    text: 'Short realistic impact of a heavy punch landing on a padded jacket, gritty football hooligan fight game, sharp transient, no music, no voice',
    duration_seconds: 0.6,
  },
  rocket: {
    file: 'rocket.mp3',
    text: 'Short realistic flare rocket launching and streaking through smoky night air, rough stadium atmosphere, explosive whoosh, no music, no voice',
    duration_seconds: 1.2,
  },
  spawn: {
    file: 'spawn.mp3',
    text: 'Short energetic crowd surge and boots hitting concrete as a group of football supporters rushes onto a terrace, gritty realistic game sound, no music, no voice',
    duration_seconds: 1,
  },
  impact: {
    file: 'impact.mp3',
    text: 'Short heavy explosive impact with a wooden kiosk breaking and metal rattling, realistic football terrace game sound, no music, no voice',
    duration_seconds: 1.2,
  },
  collapse: {
    file: 'collapse.mp3',
    text: 'Short dramatic collapse of a battered small stadium beer stand, wood cracking, bottles rattling, dust and crowd reaction, realistic, no music, no voice',
    duration_seconds: 1.8,
  },
  countdown: {
    file: 'countdown.mp3',
    text: 'Short tense stadium countdown horn hit with a deep sub impact and distant crowd, suitable for a football match start, no spoken words, no music',
    duration_seconds: 0.8,
  },
  victory: {
    file: 'victory.mp3',
    text: 'Short euphoric football terrace victory celebration, crowd roar, clapping and distant flares, realistic stadium atmosphere, no spoken words, no music',
    duration_seconds: 2.5,
  },
  defeat: {
    file: 'defeat.mp3',
    text: 'Short disappointed football terrace crowd reaction, low groan and fading stadium ambience, realistic, no spoken words, no music',
    duration_seconds: 2,
  },
}

const output = path.join(root, 'public', 'audio')
await mkdir(output, { recursive: true })

for (const [name, sound] of Object.entries(sounds)) {
  console.log(`Generating ${name}...`)
  const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: sound.text,
      duration_seconds: sound.duration_seconds,
      prompt_influence: .75,
      model_id: 'eleven_text_to_sound_v3',
    }),
  })
  if (!response.ok) {
    throw new Error(`${name}: ElevenLabs ${response.status}: ${await response.text()}`)
  }
  await writeFile(path.join(output, sound.file), Buffer.from(await response.arrayBuffer()))
  console.log(`Saved ${sound.file}`)
}
