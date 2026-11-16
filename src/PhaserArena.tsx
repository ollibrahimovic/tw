import { useEffect, useRef } from 'react'
import type PhaserType from 'phaser'
import { buildings, canDeploy, cards } from './game'
import type { Card, Game, Side } from './game'
import { createArenaEffects } from './phaserEffects'
import { fromTile, snapToTile, snapBuildingToTile, validTile } from './grid.ts'

type PhaserArenaProps = {
  game: Game
  selectedCard: Card
  active: boolean
  dragging?: boolean
  perspective?: Side
  onPlace: (x: number, y: number, drop: boolean) => void
}

type ArenaScene = PhaserType.Scene & {
  preload: () => void
  create: () => void
  renderArena?: () => void
}

type Point = { x: number; y: number }

const BLUE = 0x64c9bd
const RED = 0xe9754e
const CREAM = 0xe7dfb4
const DARK = 0x101815

function cardColor(card: Card) {
  if (card.name === 'Flitzer') return 0xc58f72
  if (card.kind === 'building') return 0xc99b42
  if (card.kind === 'spell') return 0xd5a53b
  return 0xef8d32
}

/**
 * Phaser renderer, phase two of the migration.
 *
 * The game rules still live in game.ts. This layer only turns the current
 * state into pixels and owns pointer input, so it can eventually replace the
 * SVG arena without changing multiplayer or simulation code.
 */
