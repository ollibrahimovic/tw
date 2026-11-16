import { useEffect, useRef } from 'react'
import type PhaserType from 'phaser'
import { buildings, canDeploy } from './game'
import type { Card, Game, Side } from './game'

type PhaserArenaProps = {
  game: Game
  selectedCard: Card
  active: boolean
  perspective?: Side
  onPlace: (x: number, y: number, drop: boolean) => void
}

type ArenaScene = PhaserType.Scene & {
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
export function PhaserArena({ game, selectedCard, active, perspective = 'blue', onPlace }: PhaserArenaProps) {
  const host = useRef<HTMLDivElement>(null)
  const gameRef = useRef(game)
  const selectedRef = useRef(selectedCard)
  const activeRef = useRef(active)
  const perspectiveRef = useRef(perspective)
  const onPlaceRef = useRef(onPlace)

  gameRef.current = game
  selectedRef.current = selectedCard
  activeRef.current = active
  perspectiveRef.current = perspective
  onPlaceRef.current = onPlace

  useEffect(() => {
    if (!host.current) return

    let instance: PhaserType.Game | undefined
    let disposed = false
    void import('phaser').then(({ default: Phaser }) => {
      if (disposed || !host.current) return

      const scene = new Phaser.Scene('TerraceWarsArena') as ArenaScene
      scene.create = function () {
        const graphics = this.add.graphics()
        const label = this.add.text(0, 0, '', {
          color: '#dfe7b0',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '12px',
        }).setDepth(20)
        let hover: Point | null = null

        const metrics = () => {
          const width = this.scale.width
          const height = this.scale.height
          const left = Math.max(18, width * .08)
          return { width, height, left, top: 18, pitchWidth: width - left * 2, pitchHeight: height - 36 }
        }

        const toScreen = (x: number, y: number): Point => {
          const m = metrics()
          const depth = perspectiveRef.current === 'red' ? 100 - x : x
          return {
            x: m.left + y / 100 * m.pitchWidth,
            y: m.top + (100 - depth) / 100 * m.pitchHeight,
          }
        }

        const fromPointer = (pointer: Phaser.Input.Pointer): Point => {
          const m = metrics()
          const lane = Phaser.Math.Clamp((pointer.x - m.left) / m.pitchWidth * 100, 0, 100)
          const depth = Phaser.Math.Clamp(100 - (pointer.y - m.top) / m.pitchHeight * 100, 0, 100)
          return { x: perspectiveRef.current === 'red' ? 100 - depth : depth, y: lane }
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
          graphics.lineStyle(2, CREAM, .7)
          graphics.strokeRoundedRect(m.left, m.top, m.pitchWidth, m.pitchHeight, 8)

          for (let i = 1; i < 12; i++) {
            const y = m.top + m.pitchHeight * i / 12
            line({ x: m.left, y }, { x: m.left + m.pitchWidth, y }, 0x17251b, 1, .22)
          }

          const canalLeft = m.left + m.pitchWidth * .44
          const canalWidth = m.pitchWidth * .12
          graphics.fillStyle(0x1d3937, .95)
          graphics.fillRect(canalLeft, m.top, canalWidth, m.pitchHeight)
          for (const bridgeY of [.31, .66]) {
            graphics.fillStyle(0x8e7047, 1)
            graphics.fillRect(canalLeft - 8, m.top + m.pitchHeight * bridgeY - 12, canalWidth + 16, 24)
            line(
              { x: canalLeft - 8, y: m.top + m.pitchHeight * bridgeY - 12 },
              { x: canalLeft + canalWidth + 8, y: m.top + m.pitchHeight * bridgeY + 12 },
              0xd3b77d, 1, .7,
            )
          }
          line({ x: canalLeft + canalWidth / 2, y: m.top }, { x: canalLeft + canalWidth / 2, y: m.top + m.pitchHeight }, 0x9bc0a3, 1, .3)

          for (const laneY of [13, 22, 74, 83]) {
            const start = toScreen(100, laneY)
            const end = toScreen(0, laneY)
            line(start, end, 0x172018, 18, .9)
            line(start, end, laneY < 50 ? 0x849d77 : 0x907964, 11, .8)
          }
        }

        const drawBuilding = (building: typeof buildings[number]) => {
          const hp = gameRef.current.hp[building.key]
          if (hp <= 0) return
          const p = toScreen(building.x, building.y)
          const fortress = building.key.includes('Fortress')
          const width = fortress ? 44 : 32
          const height = fortress ? 32 : 25
          const color = building.side === 'blue' ? BLUE : RED
          polygon([
            { x: p.x, y: p.y - height / 2 - 9 },
            { x: p.x + width / 2, y: p.y - height / 2 },
            { x: p.x, y: p.y - height / 2 + 9 },
            { x: p.x - width / 2, y: p.y - height / 2 },
          ], 0x303931, .98)
          graphics.fillStyle(color, 1)
          graphics.fillRoundedRect(p.x - width / 2, p.y - height / 2, width, height, 4)
          graphics.lineStyle(2, CREAM, .75)
          graphics.strokeRoundedRect(p.x - width / 2, p.y - height / 2, width, height, 4)
          graphics.fillStyle(DARK, .8)
          graphics.fillRect(p.x - 18, p.y + height / 2 + 5, 36, 3)
          graphics.fillStyle(color, 1)
          graphics.fillRect(p.x - 18, p.y + height / 2 + 5, 36 * hp / building.max, 3)
          graphics.fillStyle(color, 1)
          graphics.fillTriangle(p.x, p.y - height / 2 - 12, p.x + 14, p.y - height / 2 - 7, p.x, p.y - height / 2 - 3)
        }

        const drawUnit = (unit: Game['units'][number], ghost = false) => {
          const p = toScreen(unit.x, unit.y)
          const color = unit.side === 'blue' ? BLUE : RED
          const radius = unit.card.name === 'Flitzer' ? 11 : 8
          graphics.fillStyle(0x080d0c, .5)
          graphics.fillEllipse(p.x, p.y + 8, radius * 2.7, 7)
          graphics.fillStyle(cardColor(unit.card), ghost ? .45 : 1)
          graphics.fillCircle(p.x, p.y, radius)
          graphics.fillStyle(color, ghost ? .45 : 1)
          graphics.fillCircle(p.x, p.y - radius * .65, radius * .58)
          graphics.lineStyle(1.5, DARK, .9)
          graphics.strokeCircle(p.x, p.y, radius)
          graphics.fillStyle(DARK, .8)
          graphics.fillRect(p.x - 10, p.y + 13, 20, 3)
          graphics.fillStyle(color, ghost ? .5 : 1)
          graphics.fillRect(p.x - 10, p.y + 13, 20 * Math.max(0, unit.hp / unit.card.hp), 3)
        }

        const drawEffects = () => {
          const current = gameRef.current
          for (const flare of current.flares) {
            const source = buildings.find(building => building.key === flare.source)
            if (!source) continue
            const start = toScreen(source.x, source.y)
            const end = toScreen(flare.x, flare.y)
            const progress = Phaser.Math.Clamp(flare.age / .65, 0, 1)
            const p = {
              x: start.x + (end.x - start.x) * progress,
              y: start.y + (end.y - start.y) * progress - 28 * Math.sin(Math.PI * progress),
            }
            graphics.fillStyle(0xffbd62, 1)
            graphics.fillCircle(p.x, p.y, 5)
            line({ x: p.x - 10, y: p.y + 6 }, p, 0xe89b64, 2, .65)
          }
          for (const impact of current.impacts) {
            const p = toScreen(impact.x, impact.y)
            const radius = 8 + impact.age * 38
            graphics.lineStyle(2, 0xffcf80, Math.max(0, 1 - impact.age / .45))
            graphics.strokeCircle(p.x, p.y, radius)
          }
        }

        const drawPlacement = () => {
          if (!activeRef.current || !hover) return
          const allowed = canDeploy(gameRef.current, selectedRef.current, hover.x, hover.y, perspectiveRef.current)
          const p = toScreen(hover.x, hover.y)
          graphics.fillStyle(allowed ? 0x82f4c0 : 0xef6354, .22)
          graphics.fillRect(p.x - 16, p.y - 16, 32, 32)
          graphics.lineStyle(2, allowed ? 0xdfffe8 : 0xff9b8e, .8)
          graphics.strokeRect(p.x - 16, p.y - 16, 32, 32)
          const ghost = { x: hover.x, y: hover.y } as Game['units'][number]
          ghost.card = selectedRef.current
          ghost.side = perspectiveRef.current
          ghost.hp = selectedRef.current.hp
          drawUnit(ghost, true)
        }

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
          hover = fromPointer(pointer)
        })
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (!activeRef.current) return
          const target = fromPointer(pointer)
          if (canDeploy(gameRef.current, selectedRef.current, target.x, target.y, perspectiveRef.current)) {
            onPlaceRef.current(target.x, target.y, false)
          }
        })

        scene.renderArena = () => {
          graphics.clear()
          drawPitch()
          for (const building of buildings) drawBuilding(building)
          for (const unit of gameRef.current.units) if (unit.hp > 0) drawUnit(unit)
          drawEffects()
          drawPlacement()
          label.setPosition(10, 8).setText(`PHASER · ${gameRef.current.units.length} Einheiten · ${gameRef.current.time.toFixed(1)}s`)
        }
        this.events.on(Phaser.Scenes.Events.UPDATE, () => scene.renderArena?.())
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
