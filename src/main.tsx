import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import QRCode from 'qrcode'
import { Eye, EyeOff, Flame, Heart, Pause, Play, RotateCcw, Shield, Swords, Trophy, Volume2, VolumeX, Zap } from 'lucide-react'
import { canDeploy, cards, deploy, deploymentPoint, newGame, SUDDEN_DEATH_DURATION, tick } from './game'
import { Fan, Fanmarsch, Flitzer } from './Arena'
import { PhaserArena } from './PhaserArena'
import type { Card, Game, Side } from './game'
import './styles.css'
import './figures.css'
import './app.css'
import './derby.css'
import './feedback.css'
import './menu-overrides.css'
import './replay.css'

const APP_VERSION = '0.22'
document.title = 'Terrace Wars — Block gegen Block.'
const loadingMessages = [
  'Fäuste werden bandagiert',
  'Zahnschutz wird angelegt',
  'Bengalos werden ausgepackt',
]

function loadDeck(): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('terrace-deck') || 'null')
    if (Array.isArray(value)) {
      const valid = [...new Set(value.filter(v =>
        Number.isInteger(v) && v >= 0 && v < cards.length && !cards[v as number].hidden,
      ) as number[])]
      if (valid.length >= 8) return valid.slice(0, 8)
    }
  } catch { /* Default deck when storage is unavailable. */ }
  return cards.slice(0, 8).map((_, i) => i)
}

