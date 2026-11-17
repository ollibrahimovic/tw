import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = await readFile(path.join(root, '.env.local'), 'utf8')
const key = env.match(/^ELEVENLABS_API_KEY=(.+)$/m)?.[1]?.trim()
if (!key) throw new Error('ELEVENLABS_API_KEY fehlt in .env.local')

const response = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
  method: 'POST',
  headers: { 'xi-api-key': key, 'content-type': 'application/json' },
  body: JSON.stringify({
    text: 'Short energetic football terrace fan chant at match kickoff, many supporters chanting a simple rhythmic non-verbal oh-oh-oh melody together, clapping, stadium reverb, authentic German football atmosphere, no instruments, no announcer, no intelligible words',
    duration_seconds: 5,
    prompt_influence: .8,
    model_id: 'eleven_text_to_sound_v3',
  }),
})
if (!response.ok) throw new Error(`ElevenLabs ${response.status}: ${await response.text()}`)
await mkdir(path.join(root, 'public', 'audio'), { recursive: true })
await writeFile(path.join(root, 'public', 'audio', 'chant.mp3'), Buffer.from(await response.arrayBuffer()))
console.log('Saved public/audio/chant.mp3')
