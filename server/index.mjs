import { WebSocketServer } from 'ws'
import { createServer } from 'node:http'
import { deploy, newGame, tick, AI_DECK, cards } from '../src/game.ts'

const port = Number(process.env.PORT || 8787)
const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }))
    return
  }
  response.writeHead(404)
  response.end('Terrace Wars multiplayer server')
})
const wss = new WebSocketServer({ server: httpServer })
const rooms = new Map()

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

function validDeck(deck) {
  return Array.isArray(deck) && deck.length === 8 && new Set(deck).size === 8 && deck.every(id => Number.isInteger(id) && id >= 0 && id < cards.length)
}

function closeRoom(room, reason = 'Der Raum wurde geschlossen.') {
  if (room.timer) clearInterval(room.timer)
  if (room.startTimer) clearTimeout(room.startTimer)
  rooms.delete(room.code)
  broadcast(room, { type: 'room-closed', reason })
  for (const player of room.players) player.socket.close()
}

function begin(room) {
  room.game = newGame(room.players[0].deck, AI_DECK, true, room.players[1].deck)
  send(room.players[0].socket, { type: 'match-start', role: 'blue', state: room.game })
  send(room.players[1].socket, { type: 'match-start', role: 'red', state: room.game })
  room.lastBroadcast = 0
  room.startTimer = setTimeout(() => {
    room.timer = setInterval(() => {
      if (!room.game || room.game.result) return
      room.game = tick(room.game, .05)
      const now = Date.now()
      if (now - room.lastBroadcast >= 50) {
        room.lastBroadcast = now
        broadcast(room, { type: 'state', state: room.game })
      }
    }, 50)
  }, 3850)
}

function handle(socket, message) {
  if (!message || typeof message.type !== 'string') return
  if (message.type === 'create') {
    if (!validDeck(message.deck)) return send(socket, { type: 'error', message: 'Bitte wähle genau 8 gültige Karten.' })
    const room = { code: code(), players: [{ socket, deck: message.deck }], game: null, timer: null, lastBroadcast: 0 }
    rooms.set(room.code, room)
    socket.room = room
    send(socket, { type: 'room', code: room.code, role: 'blue', invite: `${process.env.PUBLIC_URL || ''}/?match=${room.code}`, waiting: true })
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
    broadcast(room, { type: 'state', state: room.game })
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
  console.log(`Terrace Wars multiplayer server listening on :${port}`)
})