function multiplayerHealthUrl() {
  const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const renderDefault = window.location.hostname.endsWith('.onrender.com') ? 'wss://terrace-wars-multiplayer.onrender.com' : ''
  const endpoint = import.meta.env.VITE_MULTIPLAYER_URL ||
    (local ? `ws://${window.location.hostname}:8787` : renderDefault || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`)
  return `${endpoint.replace(/^ws/, 'http').replace(/\/$/, '')}/health`
}

function multiplayerSocketUrl() {
  return multiplayerHealthUrl().replace(/\/health$/, '').replace(/^http/, 'ws')
}

function checkMultiplayerSocket(signal: AbortSignal) {
  return new Promise<boolean>(resolve => {
    if (signal.aborted) { resolve(false); return }
    const socket = new WebSocket(multiplayerSocketUrl())
    let settled = false
    const timeout = window.setTimeout(() => finish(false), 60000)
    const finish = (online: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      socket.close()
      resolve(online)
    }
    socket.onopen = () => finish(true)
    socket.onerror = () => finish(false)
    socket.onclose = () => finish(false)
    signal.addEventListener('abort', () => finish(false), { once: true })
  })
}

function App() {
  const [deck, setDeck] = useState(loadDeck)
  const [replaceSlot, setReplaceSlot] = useState<number | null>(null)
  const preview = new URLSearchParams(window.location.search).get('preview')
  const initialMatch = new URLSearchParams(window.location.search).get('match')
  const [game, setGame] = useState(() => {
    const initial = newGame(deck)
    if (preview === 'win') initial.result = 'DERBYSIEG!'
    if (preview === 'draw') initial.result = 'UNENTSCHIEDEN'
    if (preview === 'loss') initial.result = 'NIEDERLAGE'
    return initial
  })
  const [page, setPage] = useState<'menu' | 'arena' | 'deck'>(preview ? 'arena' : initialMatch ? 'deck' : 'menu')
  const [running, setRunning] = useState(false)
  const [countdown, setCountdown] = useState<number | 'go' | null>(null)
  const [arenaReady, setArenaReady] = useState(false)
  const [loadingActive, setLoadingActive] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [replayActive, setReplayActive] = useState(false)
  const [replayFocus, setReplayFocus] = useState<{ x: number; y: number } | null>(null)
  const [replayFrames, setReplayFrames] = useState<Game[]>([])
  const [replayFrame, setReplayFrame] = useState<Game | null>(null)
  const [onlineMode, setOnlineMode] = useState<'create' | 'join' | 'matchmake' | null>(initialMatch ? 'join' : null)
  const [onlineStatus, setOnlineStatus] = useState<'offline' | 'connecting' | 'waiting' | 'playing'>('offline')
  const [latency, setLatency] = useState<number | null>(null)
  const [onlineRole, setOnlineRole] = useState<Side>('blue')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteQr, setInviteQr] = useState('')
  const [onlineMessage, setOnlineMessage] = useState('')
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [selected, setSelected] = useState(0)
  const [sound, setSound] = useState(true)
  const [showUnitStates, setShowUnitStates] = useState(false)
  const [message, setMessage] = useState('')
  const [tutorial, setTutorial] = useState(() => {
    try { return localStorage.getItem('terrace-tutorial-seen') !== '1' } catch { return true }
  })
  const [draggingCard, setDraggingCard] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const networkTiming = useRef<{ serverTick: number; serverTime: number; clockOffset: number } | null>(null)
  const networkCurrentSnapshot = useRef<{ game: Game; timing: { serverTick: number; serverTime: number; clockOffset: number } } | null>(null)
  const networkPreviousSnapshot = useRef<{ game: Game; timing: { serverTick: number; serverTime: number; clockOffset: number } } | null>(null)
  const lastServerTick = useRef(-1)
  const audio = useRef<AudioContext | null>(null)
  const audioClips = useRef<Record<string, HTMLAudioElement>>({})
  const backgroundMusic = useRef<HTMLAudioElement | null>(null)
  const dragged = useRef<number | null>(null)
  const deckDragSlot = useRef<number | null>(null)
  const lastShot = useRef(0)
  const lastResult = useRef<string | null>(null)
  const seenSpellIds = useRef(new Set<number>())
  const seenFlareIds = useRef(new Set<number>())
  const seenPuddleIds = useRef(new Set<number>())
  const seenImpactIds = useRef(new Set<number>())
  const replayHistory = useRef<Game[]>([])
  const hasDrummer = game.units.some(unit => unit.card.name === 'Der Trommler' && (unit.spawnDelay ?? 0) <= 0 && unit.hp > 0)
  const arenaGame = replayActive && replayFrame ? replayFrame : game
  const previousStructureIds = useRef(new Set<number>())
  const previousBuildingHp = useRef({ ...game.hp })
  const buildingHp = onlineRole === 'blue' ? game.hp : {
    blueFortress: game.hp.redFortress, redFortress: game.hp.blueFortress,
    bluePubOne: game.hp.redPubOne, bluePubTwo: game.hp.redPubTwo,
    redPubOne: game.hp.bluePubOne, redPubTwo: game.hp.bluePubTwo,
  }
  const myQueue = onlineRole === 'red' ? game.redQueue : game.queue
  const hype = onlineRole === 'red' ? game.redHype : game.hype
  const selectedCard = cards[myQueue[selected]]
  const nextCard = cards[myQueue[4]]
  const hypePercent = Math.round(hype * 10)
  const time = game.overtime > 0
    ? Math.max(0, Math.ceil(SUDDEN_DEATH_DURATION - game.overtime))
    : Math.ceil(game.time)
  const formattedTime = `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
  const suddenDeath = game.overtime > 0
  const blueScore = Number(buildingHp.redPubOne <= 0) + Number(buildingHp.redPubTwo <= 0)
  const redScore = Number(buildingHp.bluePubOne <= 0) + Number(buildingHp.bluePubTwo <= 0)
  const matchDuration = game.overtime > 0 ? 180 + game.overtime : Math.max(0, 180 - game.time)
  const formattedMatchDuration = `${Math.floor(matchDuration / 60).toString().padStart(2, '0')}:${Math.floor(matchDuration % 60).toString().padStart(2, '0')}`

  useEffect(() => {
    if (page !== 'arena') return
    return () => {
      const connection = socket.current
      socket.current = null
      connection?.close()
    }
  }, [page])
  useEffect(() => {
    if (page !== 'arena') setArenaReady(false)
  }, [page])

  useEffect(() => {
    if (page !== 'menu') return
    const controller = new AbortController()
    setServerStatus('checking')
    void checkMultiplayerSocket(controller.signal).then(online => {
      if (!controller.signal.aborted) setServerStatus(online ? 'online' : 'offline')
    })
    return () => controller.abort()
  }, [page])

  useEffect(() => {
    const endCardDrag = (event: PointerEvent) => {
      if (!draggingCard) return
      const target = event.target as HTMLElement | null
      const insideArena = target?.closest('.arena')
      if (event.type === 'pointercancel' || !insideArena) {
        dragged.current = null
        setDraggingCard(false)
      }
    }
    window.addEventListener('pointerup', endCardDrag)
    window.addEventListener('pointercancel', endCardDrag)
    return () => {
      window.removeEventListener('pointerup', endCardDrag)
      window.removeEventListener('pointercancel', endCardDrag)
    }
  }, [draggingCard])

  function playClip(name: string, volume = .65) {
    if (!sound) return false
    const clip = audioClips.current[name] ?? (audioClips.current[name] = new Audio(`/audio/${name}.mp3?v=${APP_VERSION}`))
    clip.muted = false
    clip.volume = volume
    clip.currentTime = 0
    void clip.play().catch(() => {})
    return true
  }
  function primeAudio() {
    for (const name of ['countdown', 'beer-splash', 'bengalo-impact', 'drum-hit']) {
      const clip = audioClips.current[name] ?? (audioClips.current[name] = new Audio(`/audio/${name}.mp3?v=${APP_VERSION}`))
      clip.preload = 'auto'
      clip.load()
      clip.muted = true
      void clip.play().then(() => {
        clip.pause()
        clip.currentTime = 0
        clip.muted = false
      }).catch(() => {})
    }
    const track = backgroundMusic.current ?? (backgroundMusic.current = new Audio('/audio/arena-theme.mp3'))
    track.preload = 'auto'
    track.load()
  }
  function rocketSound() {
    playClip('rocket', .55)
  }
  function spawnSound() {
    playClip('spawn', .5)
  }
  function impactSound() {
    playClip('impact', .7)
  }
  function collapseSound() {
    playClip('collapse', .75)
  }
  useEffect(() => {
    if (!running || page !== 'arena' || game.result || onlineStatus === 'playing') return
    const id = window.setInterval(() => setGame(g => tick(g, .05)), 50)
    return () => clearInterval(id)
  }, [running, page, game.result, onlineStatus])
  useEffect(() => {
    if (game.shots > lastShot.current) {
      playClip('hit', .32)
    }
    lastShot.current = game.shots
  }, [game.shots])
  useEffect(() => {
    if (!hasDrummer || !running || page !== 'arena' || game.result) return
    playClip('drum-hit', .26)
    const id = window.setInterval(() => playClip('drum-hit', .26), 1400)
    return () => window.clearInterval(id)
  }, [hasDrummer, running, page, game.result])
  useEffect(() => {
    for (const puddle of game.puddles) {
      if (seenPuddleIds.current.has(puddle.id)) continue
      seenPuddleIds.current.add(puddle.id)
      playClip('beer-splash', .48)
    }
    for (const flare of game.flares) {
      if (seenFlareIds.current.has(flare.id)) continue
      seenFlareIds.current.add(flare.id)
      rocketSound()
    }
    for (const spell of game.spells) {
      if (seenSpellIds.current.has(spell.id)) continue
      seenSpellIds.current.add(spell.id)
      if (spell.type === 'signal' || spell.type === 'salvo') rocketSound()
      else if (spell.type === 'smoke') playClip('impact', .2)
      else playClip('impact', .2)
    }
    for (const impact of game.impacts) {
      if (seenImpactIds.current.has(impact.id)) continue
      seenImpactIds.current.add(impact.id)
      if (seenFlareIds.current.has(impact.id)) playClip('bengalo-impact', .3)
      else impactSound()
    }
    for (const building of Object.keys(game.hp) as Array<keyof typeof game.hp>) {
      if (previousBuildingHp.current[building] > 0 && game.hp[building] <= 0) collapseSound()
    }
    const currentStructureIds = new Set(game.structures.map(structure => structure.id))
    for (const id of previousStructureIds.current) if (!currentStructureIds.has(id)) collapseSound()
    previousStructureIds.current = currentStructureIds
    previousBuildingHp.current = { ...game.hp }
  }, [game.spells, game.impacts, game.hp])
  useEffect(() => {
    if (page !== 'arena' || replayActive || game.result) return
    const previous = replayHistory.current[replayHistory.current.length - 1]
    if (previous !== game) replayHistory.current.push(game)
    if (replayHistory.current.length > 220) replayHistory.current.shift()
  }, [game, page, replayActive])
  function decisiveReplayFocus() {
    const currentEvent = game.damageEvents[game.damageEvents.length - 1] ?? game.impacts[game.impacts.length - 1]
    if (currentEvent) return { x: currentEvent.x, y: currentEvent.y }
    for (let i = replayHistory.current.length - 1; i >= 0; i--) {
      const frame = replayHistory.current[i]
      const event = frame.damageEvents[frame.damageEvents.length - 1] ?? frame.impacts[frame.impacts.length - 1]
      if (event) return { x: event.x, y: event.y }
    }
    return { x: 50, y: 50 }
  }
  useEffect(() => {
    if (game.result && game.result !== lastResult.current) {
      const resultClip = game.result === 'DERBYSIEG!' ? 'victory' : 'defeat'
      playClip(resultClip, .8)
       setReplayFocus(decisiveReplayFocus())
      const frames = replayHistory.current.length > 1
        ? replayHistory.current.slice(-100)
        : [game]
      setReplayFrames(frames)
      setReplayFrame(frames[0])
      setReplayActive(frames.length > 1)
      lastResult.current = game.result
    }
    lastResult.current = game.result
  }, [game.result])
  useEffect(() => {
    if (!replayActive || replayFrames.length < 2) return
    let index = 0
    const frameInterval = Math.max(20, Math.round(10000 / (replayFrames.length - 1)))
    const id = window.setInterval(() => {
      index += 1
      if (index >= replayFrames.length) {
        setReplayActive(false)
        return
      }
      setReplayFrame(replayFrames[index])
    }, frameInterval)
    return () => window.clearInterval(id)
  }, [replayActive, replayFrames])
  function replayDecisiveScene() {
    setReplayFocus(decisiveReplayFocus())
    const frames = replayHistory.current.length > 1 ? replayHistory.current.slice(-100) : [game]
    setReplayFrames(frames)
    setReplayFrame(frames[0])
    setReplayActive(true)
  }
  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => setMessage(''), 2200)
    return () => clearTimeout(id)
  }, [message])
  useEffect(() => {
    if (countdown === null || !arenaReady) return
    if (countdown === 'go') {
      const id = window.setTimeout(() => {
        setCountdown(null)
        setRunning(true)
      }, 650)
      return () => clearTimeout(id)
    }
    playClip('countdown', countdown === 3 ? .8 : .5)
    const id = window.setTimeout(() => {
      setCountdown(value => {
        if (typeof value !== 'number') return value === 'go' ? 'go' : null
        return value > 1 ? value - 1 : 'go'
      })
    }, 750)
    return () => clearTimeout(id)
  }, [countdown, arenaReady])
  useEffect(() => {
    if (!loadingActive) return
    setLoadingStep(0)
    const id = window.setInterval(() => {
      setLoadingStep(step => (step + 1) % loadingMessages.length)
    }, 850)
    return () => window.clearInterval(id)
  }, [loadingActive])
  useEffect(() => {
    const shouldPlay = sound && page === 'arena' && !game.result && (running || countdown !== null)
    if (!shouldPlay) {
      backgroundMusic.current?.pause()
      return
    }
    const track = backgroundMusic.current ?? (backgroundMusic.current = new Audio('/audio/arena-theme.mp3'))
    track.loop = true
    track.volume = .12
    void track.play().catch(() => {})
    return () => track.pause()
  }, [sound, page, running, game.result, countdown])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (page !== 'arena' || game.result) return
      if ('1234'.includes(event.key)) setSelected(Number(event.key) - 1)
      if (event.code === 'Space') { event.preventDefault(); setRunning(v => !v) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [page, game.result])
  function startOnline() {
    const validDeck = deck.length === 8 &&
      new Set(deck).size === 8 &&
      deck.every(id => Number.isInteger(id) && id >= 0 && id < cards.length && !cards[id].hidden)
    if (!validDeck) {
      setPage('deck')
      setMessage('Wähle genau 8 Karten für dein Deck.')
      return
    }
    if (!audio.current) audio.current = new AudioContext()
    void audio.current.resume()
    primeAudio()
    const freshGame = newGame(deck, deck, true, deck)
    replayHistory.current = []
    setGame(freshGame)
    seenFlareIds.current.clear()
    seenPuddleIds.current.clear()
    setSelected(0)
    setOnlineRole(onlineMode === 'join' ? 'red' : 'blue')
    setRunning(false)
    setCountdown(null)
    setOnlineStatus('connecting')
    setLatency(null)
    setOnlineMessage('')
    setPage('arena')
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const renderDefault = window.location.hostname.endsWith('.onrender.com') ? 'wss://terrace-wars-multiplayer.onrender.com' : ''
    const endpoint = import.meta.env.VITE_MULTIPLAYER_URL || (local
      ? `ws://${window.location.hostname}:8787`
      : renderDefault || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`)
    const connection = new WebSocket(endpoint)
    let assignedSide: Side = 'blue'
    const localResult = (state: Game): Game => assignedSide === 'red' ? {
      ...state,
      result: state.result === 'DERBYSIEG!' ? 'NIEDERLAGE'
        : state.result === 'NIEDERLAGE' ? 'DERBYSIEG!' : state.result,
    } : state
    socket.current?.close()
    socket.current = connection
    let completed = false
    let timeout: number
    let pingTimer: number | undefined
    const fail = (reason: string) => {
      window.clearTimeout(timeout)
      if (pingTimer) window.clearInterval(pingTimer)
      if (socket.current !== connection || completed) return
      completed = true
      setOnlineMessage(reason)
      setRunning(false)
      setCountdown(null)
      setOnlineStatus('connecting')
      connection.close()
    }
    const waitFor = (milliseconds: number, reason: string) => {
      window.clearTimeout(timeout)
      timeout = window.setTimeout(() => fail(reason), milliseconds)
    }
    waitFor(60000, 'Verbindung fehlgeschlagen: Der Multiplayer-Server antwortet nicht. Bitte abbrechen und erneut versuchen.')
    connection.onopen = () => {
      if (socket.current !== connection) return
      pingTimer = window.setInterval(() => {
        if (connection.readyState === WebSocket.OPEN) connection.send(JSON.stringify({ type: 'ping', sentAt: Date.now() }))
      }, 3000)
      waitFor(15000, 'Der Server ist erreichbar, bestätigt die Suche aber nicht. Bitte den Multiplayer-Service auf den aktuellen main-Stand deployen.')
      const code = new URLSearchParams(window.location.search).get('match')
      connection.send(JSON.stringify(onlineMode === 'join' && code
        ? { type: 'join', code, deck }
        : onlineMode === 'matchmake' ? { type: 'matchmake', deck } : { type: 'create', deck }))
    }
    connection.onmessage = event => {
      if (socket.current !== connection || completed) return
       const message = JSON.parse(event.data) as { type: string; state?: Partial<Game>; role?: Side; code?: string; invite?: string; waiting?: boolean; message?: string; reason?: string; sentAt?: number; serverTick?: number; serverTime?: number }
      if (message.type === 'room') {
        waitFor(message.waiting ? 120000 : 15000, message.waiting
          ? 'Innerhalb von zwei Minuten wurde kein Gegner gefunden. Bitte abbrechen und erneut suchen.'
          : 'Der Spielstart wurde vom Server nicht bestätigt. Bitte erneut versuchen.')
        setOnlineRole(message.role || 'blue')
        const invite = message.invite || `/?match=${message.code}`
        const fullInvite = invite.startsWith('http') ? invite : `${window.location.origin}${invite}`
        setInviteLink(fullInvite)
        void QRCode.toDataURL(fullInvite, { width: 180, margin: 1, color: { dark: '#17231b', light: '#e9dda9' } }).then(setInviteQr)
        setOnlineStatus(message.waiting ? 'waiting' : 'connecting')
        return
      }
      if (message.type === 'pong' && typeof message.sentAt === 'number') {
        setLatency(Math.max(0, Date.now() - message.sentAt))
        return
      }
      if (message.type === 'match-start' && message.state) {
        window.clearTimeout(timeout)
        assignedSide = message.role || 'blue'
        if (Number.isFinite(message.serverTick) && Number.isFinite(message.serverTime)) {
          lastServerTick.current = message.serverTick as number
          const timing = {
            serverTick: message.serverTick as number,
            serverTime: message.serverTime as number,
            clockOffset: (message.serverTime as number) - Date.now(),
          }
          networkTiming.current = timing
          networkPreviousSnapshot.current = null
          networkCurrentSnapshot.current = { game: localResult(message.state as Game), timing }
        }
        setOnlineRole(message.role || 'blue')
        setGame(localResult(message.state as Game))
        setOnlineStatus('playing')
        setLoadingStep(0)
        if (arenaReady) {
          setLoadingActive(false)
          setCountdown(3)
        } else {
          setLoadingActive(true)
          setCountdown(null)
        }
        return
      }
       if (message.type === 'state' && message.state) {
         if (Number.isFinite(message.serverTick) && (message.serverTick as number) <= lastServerTick.current) return
         if (Number.isFinite(message.serverTick) && Number.isFinite(message.serverTime)) {
           lastServerTick.current = message.serverTick as number
           const observedOffset = (message.serverTime as number) - Date.now()
           const previousOffset = networkTiming.current?.clockOffset ?? observedOffset
           networkTiming.current = {
             serverTick: message.serverTick as number,
             serverTime: message.serverTime as number,
             clockOffset: previousOffset * .85 + observedOffset * .15,
           }
         }
         const previousGame = networkCurrentSnapshot.current?.game ?? game
         const nextGame = localResult({
           ...previousGame,
           ...message.state,
           log: message.state.log ?? previousGame.log,
         } as Game)
         if (networkTiming.current && Number.isFinite(message.serverTick) && Number.isFinite(message.serverTime)) {
           const timing = networkTiming.current
           const nextTiming = {
             serverTick: message.serverTick as number,
             serverTime: message.serverTime as number,
             clockOffset: timing.clockOffset * .85 + ((message.serverTime as number) - Date.now()) * .15,
           }
           networkPreviousSnapshot.current = networkCurrentSnapshot.current
           networkCurrentSnapshot.current = { game: nextGame, timing: nextTiming }
           networkTiming.current = nextTiming
         }
         setGame(nextGame)
       }
      if (message.type === 'opponent-joined') setOnlineMessage('Gegner ist beigetreten. Derby startet …')
      if (message.type === 'error') fail(message.message || 'Multiplayer-Verbindung fehlgeschlagen.')
      if (message.type === 'room-closed') fail(message.reason || 'Der Gegner hat das Spiel verlassen.')
    }
    connection.onerror = () => fail('Der Multiplayer-Server ist nicht erreichbar. Bitte abbrechen und erneut versuchen.')
    connection.onclose = () => fail('Die Verbindung zum Multiplayer-Server wurde geschlossen. Bitte erneut versuchen.')
  }
  function handleArenaReady() {
    setArenaReady(true)
    if (loadingActive) {
      setLoadingActive(false)
      setCountdown(3)
    }
  }
  function start() {
    if (deck.length !== 8) {
      setPage('deck')
      setMessage('Wähle genau 8 Karten für dein Deck.')
      return
    }
    if (onlineMode) {
      startOnline()
      return
    }
    if (!audio.current) audio.current = new AudioContext()
    void audio.current.resume()
    primeAudio()
    const freshGame = newGame(deck)
    replayHistory.current = []
    setOnlineRole('blue')
    seenSpellIds.current.clear()
    seenImpactIds.current.clear()
    previousStructureIds.current.clear()
    previousBuildingHp.current = { ...freshGame.hp }
    setLoadingStep(0)
    setLoadingActive(!arenaReady)
    setGame(freshGame); setSelected(0); setRunning(false); setCountdown(arenaReady ? 3 : null); setPage('arena')
    seenFlareIds.current.clear()
    seenPuddleIds.current.clear()
  }
  function place(x: number, y: number, slot = selected) {
    if (!running || game.result || onlineStatus === 'waiting' || onlineStatus === 'connecting') return
    const card = cards[myQueue[slot]]
    const p = deploymentPoint(game, card, x, y, onlineRole)
    if (!canDeploy(game, card, p.x, p.y, onlineRole)) { setMessage(card.kind === 'spell' ? 'Zauber müssen auf dem Spielfeld landen.' : 'Diese Lane ist noch nicht freigeschaltet.'); return }
    if (hype < card.cost) { setMessage('Noch zu wenig Hype!'); return }
    if (onlineStatus === 'playing') socket.current?.send(JSON.stringify({ type: 'deploy', slot, x: p.x, y: p.y }))
    else setGame(g => deploy(g, slot, p.x, p.y))
    spawnSound()
  }
  function toggleSound() {
    if (!audio.current) audio.current = new AudioContext()
    void audio.current.resume()
    setSound(v => !v)
  }
  function closeTutorial() {
    setTutorial(false)
    try { localStorage.setItem('terrace-tutorial-seen', '1') } catch { /* Tutorial can still be dismissed in memory. */ }
  }
  function reorder(index: number) {
    const next = [...deck]
    const target = index === 0 ? 7 : index - 1
    ;[next[index], next[target]] = [next[target], next[index]]
    setDeck(next)
    try { localStorage.setItem('terrace-deck', JSON.stringify(next)) } catch { /* In-memory deck remains usable. */ }
  }
  function toggleDeck(id: number) {
    const next = replaceSlot !== null && !deck.includes(id)
      ? deck.map((cardId, index) => index === replaceSlot ? id : cardId)
      : deck.includes(id) ? deck.filter(cardId => cardId !== id) : deck.length < 8 ? [...deck, id] : deck
    setDeck(next)
    setReplaceSlot(null)
    try { localStorage.setItem('terrace-deck', JSON.stringify(next)) } catch { /* In-memory deck remains usable. */ }
  }
  function moveDeckSlot(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= deck.length || to >= deck.length) return
    const next = [...deck]
    ;[next[from], next[to]] = [next[to], next[from]]
    setDeck(next)
    try { localStorage.setItem('terrace-deck', JSON.stringify(next)) } catch { /* In-memory deck remains usable. */ }
  }
  function rarityClass(card: Card) {
    return `rarity-${card.rarity.toLowerCase()}`
  }
  function spellArt(card: Card) {
    if (card.name === 'Rauchbombe') return <><circle r="18" fill="#202725" stroke="#c0c1a0" strokeWidth="3" /><path d="M-12-5H12M-9 4H9" stroke="#69766b" strokeWidth="2" /><g className="card-smoke"><circle cx="-18" cy="-22" r="10" /><circle cx="0" cy="-29" r="13" /><circle cx="19" cy="-20" r="9" /></g></>
    if (card.name === 'Leuchtrakete') return <g transform="rotate(-25)"><path d="M-24-7H13L23 0 13 7H-24Z" fill="#e8d18a" stroke="#473529" strokeWidth="3" /><path d="M-8-7V7 M5-7V7" stroke="#d95b35" strokeWidth="5" /><path d="M-26 0-42-9 M-26 0-42 9" stroke="#ff8b3d" strokeWidth="5" strokeLinecap="round" /></g>
    if (card.name === 'Bengalo-Salve') return <g>{[-18, 0, 18].map((x, i) => <g key={i} transform={`translate(${x} ${i % 2 ? 5 : -2}) rotate(${i * 18 - 18})`}><path d="M-9-20V8" stroke="#d5b783" strokeWidth="6" /><path d="M-9-19V-28" stroke="#ff7a31" strokeWidth="5" strokeLinecap="round" /></g>)}<path d="M-30 23Q0 3 30 23" fill="none" stroke="#8f9b83" strokeWidth="5" opacity=".7" /></g>
    return <g><path d="M-22-18H22L17 25H-17Z" fill="#d4a43c" stroke="#604121" strokeWidth="3" /><path d="M-17-18Q0-29 17-18" fill="#f4d36d" stroke="#604121" strokeWidth="3" /><path d="M-10-5H10M-12 7H12" stroke="#fff0ad" strokeWidth="3" opacity=".8" /><path d="M-31-26Q-43-35-32-45M31-26Q43-35 32-45" fill="none" stroke="#e6e3be" strokeWidth="4" strokeLinecap="round" /></g>
  }
  function cardArt(card: Card) {
        return <div className={`card-art ${card.kind === 'spell' ? 'spell-card-art' : ''} ${card.kind === 'building' ? 'building-card-art' : ''}`} style={{ '--portrait-color': card.color } as React.CSSProperties}><span className="portrait-number">0{cards.indexOf(card) + 1}</span><svg viewBox={card.kind === 'spell' ? '-52 -58 104 94' : card.kind === 'building' ? '-45 -52 90 105' : card.name === 'Fanmarsch' ? '-58 -78 130 110' : card.name === 'Flitzer' ? '-42 -70 84 82' : '-33 -69 66 65'} aria-hidden="true">{card.kind === 'spell' ? spellArt(card) : card.kind === 'building' ? <g><path d="M-30-5 0 10 30-5 0-20Z" fill="#252f2c" stroke="#111c17" strokeWidth="3" /><path d="M-27-6 0 6 27-6 0-14Z" fill={card.name === 'Würstchenbude' ? '#b87843' : '#c99b42'} /><path d="M-24-5V30L0 42V7Z" fill="#5b6255" stroke="#242d27" strokeWidth="2" /><path d="M0 7 27-6V28L0 42Z" fill="#414b43" stroke="#242d27" strokeWidth="2" /><path d="M-18-2H-2V10H-18Z" fill="#e2d49c" /><path d="M-8-22V-36H17V-25" stroke="#a8a794" strokeWidth="2" /><path d="M-8-36H17V-25H-8Z" fill={card.name === 'Würstchenbude' ? '#d08b50' : '#d8c77e'} stroke="#1c2a24" strokeWidth="2" /><text x="4" y="-28" textAnchor="middle" fill="#273226" fontSize="6" fontWeight="900">{card.name === 'Würstchenbude' ? 'WURST' : 'BIER'}</text><path d="M10 26Q18 18 25 26V34H10Z" fill="#b98a35" /></g> : card.name === 'Fanmarsch' ? <Fanmarsch side="blue" /> : card.name === 'Flitzer' ? <Flitzer side="blue" back={false} /> : card.name === 'Nachwuchs' ? <g>{[-22, -11, 0, 11, 22].flatMap(x => [-48, -30, -12].map(y => <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(.2)`}><Fan card={card} /></g>))}</g> : <Fan card={card} />}</svg></div>
  }
  return <main className={`app-shell ${page === 'arena' ? 'in-arena' : ''}`}>
    <header className="topbar">
      <div className="brand"><span className="brand-mark">TW</span><span>TERRACE <b>WARS</b></span></div>
      <nav aria-label="Hauptnavigation">{(['menu', 'deck'] as const).map((p, i) => <button key={p} className={page === p ? 'active' : ''} onClick={() => { setPage(p); setRunning(false) }}>{['Hauptmenü', 'Mein Deck'][i]}</button>)}</nav>
      <button className="icon-button" onClick={toggleSound} aria-label={sound ? 'Ton ausschalten' : 'Ton einschalten'}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
    </header>
    {page === 'menu' && <section className="menu-page">
      <div className="eyebrow"><span className="live-dot" /> FOOTBALL. RIVALRIES. MAYHEM.</div>
      <h1>DEIN BLOCK.<br />DEIN VEREIN.<br /><em>DEIN DERBY.</em></h1>
       <p>Siebzehn Karten. Zwei Lanes. Drei Minuten.<br />Bring deine Firm auf den Platz und hol dir das Derby.</p>
       <button className="primary" onClick={() => { setOnlineMode(null); setPage('deck') }}><Swords size={21} /> GEGEN KI SPIELEN <span>→</span></button>
       <button className="secondary multiplayer-entry" onClick={() => { setOnlineMode('matchmake'); setPage('deck') }}><Swords size={18} /> GEGNER SUCHEN</button>
       <div className={`multiplayer-status ${serverStatus}`} role="status"><i /> MULTIPLAYER-SERVER: {serverStatus === 'checking' ? 'WIRD GEPRÜFT' : serverStatus === 'online' ? 'ONLINE' : 'OFFLINE'}</div>
       <div className="app-version">FRONTEND v{APP_VERSION}</div>
       <div className="menu-facts"><span><b>01</b> Karte auswählen</span><span><b>02</b> Hool platzieren</span><span><b>03</b> Clubhaus zerstören</span></div>
        <div className="menu-crest"><span>EST. 2026</span><strong>TW</strong><Swords size={70} /><b>TERRACE WARS</b><small>BLOCK GEGEN BLOCK.</small></div>
       <div className="menu-note">Kostenloses Browser-MVP · Training gegen KI · Eigene, fiktive Vereine</div>
       {tutorial && <div className="tutorial-card"><div className="eyebrow">KURZANLEITUNG</div><h2>Dein Derby in drei Zügen</h2><ol><li><b>Karte wählen</b><span>Wähle eine der vier Karten unten.</span></li><li><b>Links platzieren</b><span>Setze Truppen in deiner Hälfte ein; Zauber treffen das ganze Feld.</span></li><li><b>Clubhaus stürmen</b><span>Zerstöre erst die Kneipen und dann das gegnerische Clubhaus.</span></li></ol><button className="secondary" onClick={closeTutorial}>VERSTANDEN</button></div>}
     </section>}
       {page === 'deck' && <section className="page deck-page"><div className="eyebrow">{onlineMode ? 'MULTIPLAYER · ' : ''}DEINE FIRM · {deck.length}/8 KARTEN</div><h1>{onlineMode === 'join' ? 'Dem Derby beitreten.' : onlineMode === 'create' ? 'Ein Derby eröffnen.' : onlineMode === 'matchmake' ? 'Gegner finden.' : 'Die Startelf? Dein Deck.'}</h1><p>Wähle genau acht Karten. Die obere Reihe ist dein fertiges Deck; darunter stellst du es zusammen.</p><div className="deck-slots" aria-label="Deine acht Deckplätze">{Array.from({ length: 8 }, (_, slot) => { const id = deck[slot]; const card = id === undefined ? null : cards[id]; return <div className={`deck-slot ${card ? 'filled' : 'empty'} ${replaceSlot === slot ? 'replace-target' : ''}`} key={slot} draggable={!!card} onDragStart={() => { deckDragSlot.current = slot }} onDragOver={event => event.preventDefault()} onDrop={() => { if (deckDragSlot.current !== null) moveDeckSlot(deckDragSlot.current, slot); deckDragSlot.current = null }} onClick={() => card && setReplaceSlot(slot)} title={card ? 'Ziehen zum Sortieren · Klicken, um diese Karte zu ersetzen' : 'Leeren Deckplatz'}><span className="deck-slot-number">{String(slot + 1).padStart(2, '0')}</span>{card ? <><div className="deck-slot-art">{cardArt(card)}</div><b title={card.name}>{card.name}</b><button className="deck-slot-remove" onClick={event => { event.stopPropagation(); toggleDeck(id) }} aria-label={`${card.name} aus Deckplatz ${slot + 1} entfernen`}>×</button></> : <span className="deck-slot-plus">＋</span>}</div> })}</div><button className="primary deck-start-button" disabled={deck.length !== 8} onClick={start}>{onlineMode === 'join' ? 'DERBY BEITRETEN' : onlineMode === 'create' ? 'EINLADUNG ERSTELLEN' : onlineMode === 'matchmake' ? 'GEGNER SUCHEN' : 'MIT DIESEM DECK SPIELEN'} <Play size={18} /></button><div className="deck-selection-heading"><span>ALLE KARTEN</span><small>{replaceSlot !== null ? `Slot ${replaceSlot + 1} ersetzen · ` : ''}{deck.length}/8 ausgewählt · Klick zum Hinzufügen oder Entfernen</small></div><div className="collection">{cards.filter(card => !card.hidden).map(card => { const id = cards.indexOf(card)
       const selectedInDeck = deck.indexOf(id)
       return <article className={`collection-card ${rarityClass(card)} ${selectedInDeck >= 0 ? 'deck-selected' : ''}`} key={id}><span className="card-cost">{card.cost}</span>{cardArt(card)}<span className={`rarity ${rarityClass(card)}`}>{card.rarity} · {card.cost} Hype</span><h2>{card.name}</h2><p>{card.role}</p><div className="card-stats">{card.hp} HP · {card.damage} Schaden<br />{card.kind === 'building' ? 'Gebäude' : `${card.rate}s Angriff · Tempo ${card.speed}`}</div><button className="secondary" onClick={() => toggleDeck(id)}>{selectedInDeck >= 0 ? `${selectedInDeck + 1} · Entfernen` : '＋ Hinzufügen'}</button>{selectedInDeck >= 0 && <button className="secondary deck-reorder" onClick={() => reorder(selectedInDeck)}>Nach vorne ↑</button>}</article>
        })}</div></section>}
     {page === 'arena' && <section className={`page arena-page ${game.result ? 'showing-result' : ''}`}>
         <div className="mobile-match-timer" aria-label="Verbleibende Spielzeit">{formattedTime}</div>
          <div className="heading-row"><div><div className="eyebrow"><span className="live-dot" /> TERRACE WARS · GEGEN KI</div><h1>Terrace Wars</h1><p>Block gegen Block. Nur einer bleibt stehen.</p></div><div className="match-meta"><div><span>{suddenDeath ? 'SUDDEN DEATH' : time <= 60 ? 'FINALE PHASE' : 'HEIMSPIEL'}</span><strong>{suddenDeath ? 'VERLÄNGERUNG' : time <= 60 ? '2× HYPE' : 'TERRACE WARS'}</strong></div><div className={`timer ${time <= 30 ? 'urgent' : ''}`}>{formattedTime}</div><button className="icon-button" disabled={!!game.result || countdown !== null} onClick={() => setRunning(v => !v)} aria-label={running ? 'Pausieren' : 'Fortsetzen'}>{running ? <Pause size={18} /> : <Play size={18} />}</button></div></div>
       <div className={`game-layout ${game.result ? 'has-result' : ''}`}>
         <aside className="sidebar left-sidebar"><div className="player-card blue-player"><div className="player-id"><div className="crest blue-crest">TW</div><div><b>Deine Firm</b><small>Terrace Wars FC</small></div></div><div className="score">{blueScore}</div></div><div className="stat-card"><div className="stat-title">DEIN CLUBHAUS <Heart size={14} /></div><div className="health-value">{Math.ceil(buildingHp.blueFortress)} <small>/ 2.400 HP</small></div><div className="health-bar"><i style={{ width: `${buildingHp.blueFortress / 24}%` }} /></div><div className="stat-foot"><Shield size={13} /> Heimvorteil</div></div><div className="tip-card"><Zap size={17} /><div><b>Dein Spielzug</b><p>Karte wählen und links platzieren; ab der letzten Spielminute steigt der Gebäudeschaden.</p></div></div></aside>
         <section className="arena-wrap"><div className="arena">
             {loadingActive && <div className="countdown-overlay countdown-loading" role="status" aria-live="assertive">
              <div className="countdown-number countdown-loading-number">HOOLIGANS BEREITEN SICH VOR …</div>
              <div key={loadingStep} className="countdown-subtitle countdown-loading-copy">{loadingMessages[loadingStep]}</div>
            </div>}
            {countdown !== null && arenaReady && <div className={`countdown-overlay ${countdown === 'go' ? 'countdown-go' : ''}`} role="status" aria-live="assertive">
             <div className="countdown-smoke smoke-left" /><div className="countdown-smoke smoke-right" />
             <div className="countdown-pyro pyro-left">✦</div><div className="countdown-pyro pyro-right">✦</div>
              <div className="countdown-number">{countdown === 'go' ? 'SPORT FREI!' : countdown}</div>
             <div className="countdown-subtitle">{countdown === 'go' ? 'DAS DERBY LÄUFT' : 'BEREIT MACHEN'}</div>
           </div>}
          <div className="arena-topline"><span><i /> LIVE FROM THE BLOCKS</span><span>TERRACE WARS <b>{blueScore} : {redScore}</b> KIEZ</span><span>{onlineStatus === 'playing' ? `● ONLINE${latency === null ? '' : ` · ${latency} ms`}` : onlineStatus === 'connecting' ? '○ VERBINDET …' : '23:47 · FLUTLICHT'}</span></div>
               <PhaserArena game={arenaGame} selectedCard={selectedCard} dragging={draggingCard} perspective={onlineRole} showUnitStates={showUnitStates} replayActive={replayActive} replayFocus={replayFocus} networkTiming={networkTiming.current} networkPrevious={networkPreviousSnapshot.current} active={running && !game.result} onReady={handleArenaReady} onPlace={(x, y, drop) => { place(x, y, drop ? dragged.current ?? selected : selected); dragged.current = null; setDraggingCard(false) }} />
          <div className="arena-bottomline"><span>HOME END <b>↗</b></span><span>BETON. RAUCH. RIVALITÄT.</span><span><b>↙</b> AWAY END</span></div>
              {!loadingActive && countdown === null && (!running || game.result) && (replayActive && game.result ? <div className="match-overlay replay-overlay" role="status" aria-live="polite"><div className="replay-card"><div className="replay-kicker">LETZTE 5 SEKUNDEN · 0,5×</div><div className={`replay-result ${game.result === 'DERBYSIEG!' ? 'replay-result-win' : 'replay-result-loss'}`}>{game.result}</div><h2>ZEITLUPE</h2><p>Die entscheidende Schlussphase läuft verlangsamt ab.</p><div className="replay-stats"><div><b>{Math.round(game.totalDamage)}</b><span>Schaden</span></div><div><b>{game.shots}</b><span>Angriffe</span></div><div><b>{blueScore}:{redScore}</b><span>Außenposten</span></div><div><b>{formattedMatchDuration}</b><span>Matchdauer</span></div></div><button className="secondary" onClick={() => setReplayActive(false)}>ERGEBNIS ANZEIGEN</button></div></div> : game.result && !replayActive ? <div className={`match-overlay result-overlay ${game.result === 'DERBYSIEG!' ? 'result-win' : 'result-loss'}`}>
             <div className="result-kicker">{game.result === 'DERBYSIEG!' ? 'DIE KURVE DREHT DURCH' : 'DER BLOCK IST GEFALLEN'}</div>
             <h2>{game.result}</h2>
               <div className="result-scene" aria-label={game.result === 'DERBYSIEG!' ? 'Feiernde Hooligans mit Terrace-Wars-Siegesbanner' : 'Geschwächte, verletzte Fans nach der Niederlage'}>
                 <div className={`result-banner ${game.result === 'DERBYSIEG!' ? 'result-banner-win' : 'result-banner-loss'}`} aria-hidden="true"><span>TERRACE WARS</span><b>{game.result === 'DERBYSIEG!' ? 'DERBYSIEG' : game.result === 'UNENTSCHIEDEN' ? 'KEIN SIEGER' : 'BLOCK GEFALLEN'}</b></div>
                <svg className="result-fans" viewBox="-100 -75 200 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                  {game.result === 'DERBYSIEG!' ? <>
                    <g transform="translate(-72 60) scale(.42)"><g className="result-fan result-fan-left"><Fan card={cards[17]} side="blue" victory /></g></g>
                    <g transform="translate(-37 58) scale(.54)"><g className="result-fan result-fan-left"><Fan card={cards[1]} side="blue" victory /></g></g>
                    <g transform="translate(0 58) scale(.64)"><g className="result-fan result-fan-center"><Fan card={cards[0]} side="blue" victory /></g></g>
                    <g transform="translate(37 58) scale(.54)"><g className="result-fan result-fan-right"><Fan card={cards[19]} side="blue" victory /></g></g>
                    <g transform="translate(72 60) scale(.42)"><g className="result-fan result-fan-right"><Fan card={cards[4]} side="blue" victory /></g></g>
                  </> : <>
                    <g transform="translate(-72 60) scale(.42)"><g className="result-fan result-fan-left"><Fan card={cards[2]} side="blue" wounded /></g></g>
                    <g transform="translate(-37 58) scale(.54)"><g className="result-fan result-fan-left"><Fan card={cards[1]} side="blue" wounded /></g></g>
                    <g transform="translate(0 58) scale(.64)"><g className="result-fan result-fan-center"><Fan card={cards[0]} side="blue" wounded /></g></g>
                    <g transform="translate(37 58) scale(.54)"><g className="result-fan result-fan-right"><Fan card={cards[3]} side="blue" wounded /></g></g>
                    <g transform="translate(72 60) scale(.42)"><g className="result-fan result-fan-right"><Fan card={cards[4]} side="blue" wounded /></g></g>
                  </>}
               </svg>
                {game.result !== 'DERBYSIEG!' && <div className="result-blood-pools"><i /><i /><i /></div>}
             </div>
                 <p>{game.result === 'DERBYSIEG!' ? `Außenposten: ${blueScore} : ${redScore} · ${Math.round(game.totalDamage)} Gesamtschaden · Die Nacht gehört Terrace Wars.` : `Außenposten: ${blueScore} : ${redScore} · ${Math.round(game.totalDamage)} Gesamtschaden · Aufstehen, Krone richten.`}</p><button className="secondary replay-button" onClick={replayDecisiveScene}>↻ SZENE NOCHMAL</button>
                <div className="result-stats" aria-label="Detaillierte Ergebnisstatistik">
                  <div><b>{Math.round(game.totalDamage)}</b><span>Schaden</span></div>
                  <div><b>{game.shots}</b><span>Angriffe</span></div>
                  <div><b>{blueScore}</b><span>Außenposten</span></div>
                  <div><b>{formattedMatchDuration}</b><span>Matchdauer</span></div>
                  <div><b>{Math.ceil(buildingHp.blueFortress)}</b><span>Dein Clubhaus-HP</span></div>
                  <div><b>{Math.ceil(buildingHp.redFortress)}</b><span>Gegner-Clubhaus-HP</span></div>
                </div>
                <div className="result-actions"><button className="primary" onClick={start}>REVANCHE <Play size={18} /></button><button className="secondary" onClick={() => setPage('menu')}>Hauptmenü</button></div>
             </div> : onlineStatus !== 'offline' ? <div className="match-overlay multiplayer-overlay"><Swords size={40} /><h2>{onlineStatus === 'waiting' ? onlineMode === 'matchmake' ? 'GEGNER WIRD GESUCHT' : 'DEIN DERBY-WARTERAUM' : 'VERBINDUNG WIRD HERGESTELLT'}</h2><p>{onlineStatus === 'waiting' ? onlineMode === 'matchmake' ? 'Du wirst automatisch mit dem nächsten Spieler verbunden.' : 'Link schicken oder QR-Code scannen:' : onlineMessage || 'Der Multiplayer-Server wird kontaktiert …'}</p>{onlineMode !== 'matchmake' && inviteLink && <div className="invite-link">{inviteQr && <img className="invite-qr" src={inviteQr} alt="QR-Code für die Derby-Einladung" />}<code>{inviteLink}</code><button className="secondary" onClick={() => navigator.clipboard?.writeText(inviteLink)}>LINK KOPIEREN</button></div>}{onlineMessage && onlineStatus === 'waiting' && <small>{onlineMessage}</small>}{onlineStatus === 'connecting' && onlineMessage && <button className="secondary" onClick={startOnline}>ERNEUT VERBINDEN</button>}<button className="secondary" onClick={() => { socket.current?.close(); setOnlineStatus('offline'); setOnlineMode(null); setPage('menu') }}>Abbrechen</button></div> : <div className="match-overlay"><Trophy size={40} /><h2>HALBZEIT IM KOPF.</h2><p>Kurz durchatmen. Dein Derby wartet.</p><button className="primary" onClick={() => setRunning(true)}>WEITERSPIELEN <Play size={18} /></button><button className="secondary" onClick={() => setPage('menu')}>Hauptmenü</button></div>)}
         </div><div className="arena-legend"><span><i className="legend-dot blue" /> DEINE FIRM</span><span><i className="legend-dot red" /> KIEZ FIRM</span><span>{game.overtime > 0 ? 'SUDDEN DEATH' : '2 LANES · 2 BRÜCKEN'}</span></div></section>
         <aside className="sidebar right-sidebar"><div className="player-card red-player"><div className="score">{redScore}</div><div className="player-id"><div className="crest red-crest">K</div><div><b>KiezKalle <span className="cpu-badge">KI</span></b><small>Auswärtsblock</small></div></div></div><div className="stat-card"><div className="stat-title">RIVALEN-CLUBHAUS <Heart size={14} /></div><div className="health-value">{Math.ceil(buildingHp.redFortress)} <small>/ 2.400 HP</small></div><div className="health-bar red-health"><i style={{ width: `${buildingHp.redFortress / 24}%` }} /></div></div><div className="combat-log"><div className="stat-title">LIVE-TICKER <Swords size={14} /></div>{game.log.map((entry, i) => <p key={i}>{entry}</p>)}</div></aside>
      </div>
       <div className="bottom-panel"><div className="hype"><div className="hype-label"><Flame size={17} /> HYPE <b>{hype.toFixed(1)}</b><span>/ 10</span></div><div className="hype-bar"><i style={{ width: `${hypePercent}%` }} /></div><small>+{time <= 60 ? '0,95' : '0,48'} / Sekunde</small></div>
          <div className="hand">{myQueue.slice(0, 4).map((id, index) => { const card = cards[id]; return <button title={`${card.name} · ${card.role} · ${card.cost} Hype`} draggable={false} onPointerDown={e => { e.preventDefault(); dragged.current = index; setSelected(index); setDraggingCard(true) }} className={`card ${rarityClass(card)} ${selected === index ? 'selected' : ''} ${hype < card.cost ? 'disabled' : ''}`} key={id} onClick={() => { setSelected(index); setDraggingCard(false) }} aria-label={`${card.name}, ${card.cost} Hype`} aria-pressed={selected === index}><span className="card-cost">{card.cost}</span>{cardArt(card)}<b>{card.name}</b><small>{card.role}</small></button> })}</div>
           <div className="panel-actions"><div className="next-card-preview" title={`Nächste Karte: ${nextCard.name}`}><div className="next-card-art">{cardArt(nextCard)}</div><div><small>NÄCHSTE KARTE</small><b>{nextCard.icon} {nextCard.name}</b></div></div><button className="icon-button" onClick={toggleSound} aria-label={sound ? 'Ton ausschalten' : 'Ton einschalten'} title={sound ? 'Ton ausschalten' : 'Ton einschalten'}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><button className="icon-button" onClick={() => setShowUnitStates(v => !v)} aria-label={showUnitStates ? 'Einheitenzustände ausblenden' : 'Einheitenzustände anzeigen'} title={showUnitStates ? 'Einheitenzustände ausblenden' : 'Einheitenzustände anzeigen'}>{showUnitStates ? <EyeOff size={18} /> : <Eye size={18} />}</button><button className="surrender" disabled={!!game.result} onClick={() => { if (!window.confirm('Möchtest du das Derby wirklich aufgeben?')) return; setGame(g => ({ ...g, result: 'AUFGEGEBEN' })); setRunning(false) }}><RotateCcw size={15} /> Aufgeben</button></div>
        </div><footer><span><Trophy size={13} /> Zerstöre das Clubhaus oder führe nach 3 Minuten bei zerstörten Außenposten.</span><span>v{APP_VERSION} · TRAINING MVP</span></footer>
      {message && <div className="toast" role="status">{message}</div>}
    </section>}
  </main>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