export function PhaserArena({ game, selectedCard, active, dragging = false, perspective = 'blue', onPlace }: PhaserArenaProps) {
  const host = useRef<HTMLDivElement>(null)
  const gameRef = useRef(game)
  const selectedRef = useRef(selectedCard)
  const activeRef = useRef(active)
  const draggingRef = useRef(dragging)
  const perspectiveRef = useRef(perspective)
  const onPlaceRef = useRef(onPlace)

  gameRef.current = game
  selectedRef.current = selectedCard
  activeRef.current = active
  draggingRef.current = dragging
  perspectiveRef.current = perspective
  onPlaceRef.current = onPlace

  useEffect(() => {
    if (!host.current) return

    let instance: PhaserType.Game | undefined
    let disposed = false
    void Promise.all([import('phaser'), import('./phaserArt')]).then(([{ default: Phaser }, { artHealth, loadArenaArt }]) => {
      if (disposed || !host.current) return

      const scene = new Phaser.Scene('TerraceWarsArena') as ArenaScene
      scene.preload = function () { loadArenaArt(this) }
      scene.create = function () {
        const graphics = this.add.graphics()
        const sprites = new Map<string, PhaserType.GameObjects.Image>()
        const usedSprites = new Set<string>()
        const bars = this.add.graphics().setDepth(10)
        const displaySide = (side: Side): Side => side === perspectiveRef.current ? 'blue' : 'red'
        const spawnIndicators = this.add.graphics().setDepth(11)
        const atmosphere = this.add.graphics().setDepth(.25)
        const phaseBackdrop = this.add.graphics().setDepth(30)
        const phaseText = this.add.text(0, 0, '', {
          color: '#f8edc7',
          fontFamily: 'Arial Black, sans-serif',
          fontSize: '34px',
          fontStyle: 'bold',
          stroke: '#17231b',
          strokeThickness: 8,
          align: 'center',
        }).setOrigin(.5).setDepth(31)
        const phaseSubtitle = this.add.text(0, 0, '', {
          color: '#d8c77e',
          fontFamily: 'Arial, sans-serif',
          fontSize: '13px',
          fontStyle: 'bold',
          letterSpacing: 2,
          stroke: '#17231b',
          strokeThickness: 4,
          align: 'center',
        }).setOrigin(.5).setDepth(31)
        const showArt = (id: string, key: string, p: Point, character: boolean, alpha = 1, depth = 1) => {
          if (!this.textures.exists(key)) return false
          usedSprites.add(id)
          let sprite = sprites.get(id)
          if (!sprite) {
            sprite = this.add.image(0, 0, key)
            sprites.set(id, sprite)
          }
          sprite.setTexture(key).setPosition(p.x, p.y)
            .setOrigin(.5, character ? .8 : 190 / 240)
            .setScale(character ? .32 : .28).setAlpha(alpha).setDepth(depth)
          return true
        }
        const healthBar = (p: Point, hp: number, max: number, side: Side, width = 24, yOffset = 17) => {
          if (hp <= 0) return
          bars.fillStyle(DARK, .9).fillRect(p.x - width / 2, p.y + yOffset, width, 3)
          bars.fillStyle(displaySide(side) === 'blue' ? BLUE : RED, 1)
            .fillRect(p.x - width / 2, p.y + yOffset, width * Math.max(0, Math.min(1, hp / max)), 3)
        }
        let hover: Point | null = null
        let pointerDown = false
        let animationClock = 0
        let lastState = gameRef.current
        let stateAge = 0
        const drawAtmosphere = () => {
          const m = metrics()
          atmosphere.clear()

          // Slow cloud banks keep the pitch alive without obscuring gameplay.
          for (let i = 0; i < 5; i++) {
            const drift = (animationClock * (.004 + i * .0007) + i * 180) % (m.pitchWidth + 180) - 90
            const x = m.left + drift
            const y = m.top + 34 + (i % 3) * 42
            const scale = 1 + (i % 2) * .25
            atmosphere.fillStyle(i % 2 ? 0xd6dfc0 : 0xb9c9b0, .045)
            atmosphere.fillEllipse(x, y, 130 * scale, 24 * scale)
            atmosphere.fillEllipse(x - 34 * scale, y + 3, 72 * scale, 18 * scale)
            atmosphere.fillEllipse(x + 38 * scale, y + 2, 86 * scale, 20 * scale)
          }

          // Dust, ash and a few diagonal rain glints create movement in the air.
          for (let i = 0; i < 30; i++) {
            const x = m.left + ((i * 97 + animationClock * (2 + i % 3)) % m.pitchWidth)
            const y = m.top + ((i * 53 + animationClock * (1 + i % 2)) % m.pitchHeight)
            atmosphere.fillStyle(i % 5 === 0 ? 0xe6d99c : 0xd1d8b6, i % 5 === 0 ? .2 : .1)
            atmosphere.fillCircle(x, y, i % 5 === 0 ? 1.4 : .8)
          }
          for (let i = 0; i < 9; i++) {
            const x = m.left + ((i * 151 + animationClock * 1.8) % m.pitchWidth)
            const y = m.top + 70 + ((i * 83) % Math.max(1, m.pitchHeight - 90))
            atmosphere.lineStyle(1, 0xb8c9bb, .11)
            atmosphere.lineBetween(x, y, x - 4, y + 12)
          }
          const confettiColors = [0xe7c95d, 0xd96b4f, 0x72b9a4, 0xb487d1, 0xe9e0b0]
          for (let i = 0; i < 14; i++) {
            const cycle = (animationClock * .00022 + i * .137) % 1
            if (cycle > .62) continue
            const flight = cycle / .62
            const x = m.left - 12 + flight * (m.pitchWidth + 24) + Math.sin(animationClock * .004 + i) * 7
            const y = m.top + 20 + ((i * 71) % Math.max(1, m.pitchHeight - 70)) +
              Math.sin(flight * Math.PI * 2 + i) * 18 + flight * flight * 28
            const length = 3 + (i % 3)
            atmosphere.fillStyle(confettiColors[i % confettiColors.length], .7)
            atmosphere.fillRect(x, y, length, 1.8)
            if (i % 2 === 0) atmosphere.fillRect(x + length * .4, y - 2, 1.8, 4)
          }
        }
        const drawPhaseAlert = () => {
          const seconds = gameRef.current.time
          const suddenDeath = gameRef.current.overtime > 0 && gameRef.current.overtime <= 3.5
          const active = !gameRef.current.result && (suddenDeath || (seconds > 0 && seconds <= 60))
          if (!active) {
            phaseBackdrop.clear()
            phaseText.setVisible(false)
            phaseSubtitle.setVisible(false)
            return
          }
          const m = metrics()
          const finalCountdown = !suddenDeath && seconds <= 10
          const pulse = finalCountdown ? 1 + Math.sin(animationClock * .012) * .06 : 1
          const width = suddenDeath ? 330 : finalCountdown ? 158 : 290
          const height = suddenDeath ? 102 : finalCountdown ? 132 : 78
          const x = m.left + m.pitchWidth / 2
          const y = m.top + m.pitchHeight / 2
          phaseBackdrop.clear()
            .fillStyle(suddenDeath || finalCountdown ? 0x8f3f32 : 0x17231b, suddenDeath || finalCountdown ? .9 : .82)
            .fillRoundedRect(x - width / 2, y - height / 2, width, height, 14)
            .lineStyle(2, suddenDeath || finalCountdown ? 0xf0a35d : 0xd8c77e, .9)
            .strokeRoundedRect(x - width / 2, y - height / 2, width, height, 14)
          phaseText.setPosition(x, y - (suddenDeath ? 10 : finalCountdown ? 10 : 6))
            .setScale(suddenDeath ? 1 + Math.sin(animationClock * .01) * .04 : pulse)
            .setText(suddenDeath ? '☠ SUDDEN DEATH ☠' : finalCountdown ? String(Math.ceil(seconds)) : 'LETZTE 60 SEKUNDEN')
            .setVisible(true)
          phaseSubtitle.setPosition(x, y + (suddenDeath ? 35 : finalCountdown ? 43 : 25))
            .setText(suddenDeath ? 'CLUBHAUS FÄLLT ODER VERLÄNGERUNG ENDET' : finalCountdown ? 'NOCH ZEIT' : 'ENDSPURT')
            .setVisible(true)
        }

        const metrics = () => {
          const width = this.scale.width
          const height = this.scale.height
          const left = Math.max(18, width * .08)
          const top = Math.min(100, height * (width < 600 ? .06 : .18))
          return { width, height, left, top, pitchWidth: width - left * 2, pitchHeight: height - top - 28 }
        }

        const toScreen = (x: number, y: number): Point => {
          const m = metrics()
          const depth = perspectiveRef.current === 'red' ? 100 - x : x
          return {
            x: m.left + y / 100 * m.pitchWidth,
            y: m.top + (100 - depth) / 100 * m.pitchHeight,
          }
        }

        const renderWeaponEffects = createArenaEffects(this, toScreen)
        const fromPointer = (pointer: Phaser.Input.Pointer): Point => {
          const m = metrics()
          const lane = (pointer.x - m.left) / m.pitchWidth * 100
          const depth = 100 - (pointer.y - m.top) / m.pitchHeight * 100
          const point = { x: perspectiveRef.current === 'red' ? 100 - depth : depth, y: lane }
          return selectedRef.current.kind === 'building' ? snapBuildingToTile(point) : snapToTile(point)
        }
        const fromClientPointer = (event: PointerEvent): Point | null => {
          const canvas = this.game.canvas
          const rect = canvas.getBoundingClientRect()
          if (event.clientX < rect.left || event.clientX > rect.right ||
            event.clientY < rect.top || event.clientY > rect.bottom) return null
          return fromPointer({
            x: (event.clientX - rect.left) * this.scale.width / rect.width,
            y: (event.clientY - rect.top) * this.scale.height / rect.height,
          } as Phaser.Input.Pointer)
        }

        const line = (a: Point, b: Point, color: number, width: number, alpha = 1) => {
          graphics.lineStyle(width, color, alpha)
          graphics.lineBetween(a.x, a.y, b.x, b.y)
        }

        const polygon = (points: Point[], fill: number, alpha = 1, stroke = CREAM) => {
          graphics.fillStyle(fill, alpha)
          const vectors = points.map(point => new Phaser.Math.Vector2(point.x, point.y))
          graphics.fillPoints(vectors, true)
          graphics.lineStyle(1.5, stroke, .55)
          graphics.strokePoints(vectors, true)
        }

        const drawPitch = () => {
          const m = metrics()
          graphics.fillStyle(0x111a14, 1)
          graphics.fillRect(0, 0, m.width, m.height)
           graphics.fillStyle(0x465b3d, 1)
           graphics.fillRoundedRect(m.left, m.top, m.pitchWidth, m.pitchHeight, 8)

           // Worn, muddy terrace ground: fixed positions keep the texture
           // stable while the arena is redrawn every frame.
           for (let i = 0; i < 42; i++) {
             const px = m.left + 10 + ((i * 79) % 997) / 997 * (m.pitchWidth - 20)
             const py = m.top + 12 + ((i * 137) % 991) / 991 * (m.pitchHeight - 24)
             const width = 12 + (i % 5) * 8
             const height = 4 + (i % 4) * 2
             const muddy = i % 4 === 0
             graphics.fillStyle(muddy ? 0x493f2d : i % 3 === 0 ? 0x75815a : 0x273829, muddy ? .24 : .16)
             graphics.fillEllipse(px, py, width, height)
             if (muddy) {
               graphics.fillStyle(0x8d7950, .1)
               graphics.fillEllipse(px + 5, py - 1, width * .55, height * .7)
             }
           }
           for (let i = 0; i < 34; i++) {
             const px = m.left + 8 + ((i * 173) % 983) / 983 * (m.pitchWidth - 16)
             const py = m.top + 10 + ((i * 59) % 977) / 977 * (m.pitchHeight - 20)
             const radius = 1.2 + (i % 3) * .8
             graphics.fillStyle(i % 2 ? 0xaaa17d : 0x5b604d, .38)
             graphics.fillCircle(px, py, radius)
             graphics.fillStyle(0xd1c89c, .16)
             graphics.fillCircle(px - radius * .35, py - radius * .35, radius * .35)
           }
           for (let i = 0; i < 22; i++) {
             const px = m.left + 14 + ((i * 211) % 971) / 971 * (m.pitchWidth - 28)
             const py = m.top + 18 + ((i * 97) % 967) / 967 * (m.pitchHeight - 36)
             graphics.lineStyle(1.2, i % 2 ? 0x8b9a68 : 0x202e25, .28)
             graphics.lineBetween(px, py, px + (i % 3 - 1) * 5, py - 5 - (i % 3) * 2)
             graphics.lineBetween(px + 2, py, px + 5, py - 4)
           }
           graphics.lineStyle(2, CREAM, .7)
           graphics.strokeRoundedRect(m.left, m.top, m.pitchWidth, m.pitchHeight, 8)

          for (let i = 1; i < 12; i++) {
            const y = m.top + m.pitchHeight * i / 12
            line({ x: m.left, y }, { x: m.left + m.pitchWidth, y }, 0x17251b, 1, .22)
          }
          if (activeRef.current && selectedRef.current && (draggingRef.current || pointerDown)) {
            const tileWidth = m.pitchWidth / 18
            const tileHeight = m.pitchHeight / 32
            for (let ty = 0; ty <= 31; ty++) for (let tx = 1; tx <= 18; tx++) {
              if (!validTile(tx, ty)) continue
              const tile = fromTile({ x: tx, y: ty })
              const p = toScreen(tile.x, tile.y)
              const allowed = canDeploy(gameRef.current, selectedRef.current, tile.x, tile.y, perspectiveRef.current)
              graphics.fillStyle(allowed ? 0x4d9ee8 : 0xc45142, allowed ? .1 : .055)
              graphics.fillRect(p.x - tileWidth / 2, p.y - tileHeight / 2, tileWidth, tileHeight)
              graphics.lineStyle(.6, allowed ? 0x8ac7fa : 0xe09a87, allowed ? .3 : .16)
              graphics.strokeRect(p.x - tileWidth / 2, p.y - tileHeight / 2, tileWidth, tileHeight)
            }
          }

          // Two shared Clash-style lanes. They start at the clubhouses, pass
          // through the pubs, bend toward the matching fence opening, and
          // continue symmetrically into the opponent's half.
          for (const lane of [0, 1]) {
            const x = lane === 0 ? 4 : 15
            const points = [{ x: 9.5, y: 28.5 }, { x, y: 25 }, { x, y: 18 },
              { x, y: 13 }, { x, y: 6 }, { x: 9.5, y: 2.5 }]
              .map(t => { const p = fromTile(t); return toScreen(p.x, p.y) })
            for (let i = 1; i < points.length; i++) {
              const a = points[i - 1]
              const b = points[i]
              const dx = b.x - a.x
              const dy = b.y - a.y
              const length = Math.hypot(dx, dy) || 1
              const nx = -dy / length
              const ny = dx / length
              const pieces = 8
              for (let j = 0; j < pieces; j++) {
                const t0 = j / pieces
                const t1 = (j + 1) / pieces
                const wobble0 = Math.sin((i * 11 + j * 1.7 + lane) * 1.8) * 5
                const wobble1 = Math.sin((i * 11 + (j + 1) * 1.7 + lane) * 1.8) * 5
                const from = { x: a.x + dx * t0 + nx * wobble0, y: a.y + dy * t0 + ny * wobble0 }
                const to = { x: a.x + dx * t1 + nx * wobble1, y: a.y + dy * t1 + ny * wobble1 }
                line(from, to, 0x303326, 23 + (j % 2), .62)
                line(from, to, lane === 0 ? 0x655d45 : 0x6b5747, 18 + (j % 2), .7)
                line(from, to, j % 2 ? 0x948762 : 0x817858, 1.2, .2)
              }
              for (const puddleT of [.28, .72]) {
                const wobble = Math.sin((i * 7 + puddleT * 9 + lane) * 1.4) * 4
                const px = a.x + dx * puddleT + nx * wobble
                const py = a.y + dy * puddleT + ny * wobble
                graphics.fillStyle(0x334344, .18)
                graphics.fillEllipse(px, py, 10 + ((i + lane) % 3) * 4, 3 + ((i + lane) % 2) * 1.5)
              }
            }
          }

          const fenceY = m.top + m.pitchHeight * .5
          const openings = [4, 15].map(lane => m.left + m.pitchWidth * (lane - .5) / 18)
          const openingWidth = m.pitchWidth * 3 / 18
          const fenceSegments: Array<[number, number]> = [
            [m.left, openings[0] - openingWidth / 2],
            [openings[0] + openingWidth / 2, openings[1] - openingWidth / 2],
            [openings[1] + openingWidth / 2, m.left + m.pitchWidth],
          ]
          for (const [from, to] of fenceSegments) {
            line({ x: from, y: fenceY }, { x: to, y: fenceY }, 0x101610, 10, .95)
            // Galvanized mesh: two crossing diagonal wire rows over the
            // darker rail, with visible horizontal tension wires.
            line({ x: from, y: fenceY - 8 }, { x: to, y: fenceY - 8 }, 0x9aa188, 1.3, .75)
            line({ x: from, y: fenceY }, { x: to, y: fenceY }, 0x6f7c6d, 1, .75)
            line({ x: from, y: fenceY + 8 }, { x: to, y: fenceY + 8 }, 0x596b59, 1.3, .8)
            for (let x = from - 14; x < to + 14; x += 12) {
              line({ x, y: fenceY - 9 }, { x: x + 18, y: fenceY + 9 }, 0x87947b, 1, .58)
              line({ x: x + 18, y: fenceY - 9 }, { x, y: fenceY + 9 }, 0x303d32, 1, .62)
            }
            for (let x = from + 14; x < to; x += 22) {
              line({ x, y: fenceY - 13 }, { x, y: fenceY + 13 }, 0x4c5b4b, 4, .95)
              line({ x: x - 2, y: fenceY - 13 }, { x: x + 2, y: fenceY - 13 }, 0xb0ad88, 1, .7)
            }
            // Two strands of barbed wire above the mesh.
            line({ x: from, y: fenceY - 15 }, { x: to, y: fenceY - 15 }, 0x202a22, 2.2, .95)
            line({ x: from, y: fenceY - 19 }, { x: to, y: fenceY - 19 }, 0x78816d, 1.4, .85)
            for (let x = from + 18; x < to - 4; x += 28) {
              line({ x: x - 5, y: fenceY - 18 }, { x, y: fenceY - 24 }, 0xb5aa7b, 1.4, .9)
              line({ x, y: fenceY - 24 }, { x: x + 5, y: fenceY - 18 }, 0xb5aa7b, 1.4, .9)
              line({ x: x - 4, y: fenceY - 14 }, { x, y: fenceY - 20 }, 0x8f8665, 1, .8)
              line({ x, y: fenceY - 20 }, { x: x + 4, y: fenceY - 14 }, 0x8f8665, 1, .8)
            }
          }
          for (const opening of openings) {
            graphics.fillStyle(0x8e7047, 1)
            graphics.fillRect(opening - openingWidth / 2, fenceY - 10, openingWidth, 20)
            for (let x = opening - openingWidth / 2 + 6; x < opening + openingWidth / 2; x += 10) {
              line({ x, y: fenceY - 9 }, { x: x + 8, y: fenceY + 9 }, 0xd3b77d, 2, .75)
            }
          }

        }

        const drawBuilding = (building: typeof buildings[number]) => {
          const hp = gameRef.current.hp[building.key]
          const activated = gameRef.current.hp[`${building.side}PubOne`] <= 0 ||
            gameRef.current.hp[`${building.side}PubTwo`] <= 0
          const at = toScreen(building.x, building.y)
          const fortressArt = building.key.includes('Fortress')
          const shot = gameRef.current.flares.find(flare => flare.source === building.key)
          const firing = !!shot && shot.age + stateAge < .18
          const artKey = !fortressArt && firing ? `pub-throw-${displaySide(building.side)}-${artHealth(hp, building.max)}` :
            `club-${displaySide(building.side)}-${fortressArt}-false-${artHealth(hp, building.max)}`
          if (showArt(building.key,
            artKey,
            // Rubble is ground decoration, never part of the actor depth sort.
            // Ground: 0, rubble: .4, puddles: .5, actors: 1–2, airborne FX: 5.
            at, false, 1, hp <= 0 ? .4 : 1 + at.y / this.scale.height)) {
            if (fortressArt && activated && hp > 0) {
              const enemy = shot ?? gameRef.current.units.filter(u => u.side !== building.side && u.hp > 0)
                .sort((a, b) => Math.hypot(a.x - building.x, a.y - building.y) - Math.hypot(b.x - building.x, b.y - building.y))[0]
              const end = enemy ? toScreen(enemy.x, enemy.y) : { x: at.x, y: at.y + (building.side === perspectiveRef.current ? -100 : 100) }
              const angle = Math.atan2(end.y - 12 - (at.y - 61.47), end.x - at.x - 1.48)
              const aim = (Math.round(angle / (Math.PI / 4)) + 8) % 8
              showArt(`${building.key}-guard`, `gatling-${displaySide(building.side)}-${aim}-${firing}`,
                at, false, 1, 1.001 + at.y / this.scale.height)
            }
            healthBar(at, hp, building.max, building.side, 36)
            return
          }
          if (hp <= 0) return
          const p = toScreen(building.x, building.y)
          const fortress = building.key.includes('Fortress')
          const width = fortress ? 48 : 36
          const height = fortress ? 34 : 28
          const color = displaySide(building.side) === 'blue' ? BLUE : RED
          const roofY = p.y - height / 2 - 10
          polygon([
            { x: p.x, y: roofY - 9 },
            { x: p.x + width / 2, y: roofY },
            { x: p.x, y: roofY + 9 },
            { x: p.x - width / 2, y: roofY },
          ], 0x252f2c, .98)
          polygon([
            { x: p.x - width / 2, y: p.y - height / 2 },
            { x: p.x, y: p.y - height / 2 + 9 },
            { x: p.x, y: p.y + height / 2 },
            { x: p.x - width / 2, y: p.y + height / 2 - 9 },
          ], 0x67665a, 1, 0x242d27)
          polygon([
            { x: p.x, y: p.y - height / 2 + 9 },
            { x: p.x + width / 2, y: p.y - height / 2 },
            { x: p.x + width / 2, y: p.y + height / 2 - 9 },
            { x: p.x, y: p.y + height / 2 },
          ], 0x414b43, 1, 0x242d27)
          graphics.fillStyle(color, 1)
          graphics.fillRect(p.x - width / 2 + 3, p.y - 3, width - 6, 7)
          graphics.lineStyle(1, 0x8a8d78, .45)
          for (let i = -1; i <= 1; i++) line({ x: p.x - width / 2 + 5, y: p.y + i * 7 }, { x: p.x + width / 2 - 5, y: p.y + i * 7 }, 0x242d27, 1, .45)
          graphics.fillStyle(0xc7a665, 1)
          graphics.fillRect(p.x - width / 2 + 5, p.y - 3, 7, 9)
          graphics.fillRect(p.x + width / 2 - 12, p.y - 4, 7, 10)
          if (!fortress) {
            graphics.fillStyle(displaySide(building.side) === 'blue' ? 0xd8c77e : 0xd08b50, 1)
            graphics.fillRect(p.x - 13, p.y - height / 2 - 15, 26, 10)
            graphics.fillStyle(DARK, .8)
            graphics.fillRect(p.x - 9, p.y - height / 2 - 12, 18, 2)
          }
          graphics.fillStyle(DARK, .8)
          graphics.fillRect(p.x - 18, p.y + height / 2 + 5, 36, 3)
          graphics.fillStyle(color, 1)
          graphics.fillRect(p.x - 18, p.y + height / 2 + 5, 36 * hp / building.max, 3)
          graphics.lineStyle(1.5, 0xa8a794, .9)
          line({ x: p.x, y: roofY - 8 }, { x: p.x, y: roofY - 29 }, 0xa8a794, 1.5, .9)
          graphics.fillStyle(color, 1)
          graphics.fillTriangle(p.x, roofY - 29, p.x + 14, roofY - 24, p.x, roofY - 19)
        }

        const drawUltra = (unit: Game['units'][number], ghost = false) => {
          const p = toScreen(unit.x, unit.y)
          const scale = .72
          const point = (x: number, y: number): Point => ({ x: p.x + x * scale, y: p.y + y * scale })
          const shape = (points: Array<[number, number]>, fill: number, alpha = 1, stroke = DARK) =>
            polygon(points.map(([x, y]) => point(x, y)), fill, alpha, stroke)
          const stroke = (a: [number, number], b: [number, number], color: number, width: number, alpha = 1) =>
            line(point(a[0], a[1]), point(b[0], b[1]), color, width * scale, alpha)
          const team = displaySide(unit.side) === 'blue' ? BLUE : RED
          const opacity = ghost ? .48 : 1
          const skin = displaySide(unit.side) === 'blue' ? 0xc39170 : 0xa9795d
          const jersey = 0x273134
          const scarf = displaySide(unit.side) === 'blue' ? 0x5baaa0 : 0xc46249
          const phase = animationClock * .012 + unit.id * .7
          const movement = unit.moving ? 1 : .22
          const legSwing = Math.sin(phase) * 11 * movement
          const armSwing = Math.sin(phase + Math.PI) * 6 * movement
          const distanceTo = (a: { x: number; y: number }, b: { x: number; y: number }) =>
            Math.hypot(a.x - b.x, a.y - b.y)
          const target = gameRef.current.units.find(other =>
            other.id === unit.targetId && other.side !== unit.side && other.hp > 0)
          const enemyStructureInRange = gameRef.current.structures.some(structure =>
            structure.side !== unit.side && structure.hp > 0 && distanceTo(unit, structure) <= unit.card.range + 1)
          const enemyBuildingInRange = buildings.some(building =>
            building.side !== unit.side &&
            gameRef.current.hp[building.key] > 0 &&
            distanceTo(unit, building) <= unit.card.range + 8)
          const punching = unit.card.range <= 4 && (
            (!!target && distanceTo(unit, target) <= unit.card.range + 1) ||
            enemyStructureInRange ||
            enemyBuildingInRange
          )
          const punch = punching ? Math.max(0, Math.sin(animationClock * .024 + unit.id)) : 0
          const focus = target ??
            gameRef.current.structures.find(structure => structure.side !== unit.side && structure.hp > 0) ??
            buildings.find(building => building.side !== unit.side && gameRef.current.hp[building.key] > 0)
          const focusScreen = focus ? toScreen(focus.x, focus.y) : undefined
          const forward = focusScreen && Math.abs(focusScreen.y - p.y) > 1
            ? (focusScreen.y < p.y ? -1 : 1)
            : (unit.side === 'blue' ? -1 : 1)
          const back = unit.facingBack || (unit.side === 'red' && unit.moving)

          // The Ultra is intentionally drawn as a chunky, readable game
          // silhouette rather than another circular unit marker.
          graphics.fillStyle(0x080d0c, .52 * opacity)
          graphics.fillEllipse(p.x, p.y + 13 * scale, 31 * scale, 8 * scale)
          shape([
            [-9, 5 + legSwing], [-4, 5 - legSwing], [-6, 16], [-13, 17], [-10, 12],
          ], 0x202626, opacity)
          shape([
            [3, 5 - legSwing], [9, 4 + legSwing], [13, 15], [7, 17], [1, 11],
          ], 0x202626, opacity)

          // Shoulders, raised arms and clenched fists.
          shape([
            [-12, -19], [-21, -12 + armSwing], [-23, -3 + armSwing],
            [-18, -1 + armSwing], [-11, -10],
          ], skin, opacity)
          shape([
            [12, -19], [18 + punch * 5, -12 - armSwing + forward * punch * 9],
            [20 + punch * 8, -3 - armSwing + forward * punch * 15],
            [16 + punch * 6, -1 - armSwing + forward * punch * 13], [11, -10],
          ], skin, opacity)
          stroke([-17, -7 + armSwing], [-20, -2 + armSwing], 0x8b5948, 1.2, opacity)
          stroke([17 + punch * 4, -7 - armSwing + forward * punch * 8],
            [20 + punch * 8, -2 - armSwing + forward * punch * 13], 0x8b5948, 1.2, opacity)
          graphics.fillStyle(skin, opacity)
          const leftFist = point(-19, -2 + armSwing)
          const rightFist = point(19 + punch * 8, -2 - armSwing + forward * punch * 15)
          graphics.fillCircle(leftFist.x, leftFist.y, 4 * scale)
          graphics.fillCircle(rightFist.x, rightFist.y, 4 * scale)

          // Athletic sleeveless vest with broad shoulders and a narrow waist.
          shape([
            [-13, -19], [-8, -25], [8, -25], [13, -19],
            [9, 7], [0, 11], [-10, 7],
          ], jersey, opacity)
          if (!back) {
            stroke([-9, -19], [-6, -12], skin, 2.2, opacity)
            stroke([9, -19], [6, -12], skin, 2.2, opacity)
            graphics.fillStyle(scarf, opacity)
            graphics.fillRect(p.x - 11 * scale, p.y - 13 * scale, 22 * scale, 6 * scale)
            graphics.fillStyle(0xd0c18e, .8 * opacity)
            graphics.fillRect(p.x - 8 * scale, p.y - 12 * scale, 3 * scale, 4 * scale)
            graphics.fillRect(p.x + 5 * scale, p.y - 12 * scale, 3 * scale, 4 * scale)
            stroke([-7, -4], [7, -4], 0x93958a, 1, .65 * opacity)
            stroke([0, -7], [0, 7], 0x93958a, 1, .55 * opacity)
          }

          // Short black hair and a scarred front. The back stays clean and
          // only shows the rear of the head and hair.
          graphics.fillStyle(skin, opacity)
          graphics.fillCircle(p.x, p.y - 31 * scale, 13 * scale)
          graphics.lineStyle(1.5 * scale, DARK, opacity)
          graphics.strokeCircle(p.x, p.y - 31 * scale, 13 * scale)
          shape([
            [-11, -34], [-10, -41], [-5, -45], [3, -45], [10, -41],
            [11, -34], [10, -28], [6, -26], [-5, -26], [-10, -29],
          ], 0x15191a, opacity, DARK)
          if (!back) {
            stroke([-7, -41], [-4, -45], 0x3d4540, 1, .8 * opacity)
            stroke([0, -43], [3, -45], 0x3d4540, 1, .8 * opacity)
          }
          if (back) {
            shape([
              [-11, -35], [-10, -29], [-8, -24], [-4, -26], [-3, -35],
              [4, -35], [5, -26], [9, -24], [11, -30], [11, -35],
            ], 0x15191a, opacity, DARK)
          } else {
            const leftEye = point(-5, -30)
            const rightEye = point(5, -30)
            graphics.fillStyle(0xf1dfbd, opacity)
            graphics.fillCircle(leftEye.x, leftEye.y, 2.1 * scale)
            graphics.fillCircle(rightEye.x, rightEye.y, 2.1 * scale)
            graphics.fillStyle(DARK, opacity)
            graphics.fillCircle(leftEye.x, leftEye.y, .9 * scale)
            graphics.fillCircle(rightEye.x, rightEye.y, .9 * scale)
            stroke([-7, -33], [-2, -35], 0x070f12, 1.8, opacity)
            stroke([2, -35], [7, -33], 0x070f12, 1.8, opacity)
            stroke([-6, -25], [6, -25], 0x070f12, 2.8, opacity)
            stroke([-3, -24], [0, -22], 0xd04a3f, 1.4, opacity)
            stroke([-8, -39], [-2, -42], 0xe3b18f, 1.2, .6 * opacity)
            stroke([2, -42], [8, -39], 0xe3b18f, 1.1, .5 * opacity)
            stroke([-10, -31], [-6, -27], 0x794936, 2.1, opacity)
            stroke([8, -29], [5, -24], 0x794936, 1.9, opacity)
          }
        }

        const drawUnit = (unit: Game['units'][number], ghost = false) => {
          const p = toScreen(unit.x, unit.y)
          const index = cards.findIndex(card => card.name === unit.card.name)
          // facingBack is side-relative in the simulation; convert to camera space.
          const back = ghost ? true : unit.side === perspectiveRef.current ? unit.facingBack : !unit.facingBack
          const pose = ghost ? 0 : unit.moving ? 1 + Math.floor(animationClock / 160 + unit.id) % 2 :
            unit.cooldown > unit.card.rate - .2 ? 3 : 0
          if (showArt(ghost ? 'preview' : `unit-${unit.id}`,
            `fan-${index}-${displaySide(unit.side)}-${back}-${pose}`, p, true, ghost ? .48 : 1,
            ghost ? 9 : 1 + p.y / this.scale.height)) {
            if (!ghost) healthBar(p, unit.hp, unit.card.hp, unit.side, 24, -48)
            return
          }
          const color = displaySide(unit.side) === 'blue' ? BLUE : RED
          const radius = unit.card.name === 'Flitzer' ? 11 : 8
          if (unit.card.name === 'Der Ultra') drawUltra(unit, ghost)
          else {
            graphics.fillStyle(0x080d0c, .5)
            graphics.fillEllipse(p.x, p.y + 8, radius * 2.7, 7)
            graphics.fillStyle(cardColor(unit.card), ghost ? .45 : 1)
            graphics.fillCircle(p.x, p.y, radius)
            graphics.fillStyle(color, ghost ? .45 : 1)
            graphics.fillCircle(p.x, p.y - radius * .65, radius * .58)
            graphics.lineStyle(1.5, DARK, .9)
            graphics.strokeCircle(p.x, p.y, radius)
          }
          graphics.fillStyle(DARK, .8)
          const barWidth = unit.card.name === 'Der Ultra' ? 24 : 20
           const barY = unit.card.name === 'Der Ultra' ? -48 : -22
          graphics.fillRect(p.x - barWidth / 2, p.y + barY, barWidth, 3)
          graphics.fillStyle(color, ghost ? .5 : 1)
           graphics.fillRect(p.x - barWidth / 2, p.y + barY, barWidth * Math.max(0, unit.hp / unit.card.hp), 3)
         }
        const drawSpawnIndicator = (unit: Game['units'][number]) => {
          const remaining = unit.spawnDelay ?? 0
          if (remaining <= 0) return
          const duration = unit.spawnDuration ?? .48
          const progress = Math.max(0, Math.min(1, remaining / Math.max(.16, duration)))
          const p = toScreen(unit.x, unit.y)
          const radius = unit.card.name === 'Der Ultra' ? 25 : unit.card.name === 'Flitzer' ? 18 : 15
          const pulse = 1 + Math.sin(animationClock * .012 + unit.id) * .06
          const teamColor = displaySide(unit.side) === 'blue' ? BLUE : RED
          spawnIndicators.lineStyle(1, teamColor, .22)
          spawnIndicators.strokeCircle(p.x, p.y, radius * pulse)
          spawnIndicators.lineStyle(4, 0xe4d09a, .95)
          if (progress > .001) {
            const segments = 32
            const filledSegments = Math.ceil(segments * progress)
            for (let i = 0; i < filledSegments; i++) {
              const start = -Math.PI / 2 + Math.PI * 2 * i / segments
              const end = -Math.PI / 2 + Math.PI * 2 * Math.min(i + 1, segments * progress) / segments
              spawnIndicators.lineBetween(
                p.x + Math.cos(start) * radius * pulse,
                p.y + Math.sin(start) * radius * pulse,
                p.x + Math.cos(end) * radius * pulse,
                p.y + Math.sin(end) * radius * pulse,
              )
            }
          }
          spawnIndicators.fillStyle(0x101815, .8)
          spawnIndicators.fillCircle(p.x, p.y, 2.5)
        }

        const drawEffects = () => {
          const current = gameRef.current
          for (const stain of current.bloodStains) {
            const p = toScreen(stain.x, stain.y)
            const fade = Math.max(0, 1 - stain.age / 3.2)
            graphics.fillStyle(0x651f25, .62 * fade)
            graphics.fillEllipse(p.x, p.y + 4, 17 + stain.age * 3, 7 + stain.age * 1.2)
            graphics.fillStyle(0xa83a35, .45 * fade)
            graphics.fillCircle(p.x - 3, p.y + 2, 3)
            graphics.fillCircle(p.x + 4, p.y + 3, 2)
          }
          for (const blood of current.blood) {
            const p = toScreen(blood.x, blood.y)
            const fade = Math.max(0, 1 - blood.age / .58)
            for (let i = 0; i < 5; i++) {
              const angle = -Math.PI * (.22 + i * .14)
              const distance = 8 + blood.age * (22 + i * 3)
              const particle = {
                x: p.x + Math.cos(angle) * distance + Math.sin(i * 4.2) * 3,
                y: p.y + Math.sin(angle) * distance - blood.age * blood.age * 18,
              }
              graphics.fillStyle(i % 2 ? 0x8f282d : 0xd14b3f, fade)
              graphics.fillCircle(particle.x, particle.y, Math.max(1, 2.6 - blood.age * 2))
            }
          }
          renderWeaponEffects(current, stateAge, animationClock / 1000)
        }

        const drawPlacement = () => {
          if (!activeRef.current || !hover) return
          const allowed = canDeploy(gameRef.current, selectedRef.current, hover.x, hover.y, perspectiveRef.current)
          const p = toScreen(hover.x, hover.y)
          const m = metrics()
          const tileWidth = m.pitchWidth / 18
          const tileHeight = m.pitchHeight / 32
          const footprintWidth = selectedRef.current.kind === 'building' ? tileWidth * 2 : tileWidth
          const footprintHeight = selectedRef.current.kind === 'building' ? tileHeight * 2 : tileHeight
          graphics.fillStyle(allowed ? 0x82f4c0 : 0xef6354, .22)
          graphics.fillRect(p.x - footprintWidth / 2, p.y - footprintHeight / 2, footprintWidth, footprintHeight)
          graphics.lineStyle(2, allowed ? 0xdfffe8 : 0xff9b8e, .8)
          graphics.strokeRect(p.x - footprintWidth / 2, p.y - footprintHeight / 2, footprintWidth, footprintHeight)
          if (selectedRef.current.kind === 'building') {
            showArt('preview', `stall-blue-${selectedRef.current.name === 'Würstchenbude' ? 'sausage' : 'beer'}-100`,
              p, false, .48, 9)
            return
          }
          if (selectedRef.current.kind === 'spell') return
          const ghost = { x: hover.x, y: hover.y } as Game['units'][number]
          ghost.card = selectedRef.current
          ghost.side = perspectiveRef.current
          ghost.hp = selectedRef.current.hp
          drawUnit(ghost, true)
        }

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
          if (pointer.isDown || draggingRef.current) pointerDown = true
          hover = fromPointer(pointer)
        })
        this.input.on('pointerdown', () => { pointerDown = true })
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (!activeRef.current) return
          const target = fromPointer(pointer)
          if (canDeploy(gameRef.current, selectedRef.current, target.x, target.y, perspectiveRef.current)) {
            onPlaceRef.current(target.x, target.y, draggingRef.current)
          }
          pointerDown = false
          hover = null
        })
        this.input.on('pointerout', () => {
          if (!draggingRef.current) {
            pointerDown = false
            hover = null
          }
        })
        const handleCardDragMove = (event: PointerEvent) => {
          if (!draggingRef.current) return
          const target = fromClientPointer(event)
          if (!target) {
            hover = null
            return
          }
          pointerDown = true
          hover = target
        }
        const handleCardDragEnd = (event: PointerEvent) => {
          if (!draggingRef.current || !pointerDown) return
          const target = fromClientPointer(event)
          if (target && activeRef.current && canDeploy(gameRef.current, selectedRef.current, target.x, target.y, perspectiveRef.current)) {
            onPlaceRef.current(target.x, target.y, true)
          }
          pointerDown = false
          hover = null
        }
        window.addEventListener('pointermove', handleCardDragMove)
        window.addEventListener('pointerup', handleCardDragEnd)
        window.addEventListener('pointercancel', handleCardDragEnd)
        scene.events.once('destroy', () => {
          window.removeEventListener('pointermove', handleCardDragMove)
          window.removeEventListener('pointerup', handleCardDragEnd)
          window.removeEventListener('pointercancel', handleCardDragEnd)
        })

        scene.renderArena = () => {
          usedSprites.clear()
          bars.clear()
          graphics.clear()
          drawAtmosphere()
          drawPitch()
          for (const building of buildings) drawBuilding(building)
          for (const structure of gameRef.current.structures) {
            const p = toScreen(structure.x, structure.y)
            showArt(`structure-${structure.id}`,
              `stall-${displaySide(structure.side)}-${structure.card.name === 'Würstchenbude' ? 'sausage' : 'beer'}-${artHealth(structure.hp, structure.max)}`,
              p, false, 1, structure.hp <= 0 ? .4 : 1 + p.y / this.scale.height)
            healthBar(p, structure.hp, structure.max, structure.side, 32)
          }
          spawnIndicators.clear()
          for (const unit of gameRef.current.units) {
            if (unit.hp <= 0) continue
            drawUnit(unit)
            drawSpawnIndicator(unit)
          }
          drawEffects()
          drawPlacement()
          drawPhaseAlert()
          for (const [id, sprite] of sprites) {
            if (!usedSprites.has(id)) {
              sprite.destroy()
              sprites.delete(id)
            }
          }
        }
        this.events.on(Phaser.Scenes.Events.UPDATE, (_time: number, delta: number) => {
          if (lastState !== gameRef.current) {
            lastState = gameRef.current
            stateAge = 0
          } else if (activeRef.current) stateAge = Math.min(.05, stateAge + delta / 1000)
          if (activeRef.current) animationClock += delta
          scene.renderArena?.()
        })
      }

      instance = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host.current,
        width: 800,
        height: 900,
        backgroundColor: '#18251b',
        render: { antialias: true, roundPixels: true },
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene,
      })
    })

    return () => {
      disposed = true
      instance?.destroy(true)
    }
  }, [])

  return <div ref={host} className="phaser-arena-host" aria-label="Phaser-Testarena" />
}
