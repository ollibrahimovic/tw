import { WebSocketServer } from 'ws'
import { createServer } from 'node:http'
import { deploy, newGame, tick, AI_DECK, cards } from '../src/game.ts'

const port = Number(process.env.PORT || 8787)
const serverVersion = '0.2'
const commit = process.env.RENDER_GIT_COMMIT || null
const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    })
    response.end(JSON.stringify({ ok: true, version: serverVersion, commit, rooms: rooms.size }))
    return
  }
  response.writeHead(404)
  response.end('Hool Arena multiplayer server')
})
const wss = new WebSocketServer({
  server: httpServer,
  perMessageDeflate: {
    threshold: 1024,
    serverNoContextTakeover: true,
    clientNoContextTakeover: true,
  },
})
const rooms = new Map()
const matchmaking = []
const SIMULATION_STEP_MS = 50
const MAX_CATCH_UP_STEPS = 5

function code() {
  let value
  do value = Math.random().toString(36).slice(2, 8).toUpperCase()
  while (rooms.has(value))
  return value
}

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message))
}

function broadcast(room, message) {
  for (const player of room.players) send(player.socket, message)
}

function broadcastState(room) {
  const logSignature = `${room.game.log.length}:${room.game.log[room.game.log.length - 1] || ''}`
  const state = { ...room.game }
  if (room.lastLogSignature === logSignature) delete state.log
  else room.lastLogSignature = logSignature
  broadcast(room, {
    type: 'state',
    state,
    serverTick: room.serverTick,
    serverTime: room.serverTime || Date.now(),
  })
}

function validDeck(deck) {
  return Array.isArray(deck) && deck.length === 8 && new Set(deck).size === 8 &&
    deck.every(id => Number.isInteger(id) && id >= 0 && id < cards.length && !cards[id].hidden)
}

function closeRoom(room, reason = 'Der Raum wurde geschlossen.') {
  if (room.timer) clearTimeout(room.timer)
  if (room.startTimer) clearTimeout(room.startTimer)
  rooms.delete(room.code)
  const queueIndex = matchmaking.indexOf(room)
  if (queueIndex >= 0) matchmaking.splice(queueIndex, 1)
  broadcast(room, { type: 'room-closed', reason })
  for (const player of room.players) player.socket.close()
}

function queueForMatch(socket, deck) {
  while (matchmaking.length && matchmaking[0].players[0].socket.readyState !== 1) matchmaking.shift()
  const waiting = matchmaking.shift()
  if (waiting) {
    waiting.players.push({ socket, deck })
    socket.room = waiting
    send(waiting.players[0].socket, { type: 'room', code: waiting.code, role: 'blue', waiting: false })
    send(socket, { type: 'room', code: waiting.code, role: 'red', waiting: false })
    send(waiting.players[0].socket, { type: 'opponent-joined' })
    begin(waiting)
    return
  }
  const room = { code: code(), players: [{ socket, deck }], game: null, timer: null, lastBroadcast: 0, serverTick: 0, lastLogSignature: '' }
  rooms.set(room.code, room)
  matchmaking.push(room)
  socket.room = room
  send(socket, { type: 'room', code: room.code, role: 'blue', waiting: true })
}

function begin(room) {
  room.game = newGame(room.players[0].deck, AI_DECK, true, room.players[1].deck)
  room.serverTick = 0
  room.serverTime = Date.now()
  room.lastLogSignature = `${room.game.log.length}:${room.game.log[room.game.log.length - 1] || ''}`
  send(room.players[0].socket, { type: 'match-start', role: 'blue', state: room.game, serverTick: room.serverTick, serverTime: room.serverTime })
  send(room.players[1].socket, { type: 'match-start', role: 'red', state: room.game, serverTick: room.serverTick, serverTime: room.serverTime })
  room.startTimer = setTimeout(() => {
    let previousTime = performance.now()
    let accumulator = 0
    const loop = () => {
      if (!room.game || room.game.result) return
      const now = performance.now()
      const elapsed = Math.min(250, Math.max(0, now - previousTime))
      previousTime = now
      accumulator += elapsed
      let steps = 0
      while (accumulator >= SIMULATION_STEP_MS && steps < MAX_CATCH_UP_STEPS) {
        room.game = tick(room.game, SIMULATION_STEP_MS / 1000)
        room.serverTick++
        room.serverTime = Date.now()
        accumulator -= SIMULATION_STEP_MS
        steps++
      }
      // If the process was blocked for too long, discard excess time rather
      // than simulating an unbounded burst and freezing the server again.
      if (steps === MAX_CATCH_UP_STEPS && accumulator >= SIMULATION_STEP_MS) accumulator = 0
      if (steps > 0) broadcastState(room)
      room.timer = setTimeout(loop, Math.max(0, SIMULATION_STEP_MS - accumulator))
    }
    room.timer = setTimeout(loop, SIMULATION_STEP_MS)
  }, 3850)
}

function handle(socket, message) {
  if (!message || typeof message.type !== 'string') return
  if (message.type === 'ping') {
    if (Number.isFinite(message.sentAt)) send(socket, { type: 'pong', sentAt: message.sentAt })
    return
  }
  if (message.type === 'create') {
    if (!validDeck(message.deck)) return send(socket, { type: 'error', message: 'Bitte wähle genau 8 gültige Karten.' })
    const room = { code: code(), players: [{ socket, deck: message.deck }], game: null, timer: null, lastBroadcast: 0 }
    rooms.set(room.code, room)
    socket.room = room
    send(socket, { type: 'room', code: room.code, role: 'blue', invite: `${process.env.PUBLIC_URL || ''}/?match=${room.code}`, waiting: true })
    return
  }
  if (message.type === 'matchmake') {
    if (!validDeck(message.deck)) return send(socket, { type: 'error', message: 'Bitte wähle genau 8 gültige Karten.' })
    queueForMatch(socket, message.deck)
    return
  }
  if (message.type === 'join') {
    const room = rooms.get(String(message.code || '').toUpperCase())
    if (!room) return send(socket, { type: 'error', message: 'Einladungslink nicht gefunden.' })
    if (room.players.length >= 2) return send(socket, { type: 'error', message: 'Dieses Derby ist bereits voll.' })
    if (!validDeck(message.deck)) return send(socket, { type: 'error', message: 'Bitte wähle genau 8 gültige Karten.' })
    room.players.push({ socket, deck: message.deck })
    socket.room = room
    send(socket, { type: 'room', code: room.code, role: 'red', invite: `${process.env.PUBLIC_URL || ''}/?match=${room.code}`, waiting: false })
    send(room.players[0].socket, { type: 'opponent-joined' })
    begin(room)
    return
  }
  const room = socket.room
  if (!room || !room.game) return
  if (message.type === 'deploy') {
    const player = room.players.find(item => item.socket === socket)
    if (!player || !Number.isInteger(message.slot) || !Number.isFinite(message.x) || !Number.isFinite(message.y)) return
    const side = player === room.players[0] ? 'blue' : 'red'
    room.game = deploy(room.game, message.slot, message.x, message.y, side)
    broadcastState(room)
  }
}

wss.on('connection', socket => {
  socket.on('message', raw => {
    try { handle(socket, JSON.parse(raw.toString())) } catch { send(socket, { type: 'error', message: 'Ungültige Servernachricht.' }) }
  })
  socket.on('close', () => {
    const room = socket.room
    if (room) closeRoom(room, 'Ein Spieler hat das Derby verlassen.')
  })
})

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Hool Arena multiplayer server listening on :${port}`)
})
