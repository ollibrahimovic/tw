import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = await readFile(path.join(root, '.env.local'), 'utf8')
const key = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim()
if (!key) throw new Error('ELEVENLABS_API_KEY fehlt in .env.local')

const voiceId = 'pNInz6obpgDQGcFmaJgB'
const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
  method: 'POST',
  headers: { 'xi-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({
    text: 'SPORT FREI!',
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: .32,
      similarity_boost: .8,
      style: .7,
      use_speaker_boost: true,
    },
  }),
})
if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`)
await mkdir(path.join(root, 'public', 'audio'), { recursive: true })
await writeFile(path.join(root, 'public', 'audio', 'sport-frei.mp3'), Buffer.from(await response.arrayBuffer()))
console.log('Saved public/audio/sport-frei.mp3')
