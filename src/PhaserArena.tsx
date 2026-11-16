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

/**
 * First Phaser render pass. The simulation remains in game.ts; this scene is
 * intentionally small so the renderer can be migrated independently from the
 * React shell and the existing SVG arena.
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
      const text = this.add.text(0, 0, '', {
        color: '#dfe7b0',
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '12px',
      })

      const point = (pointer: PhaserType.Input.Pointer) => {
        const width = this.scale.width
        const height = this.scale.height
        const left = Math.max(18, width * .08)
        const top = 18
        const pitchWidth = width - left * 2
        const pitchHeight = height - 36
        const lane = Phaser.Math.Clamp((pointer.x - left) / pitchWidth * 100, 0, 100)
        const depth = Phaser.Math.Clamp((pointer.y - top) / pitchHeight * 100, 0, 100)
        const x = perspectiveRef.current === 'red' ? 100 - depth : depth
        return { x, y: lane }
      }

      this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (!activeRef.current) return
        const target = point(pointer)
        if (canDeploy(gameRef.current, selectedRef.current, target.x, target.y, perspectiveRef.current)) {
          onPlaceRef.current(target.x, target.y, false)
        }
      })

      scene.renderArena = () => {
        const current = gameRef.current
        const width = this.scale.width
        const height = this.scale.height
        const left = Math.max(18, width * .08)
        const top = 18
        const pitchWidth = width - left * 2
        const pitchHeight = height - 36
        const toScreen = (x: number, y: number) => ({
          x: left + y / 100 * pitchWidth,
          y: top + (perspectiveRef.current === 'red' ? x / 100 : (100 - x) / 100) * pitchHeight,
        })

        graphics.clear()
        graphics.fillStyle(0x18251b, 1)
        graphics.fillRect(0, 0, width, height)
        graphics.fillStyle(0x465b3d, 1)
        graphics.fillRoundedRect(left, top, pitchWidth, pitchHeight, 8)
        graphics.lineStyle(2, 0xcbd782, .7)
        graphics.strokeRoundedRect(left, top, pitchWidth, pitchHeight, 8)
        graphics.fillStyle(0x263c37, .9)
        graphics.fillRect(left + pitchWidth * .44, top, pitchWidth * .12, pitchHeight)
        graphics.lineStyle(2, 0xd5c98d, .5)
        graphics.lineBetween(left + pitchWidth * .5, top, left + pitchWidth * .5, top + pitchHeight)

        for (const building of buildings) {
          if (current.hp[building.key] <= 0) continue
          const position = toScreen(building.x, building.y)
          const fortress = building.key.includes('Fortress')
          graphics.fillStyle(building.side === 'blue' ? 0x5baaa0 : 0xc46249, 1)
          graphics.fillRoundedRect(position.x - (fortress ? 22 : 15), position.y - 12, fortress ? 44 : 30, 24, 4)
          graphics.lineStyle(2, 0xe7dfb4, .8)
          graphics.strokeRoundedRect(position.x - (fortress ? 22 : 15), position.y - 12, fortress ? 44 : 30, 24, 4)
        }

        for (const unit of current.units) {
          if (unit.hp <= 0) continue
          const position = toScreen(unit.x, unit.y)
          graphics.fillStyle(unit.side === 'blue' ? 0x64c9bd : 0xe9754e, 1)
          graphics.fillCircle(position.x, position.y, 8)
          graphics.lineStyle(1, 0x101815, 1)
          graphics.strokeCircle(position.x, position.y, 8)
          graphics.fillStyle(0x101815, 1)
          graphics.fillRect(position.x - 9, position.y + 11, 18, 2)
          graphics.fillStyle(unit.side === 'blue' ? 0x9be7c9 : 0xffa07c, 1)
          graphics.fillRect(position.x - 9, position.y + 11, 18 * Math.max(0, unit.hp / unit.card.hp), 2)
        }

        text.setPosition(10, 8)
        text.setText(`PHASER · ${current.units.length} Einheiten · ${current.time.toFixed(1)}s`)
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
