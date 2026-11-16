import { renderToStaticMarkup } from 'react-dom/server'
import type Phaser from 'phaser'
import { BeerStall, Club, Fan, Flitzer, GatlingGuard } from './Arena'
import { cards } from './game'
import type { ReactNode } from 'react'

// Rasterized once at load time; gameplay uses GPU textures, not SVG DOM nodes.
export function loadArenaArt(scene: Phaser.Scene) {
  const add = (key: string, art: ReactNode, character: boolean, pose = 0) => {
    const step = pose === 1 ? 12 : pose === 2 ? -12 : 0
    const css = `
      .iso-club > rect,.iso-club > text,.beer-stall > rect {display:none}
      .fan-back .balaclava-head,.fan-back .scarred-head,.fan-back .beanie-head {display:none}
      .leg-left,.flitzer-leg-left {transform:rotate(${step}deg);transform-origin:-7px -14px}
      .leg-right,.flitzer-leg-right {transform:rotate(${-step}deg);transform-origin:7px -14px}
      .arm-left {transform:rotate(${-step}deg);transform-origin:-14px -28px}
      .arm-right {transform:rotate(${pose === 3 ? -65 : step}deg);transform-origin:14px -28px}
      .fan-attacking .fan-arms {transform:translate(0,-5px)}
      .beer-arm,.pyro-arm {transform:rotate(${pose === 3 ? -55 : 0}deg);transform-origin:12px -33px}
      .fan-attacking .held-beer,.fan-attacking .held-torch {opacity:0}
      .fire-left {transform:rotate(${pose === 2 ? 12 : -8}deg)}
      .fire-right {transform:rotate(${pose === 1 ? -14 : 7}deg)}
    `
    const svg = renderToStaticMarkup(
      <svg xmlns="http://www.w3.org/2000/svg" width={character ? 192 : 360}
        height={character ? 240 : 480} viewBox={character ? '-48 -96 96 120' : '-90 -190 180 240'}>
        <style>{css}</style>{art}
      </svg>,
    )
    const bytes = new TextEncoder().encode(svg)
    scene.load.svg(key, `data:image/svg+xml;base64,${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`)
  }
  for (const side of ['blue', 'red'] as const) {
    for (let aim = 0; aim < 8; aim++) for (const firing of [false, true]) {
      add(`gatling-${side}-${aim}-${firing}`,
        <g transform="scale(1.32)"><GatlingGuard side={side} throwing={firing} aimAngle={aim * 45} /></g>, false)
    }
    for (const [index, card] of cards.entries()) {
      if (card.kind === 'spell' || card.kind === 'building') continue
      for (const back of [false, true]) for (let pose = 0; pose < 4; pose++) {
        add(`fan-${index}-${side}-${back}-${pose}`,
          card.name === 'Flitzer' ? <Flitzer side={side} back={back} /> :
            <Fan card={card} side={side} back={back} fighting={pose === 3} />, true, pose)
      }
    }
    for (const hp of [100, 60, 25, 0]) {
      for (const fortress of [false, true]) for (const activated of [false, true]) {
        add(`club-${side}-${fortress}-${activated}-${hp}`,
          <Club side={side} fortress={fortress} hp={hp} max={100}
            activated={activated} throwing={false} aimAngle={0} />, false)
      }
      add(`pub-throw-${side}-${hp}`,
        <Club side={side} fortress={false} hp={hp} max={100}
          activated={false} throwing={true} aimAngle={0} />, false, 3)
      for (const kind of ['beer', 'sausage'] as const) {
        add(`stall-${side}-${kind}-${hp}`,
          <BeerStall side={side} kind={kind} hp={hp} max={100} />, false)
      }
    }
  }
}

export const artHealth = (hp: number, max: number) => hp <= 0 ? 0 : hp / max < .35 ? 25 : hp / max < .7 ? 60 : 100
