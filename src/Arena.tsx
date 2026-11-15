import { memo, useRef, useState } from 'react'
import { buildings, canDeploy, cards, laneRoute, FLARE_FLIGHT, FLARE_INTERVAL, GATLING_INTERVAL, BEER_FLIGHT, PUDDLE_LIFETIME, TORCH_FLIGHT, FIRE_LIFETIME, BLOOD_STAIN_LIFETIME, SPELL_FLIGHT } from './game'
import type { Card, Game, Side } from './game'
import './pyro.css'

// Native vertical Clash-style camera: game X is match depth, game Y is the lane.
// Rectangular pitch aligned to the 32px placement grid (12 columns, 26 rows).
const baseProject = (x: number, y: number) => ({ x: 192 + 3.84 * y, y: 1024 - 8.32 * x })
// Legacy horizontal scene kept for reference while the native vertical scene is active.
const groundMatrix = 'matrix(6.3 -1.3 3.15 2.6 125 285)'
const noise = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n) }

function BeerCup() {
  return <g className="beer-cup" strokeLinejoin="round">
    <path d="M-7-10 7-10 5 9-5 9Z" fill="#e5e6c9" fillOpacity=".75" stroke="#f3e8c7" strokeWidth="1.2" />
    <path d="M-5.7-5 5.7-5 4 8-4 8Z" fill="#d99720" stroke="#956220" strokeWidth=".7" />
    <path d="M-4-3-3 5 M3-3 2 5" stroke="#f9d76f" strokeWidth="1" opacity=".8" />
    <path d="M-7-10Q-8-14-4-13Q-2-17 1-13Q5-16 7-12L7-7Q3-6 0-8Q-4-6-7-8Z" fill="#fff1d4" stroke="#cbb997" strokeWidth=".8" />
    <ellipse cy="-10" rx="6.5" ry="1.5" fill="#fff9e8" stroke="none" />
    <path d="M-1-6V-2" stroke="#fff3d4" strokeWidth="2" strokeLinecap="round" />
    <rect x="-3.5" y="0" width="7" height="4" rx=".5" fill="#f4e8bb" stroke="none" />
    <text x="0" y="3" textAnchor="middle" fill="#79551f" stroke="none" fontSize="3" fontWeight="900">BIER</text>
    <circle cx="3" cy="-4" r=".7" fill="#ffdf81" stroke="none" />
  </g>
}

function SpellPlacementPreview({ card }: { card: Card }) {
  const radius = card.name === 'Rauchbombe' ? 72 : card.name === 'Bierdusche' ? 72 : 60
  const color = card.name === 'Rauchbombe' ? '#9ca99a' : card.name === 'Bierdusche' ? '#e5bd55' : card.name === 'Leuchtrakete' ? '#ffc35e' : '#ed7042'
  return <g className="spell-placement-preview">
    <circle r={radius} fill={color} fillOpacity=".12" stroke={color} strokeWidth="2.5" strokeDasharray="8 6" />
    <circle r={radius * .72} fill="none" stroke={color} strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="3 5" />
    {card.name === 'Rauchbombe' && <g fill={color} fillOpacity=".7"><circle cx="-22" cy="5" r="17" /><circle cx="0" cy="-10" r="22" /><circle cx="23" cy="6" r="16" /></g>}
    {card.name === 'Bierdusche' && <g stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".85">{[-30, -15, 0, 15, 30].map(x => <path key={x} d={`M${x} -25v18`} />)}</g>}
    {card.name === 'Leuchtrakete' && <g stroke={color} strokeWidth="3" strokeLinecap="round"><path d="M-16 0H16M0-16V16M-11-11L11 11M11-11-11 11" /></g>}
    {card.name === 'Bengalo-Salve' && <g stroke={color} strokeWidth="3" strokeLinecap="round"><path d="M-22 12 0-18 22 12M-16-4 0 20 16-4" /></g>}
  </g>
}

function PyroFlame({ smoke = true }: { smoke?: boolean }) {
  return <g className="pyro-flame" stroke="none" pointerEvents="none" aria-hidden="true">
    <g className="pyro-aura"><circle cy="-7" r="21" fill="#f95626" opacity=".07" /><circle cy="-7" r="14" fill="#ff742e" opacity=".12" /><circle cy="-7" r="8" fill="#ffad48" opacity=".19" /></g>
    {smoke && <g className="torch-smoke" fill="#aaa99b">{[0, 1, 2, 3].map(i => <g key={i} className={`smoke-puff puff-${i}`}><ellipse cy="-12" rx="4.5" ry="6" /><circle cx="3" cy="-15" r="3.5" /></g>)}</g>}
    <path className="fire-tongue fire-outer" d="M0 3C-11-1-11-11-7-19C-8-12-3-13-4-21L1-30C-1-19 8-17 6-10C12-16 11-4 6 0Z" fill="#f35b24" />
    <path className="fire-tongue fire-left" d="M-2 2C-10-2-9-10-12-15C-6-14-3-8-4-17C3-11 4-3-2 2Z" fill="#ff8332" />
    <path className="fire-tongue fire-right" d="M1 2C10-2 8-10 12-19C5-16 6-10 3-12C0-8-3-3 1 2Z" fill="#ffac42" />
    <path className="fire-tongue fire-inner" d="M0 2C-6-2-4-8-1-12C-3-7 2-6 2-18C8-10 7-1 0 2Z" fill="#ffda79" />
    <path className="fire-core" d="M0 2C-3-1-2-5 0-8C0-4 4-3 3 0Z" fill="#fff6cf" />
    <g className="torch-sparks" fill="#ffe6a0">{[0, 1, 2, 3, 4].map(i => <ellipse key={i} className={`torch-spark spark-${i}`} cx={i % 2 ? 3 : -2} cy="-9" rx=".65" ry="1.6" />)}</g>
  </g>
}

export function Fan({ card, side = 'blue', fighting = false, moving = false, back = false, wounded = false, victory = false }: { card: Card; side?: Side; fighting?: boolean; moving?: boolean; back?: boolean; wounded?: boolean; victory?: boolean }) {
  const id = cards.indexOf(card)
  const team = side === 'blue' ? '#64c9bd' : '#e9754e'
  const pyro = id === 7 || id === 15
  const sausageSeller = card.name === 'Würstchenverkäufer'
  const masked = id === 0 || id === 5 || pyro
  const bald = id === 1 || id === 3 || id === 6 || sausageSeller
  const skin = id === 3 ? '#c59d82' : id === 6 ? '#a9795d' : '#c39170'
  const quote = victory ? ({ 'Der Ultra': 'DURCH!', 'Der Capo': 'ALLE VOR!', 'Würstchenverkäufer': 'WURST!', 'Flitzer': 'HINTERHER!' } as Record<string, string>)[card.name] : undefined
  return <g className={`fan-art fan-${id} ${sausageSeller ? 'fan-sausage-seller' : ''} ${back ? 'fan-back' : ''} ${wounded ? 'fan-wounded' : ''} ${fighting ? 'fan-attacking' : ''} ${victory ? 'fan-victory' : ''} ${moving && !fighting ? 'fan-walking' : ''}`} stroke="#131817" strokeWidth="2.2" strokeLinejoin="round">
    {quote && <g className="fan-quote" stroke="none"><path d="M-24-78Q-24-91-11-91H24Q31-91 31-84V-73Q31-66 24-66H-8L-16-61-15-66H-17Q-24-66-24-73Z" fill="#e9dda9" stroke="#26342c" strokeWidth="1.5" /><text x="3" y="-75" textAnchor="middle" fill="#25352b" fontSize="6.5" fontWeight="900">{quote}</text></g>}
    <ellipse cy="2" rx="18" ry="6" fill="#080d0c" opacity=".5" stroke="none" />
    <g className="fan-body">
      <g className="fan-legs" fill="#202626"><path className="leg-left" d="M-9-15-3-14-5 1-8 2-8 5-15 5-14 1Z" /><path className="leg-right" d="M2-14 8-15 11 1 14 2 14 5 7 5 5 1Z" /></g>
      <g className="fan-arms" fill="#343d3c"><path className="arm-left" d="M-14-33-23-25-25-16-20-14-14-22-7-27Z" /><path className="arm-right" d="M13-33 22-25 24-16 19-14 13-22 7-27Z" /></g>
      <path d="M-16 3H-5 M6 3H17 M-10-4h5 M7-4h5" stroke="#70786c" strokeWidth="1" />
      <path d="M-15-35 -6-40 8-40 17-33 17-11 10-8-13-10Z" fill={id === 6 ? '#a59a42' : id === 3 ? '#444c43' : '#273134'} />
      <path d={`M-13-34 -24-25 -22-17 -16-15 -7-26 ${id === 2 || pyro ? '' : 'M14-33 23-25 22-16 16-16 7-27'}`} fill={id === 3 ? skin : '#343d3c'} />
      <path d={`M-23-20 -17-21 -14-16 -17-12 -23-14Z ${id === 2 || pyro ? '' : 'M17-21 23-21 26-16 22-12 17-15Z'}`} fill={masked ? '#1a2527' : skin} strokeWidth="1.5" />
      <path d="M-22-17h5 M19-17h5" stroke={masked ? '#7c8780' : '#8a5f4b'} strokeWidth="1" />
      <path d="M-13-35 -6-38 -3-14-13-12Z M6-38 14-33 11-13 5-15Z" fill={card.color} opacity=".5" stroke="none" />
       <path d="M0-34 0-12 M-11-17-4-16 M5-17 12-18" stroke="#93958a" strokeWidth=".9" />
       {sausageSeller && <g className="sausage-body"><ellipse cx="0" cy="-20" rx="14" ry="11" fill="#b57f63" opacity=".9" /><path d="M-13-31H13L10-7H-10Z" fill="#75634d" stroke="#40382d" strokeWidth="1.4" /><path d="M-7-24-3-21M5-17 8-14" stroke="#a64d35" strokeWidth="2" strokeLinecap="round" /></g>}
      <path d="M-11-30-5-29 M7-31 12-30 M-9-24-6-21 M9-23 12-25" stroke="#c7c6ac" strokeWidth=".8" opacity=".6" />
      {id === 3 && <><path d="M-13-35-7-38-5-12-12-14Z M8-38 14-34 11-14 5-12Z" fill="#191f20" /><path d="M-11-33-8-32 M-10-29-7-28 M9-33 11-32" stroke="#a5a99d" strokeWidth="1.5" /></>}
      <g className={masked ? 'balaclava-head' : bald ? 'scarred-head' : 'beanie-head'}>
        <path d="M-8-35V-29L7-28V-37" fill={skin} />
        <path d="M-12-49Q-13-60 0-61Q14-60 13-49L12-37 6-30-5-31-12-39Z" fill={skin} />
        <path d="M7-56 12-49 10-38 4-32-2-33 5-40Z" fill="#825942" opacity=".45" stroke="none" />
        <path d="M-12-46-15-47-15-40-12-38 M13-46 15-47 15-40 12-38" fill={skin} strokeWidth="1.2" />
        {masked ? <>
          <path d="M-13-37-14-51Q-14-64 0-64Q15-63 15-51L13-35 7-29-8-30Z" fill={id === 5 ? '#454c42' : '#182226'} />
          <path d="M-9-56Q0-63 9-55 M0-61 1-50 M-11-38-7-32 M10-39 7-32" fill="none" stroke="#56605c" strokeWidth="1" />
          <path d="M-11-48-3-47 0-45 4-48 12-49 10-41 3-41 0-43-4-41-10-42Z" fill={skin} stroke="#0d171b" strokeWidth="1.5" />
          <path d="M-8-45-4-44 M5-45 9-46" stroke="#e1dbbd" strokeWidth="1.6" />
          <path d="M-7-45h1 M7-46h1" stroke="#111b1d" strokeWidth="1.7" />
          <path d="M-4-36 5-36" stroke="#070f12" strokeWidth="2.6" />
          <path d="M-11-39-8-31 M-8-39-5-31" stroke={team} strokeWidth="1.2" />
          {pyro && <path d="M5-58 10-54 M7-59 5-55 M10-56 8-52" stroke="#999b86" strokeWidth=".8" />}
        </> : <>
          {bald ? <><path d="M-8-54Q-3-60 4-57" stroke="#e8bb98" strokeWidth="2" fill="none" /><path d="M-10-51-8-54 M9-54 11-50" stroke="#8d6d58" strokeWidth="1" /></> : <><path d="M-14-48-13-57Q0-67 13-57L15-49Z" fill={id === 4 ? '#594747' : '#353e34'} /><path d="M-14-51 14-52 14-47-14-46Z" fill="#252d28" /><path d="M-9-57v5 M-4-59v6 M2-60v7 M8-57v4" stroke="#818374" strokeWidth=".8" /></>}
          <path d="M-9-47-3-45 M4-45 10-48" stroke="#302822" strokeWidth="2.3" />
          <path d="M-8-43h4 M5-43h4" stroke="#e9d9bc" strokeWidth="1.7" />
          <path d="M-6-43h1 M6-43h1" stroke="#262823" strokeWidth="1.8" />
          <path d="M0-44-2-38 2-37 M-5-34 5-35" stroke="#78503d" strokeWidth="1.3" fill="none" />
          <path d={id === 1 ? 'M7-55 5-48 8-39' : id === 3 ? 'M-10-51-7-43-9-36' : 'M7-42 3-37 7-34'} stroke="#794936" strokeWidth="2" fill="none" />
          <path d={id === 1 ? 'M7-55 5-48 8-39 M4-52 8-51 M5-43 9-44' : id === 3 ? 'M-10-51-7-43-9-36 M-11-47-6-48 M-11-40-6-41' : 'M7-42 3-37 7-34 M3-40 7-38'} stroke="#e4b59a" strokeWidth=".9" fill="none" />
          {(id === 1 || id === 2 || id === 6) && <path d="M-9-37-6-32 0-30 7-33 10-38 M-6-37v2 M-3-34v2 M2-34v2 M6-37v2" fill="none" stroke="#4c473c" strokeWidth="1.1" />}
          <path d="M-10-29 9-28 8-24-10-25Z" fill={team} strokeWidth="1" />
        </>}
      </g>
      {back && <g className="fan-back-view">
        <path className="back-cover" d="M-14-35-7-41 8-40 16-33 14-10 4-6-12-12Z" fill={id === 6 ? '#a59a42' : id === 3 ? '#444c43' : '#273134'} />
        <path d="M-10-31-4-35 7-34 12-29" fill="none" stroke={team} strokeWidth="3" opacity=".8" />
        <path d="M-7-29 7-27 M-9-23 9-21 M-8-17 10-15" stroke="#93958a" strokeWidth="1" opacity=".55" />
        <path d="M-10-51Q0-62 12-51L10-35 0-30-10-36Z" fill={masked ? '#182226' : id === 4 ? '#594747' : '#353e34'} />
        <path d="M-8-48Q0-55 9-48 M-7-42Q0-47 8-42" fill="none" stroke="#818374" strokeWidth="1.2" />
        {id === 7 && <path d="M-3-55 3-61 8-55" fill="none" stroke="#999b86" strokeWidth="1.2" />}
      </g>}
      <path d="M-7-28 -6-14 -1-17 -2-28" fill={team} strokeWidth="1" />
      {id === 1 && <><path d="M15-26 26-33 31-18 18-19Z" fill="#c8c7b6" /><ellipse cx="29" cy="-26" rx="5" ry="9" fill="#414c48" /></>}
      {id === 2 && <g className="beer-arm"><path d="M12-33 21-29 24-22 18-19 8-27" fill="#343d3c" /><path d="M18-24 25-25 27-20 23-17 18-19Z" fill={skin} strokeWidth="1.5" /><g className="held-beer" transform="translate(24 -28) rotate(10) scale(.7)"><BeerCup /></g></g>}
      {id === 4 && <><ellipse cx="7" cy="-18" rx="14" ry="6" fill="#d8c695" /><path d="M-7-18V-7Q7 0 21-7V-18" fill="#875644" /><ellipse cx="7" cy="-18" rx="14" ry="6" fill="#e1d5ba" /><path d="M-15-27 5-18 M22-29 10-18" stroke="#dbc7a4" /></>}
      {id === 5 && <path d="M-17-34 -25-31 -25-12 -17-10" fill="#8c7960" />}
      {id === 6 && <path d="M3-29 13-30 M3-23 13-24" stroke="#e8dcaa" strokeWidth="3" />}
      {sausageSeller && <g className="sausage-gear"><path d="M15-29 28-38" stroke="#8c6741" strokeWidth="4" /><path d="M25-41 34-38 29-32 21-35Z" fill="#c9c1a2" /><path d="M-17-25-29-30" stroke="#8c6741" strokeWidth="4" /><path d="M-35-33-27-35" stroke="#d8bd72" strokeWidth="3" strokeLinecap="round" /></g>}
        {pyro && <g className="pyro-arm">
        <path d="M12-34 20-29 22-23 17-20 8-27" fill="#343d3c" />
        <path d="M17-28 22-29 25-25 22-21 17-22Z" fill="#172124" strokeWidth="1.5" />
        <path d="M18-25h4" stroke="#848c7b" strokeWidth="1" />
        <g className="held-torch"><path d="M17-25 21-43" stroke="#4d3f35" strokeWidth="5" /><path d="M18-29 21-43" stroke="#d3b590" strokeWidth="3" /><path d="M19-39 21-44" stroke="#fff0c1" strokeWidth="3" /><g transform="translate(21 -44) scale(.9)"><PyroFlame /></g></g>
      </g>}
      {id === 3 && <path d="M-14-30 -20-26 -15-13 -10-17Z" fill="#74766b" />}
      {back && <path className="back-jacket" d="M-12-28-5-14 5-13 13-28 15-8 5-4-10-7Z" fill={team} opacity=".7" />}
      {wounded && <g className="wound-details">
        <path d="M-11-45-5-42 M5-42 11-45" stroke="#355b9b" strokeWidth="4" strokeLinecap="round" opacity=".9" />
        <path d="M-9-39-4-38 M4-38 9-39" stroke="#1e3767" strokeWidth="1.5" />
        <path d="M-15-28-18-15 M-12-25-15-12" stroke="#a9312e" strokeWidth="2" strokeLinecap="round" />
        <circle cx="-19" cy="-10" r="2.2" fill="#9f2b2b" stroke="none" />
      </g>}
    </g>
  </g>
}

export function Flitzer({ side = 'blue', back = side === 'blue', moving = false }: { side?: Side; back?: boolean; moving?: boolean }) {
  const skin = side === 'blue' ? '#c58f72' : '#a97862'
  return <g className={`flitzer-art ${moving ? 'flitzer-walking' : ''}`} stroke="#241b18" strokeWidth="2.2" strokeLinejoin="round">
    <ellipse cy="4" rx="19" ry="6" fill="#080d0c" opacity=".55" stroke="none" />
    <path className="flitzer-leg-left" d="M-7-13-10 2-14 7-10 10-3 4 0-8" fill="#2b2926" />
    <path className="flitzer-leg-right" d="M7-13 10 2 14 7 10 10 3 4 0-8" fill="#2b2926" />
    <g className="flitzer-arm-left">
    <path d="M-11-29Q-19-38-24-48L-30-62" fill="none" stroke={skin} strokeWidth="7" strokeLinecap="round" />
    <circle cx="-30" cy="-64" r="4" fill={skin} />
    </g>
    <g className="flitzer-arm-right">
    <path d="M11-29Q19-38 24-48L30-62" fill="none" stroke={skin} strokeWidth="7" strokeLinecap="round" />
    <circle cx="30" cy="-64" r="4" fill={skin} />
    </g>
    <ellipse cx="0" cy="-20" rx="16" ry="19" fill={skin} />
    {back ? <g fill="none" stroke="#34423c" strokeWidth="1.3" opacity=".85">
      <path d="M0-28V-10M-3-27Q-10-28-12-22M3-27Q10-28 12-22" stroke="#98664f" />
      <path d="M0-26-7-29-10-23-6-16 0-12 6-16 10-23 7-29Z" />
      <path d="M-4-24 0-26 4-24 3-20-3-20ZM-2-20V-17M2-20V-17M-12-20-8-17M12-20 8-17" />
    </g> : <g fill="none">
      <path d="M-9-9Q0-5 9-9" stroke="#a65c48" strokeWidth="1.5" />
      <circle cy="-12" r="1" fill="#7d4b3d" stroke="none" />
      <g stroke="#34423c" strokeWidth="1.3" opacity=".85">
        <path d="M0-17C-14-23-7-30 0-25C7-30 14-23 0-17Z" />
        <path d="M-12-23-8-20 8-20 12-23M-8-20V-17L0-18 8-17V-20" />
      </g>
    </g>}
    <path d="M-12-46Q-13-60 0-61Q14-60 13-49L12-37 6-30-5-31-12-39Z" fill={skin} />
    <path d="M-12-46-15-47-15-40-12-38M13-46 15-47 15-40 12-38" fill={skin} strokeWidth="1.2" />
    {back ? <g fill="none">
      <path d="M-11-51Q-13-37 0-36Q13-37 12-51" stroke="#7e5448" strokeWidth="3" />
      <path d="M-4-33H4" stroke="#98664f" strokeWidth="1.2" />
    </g> : <g>
      <path d="M-10-51Q0-61 10-51" fill="none" stroke="#7e5448" strokeWidth="2.5" />
      <circle cx="-4" cy="-48" r="1.5" fill="#251c19" stroke="none" />
      <circle cx="4" cy="-48" r="1.5" fill="#251c19" stroke="none" />
      <path d="M-4-41Q0-39 4-41" fill="none" />
    </g>}
  </g>
}

function GatlingGuard({ side, throwing, aimAngle }: { side: Side; throwing: boolean; aimAngle: number }) {
  const radians = aimAngle * Math.PI / 180
  const back = Math.sin(radians) < 0
  const color = side === 'blue' ? '#5baaa0' : '#c46249'
  return <g transform="translate(2 -63)">
    <g className="gatling-guard" transform="scale(.72)">
    <title>Pyro-Gatling · Clubhauswache</title>
    <ellipse rx="17" ry="5" fill="#111c17" opacity=".5" />
    <g stroke="#17221e" strokeWidth="2" strokeLinejoin="round">
      <path d="M-11-18-13-2H-4L0-17 4-2H13L11-18" fill="#303b37" />
      <path d="M-12-34Q0-41 12-34L14-15H-14Z" fill={color} />
      <circle cy="-46" r="10" fill="#ca9b79" />
      <path d="M-10-48Q-9-60 2-57Q12-55 10-48" fill="#30302b" />
      {back ? <path d="M-6-42Q0-39 6-42" fill="none" stroke="#976c51" /> : <g transform={`translate(${Math.cos(radians) * 3} 0)`}><circle cx="-3" cy="-46" r="1" fill="#17221e" /><circle cx="3" cy="-46" r="1" fill="#17221e" /><path d="M-3-41H3" /></g>}
      <path d="M-12-32-16-24-3-26M12-32 16-24 3-26" fill="none" stroke="#ca9b79" strokeWidth="6" strokeLinecap="round" />
    </g>
    <g transform={`translate(0 -28) rotate(${aimAngle})`}>
      <g className={throwing ? 'gatling-firing' : ''} stroke="#17221e" strokeWidth="2">
        <path d="M-10-7H16V8H-10Z" fill="#535d54" />
        <ellipse cx="-8" cy="1" rx="6" ry="10" fill="#a88a46" />
        <path d="M9-6H33V-2H9ZM9 0H35V4H9ZM9 6H33V10H9Z" fill="#8f9381" />
        <path d="M25-8V12" stroke="#b7a374" strokeWidth="4" />
        {throwing && <path d="M35-5 43-10 41-2 52 2 41 5 44 13 35 8Z" fill="#ffce6d" stroke="#ef773b" />}
      </g>
    </g>
    </g>
  </g>
}

function Club({ side, fortress, hp, max, throwing, activated, aimAngle }: { side: Side; fortress: boolean; hp: number; max: number; throwing: boolean; activated: boolean; aimAngle: number }) {
  const lastAim = useRef(aimAngle)
  if (throwing) lastAim.current = aimAngle
  const c = side === 'blue' ? '#5baaa0' : '#c46249'
  const health = Math.max(0, hp / max)
  const damaged = health < .7
  const critical = health < .35
  if (hp <= 0) return <g><ellipse rx="45" ry="17" fill="#161b17" opacity=".6" /><path d="M-35 0-20-16-3-8 11-21 29-12 39 3 10 13Z" fill="#55554b" stroke="#272d27" strokeWidth="3" /><path d="M-16-5 5 4 20-8" fill="none" stroke="#9c8971" strokeWidth="4" /></g>
  return <g className={`iso-club ${damaged ? 'club-damaged' : ''} ${critical ? 'club-critical' : ''}`}>
    <ellipse cx="12" cy="6" rx={fortress ? 62 : 43} ry="17" fill="#080e0b" opacity=".55" />
    <g transform={fortress ? 'scale(1.32)' : 'scale(1.02)'}>
      <path d="M-38-9 3 9 43-12 2-30Z" fill="#303931" stroke="#151d19" strokeWidth="3" />
      <path d="M-34-15V-60L3-45V3Z" fill="#67665a" stroke="#242d27" strokeWidth="2" />
      <path d="M3-45 39-64V-17L3 3Z" fill="#414b43" stroke="#242d27" strokeWidth="2" />
      {Array.from({ length: 5 }, (_, i) => <path key={i} d={`M-33 ${-53 + i * 10} 2 ${-38 + i * 10} 38 ${-57 + i * 10}`} stroke="#242d27" opacity=".45" fill="none" />)}
      <path d="M-41-62-3-82 45-65 3-41Z" fill="#252f2c" stroke="#111c17" strokeWidth="3" />
      <path d="M-36-63-3-77 39-65 3-47Z" fill="#58615a" />
      <path d="M-30-61 2-48 M-20-65 11-53 M-10-70 21-58 M0-74 31-63" stroke="#8a8d78" opacity=".35" />
       <path d="M-39-59 3-41 43-62V-55L3-33-39-51Z" fill={c} />
       {damaged && <g className="club-smoke" pointerEvents="none"><ellipse cx="-22" cy="-94" rx="8" ry="5" fill="#aaa99b" opacity=".5" /><ellipse cx="-14" cy="-106" rx="10" ry="6" fill="#aaa99b" opacity=".32" /><circle cx="-2" cy="-115" r="6" fill="#aaa99b" opacity=".2" /></g>}
       {critical && <g className="club-damage-marks" fill="none" stroke="#222c26" strokeWidth="2.2" strokeLinecap="round"><path d="M-29-57-22-48-27-38" /><path d="M18-48 11-39 17-29" /><path d="M-9-27-3-19-8-10" /></g>}
      <path d="M-27-38-15-33V-16L-27-21Z M12-33 22-38V-23L12-18Z M27-41 34-45V-30L27-26Z" fill="#c7a665" stroke="#252d26" strokeWidth="3" />
      <path d="M-11-29-2-25V-2L-11-6Z" fill="#17221e" />
       <path d="M-36-56-5-43V-33L-36-45Z" fill="#e1cf9b" opacity={critical ? .58 : 1} />
      <path d="M9-10 13-18 17-12 21-23 24-17 30-25" fill="none" stroke={c} strokeWidth="2" />
      <path d="M-28-13-22-10 M-30-16-24-13" stroke="#bab39c" />
       <path d="M2-78V-115" stroke="#a8a794" strokeWidth="2" opacity={critical ? .55 : 1} />
      <path className="club-flag" d="M3-114 28-107 24-91 3-98Z" fill={c} stroke="#1c2a24" strokeWidth="1" />
      <text x="9" y="-101" fill="#e9dfbe" fontSize="9" fontWeight="900">{side === 'blue' ? 'R' : 'K'}</text>
      {fortress && <><path d="M-23-71V-93L-12-97-4-93V-79" fill="#4c554d" stroke="#222e26" strokeWidth="2" /><path d="M-24-94-13-100-3-95-14-89Z" fill="#788075" /></>}
      {!fortress && <g transform="translate(5 -63) scale(.78)" className={`roof-guard ${throwing ? 'roof-throwing' : ''}`}>
        <title>Dachwache · Bengalos: 45 Schaden + 15 Flächenschaden</title>
         <Fan card={cards[7]} side={side} fighting={throwing} back={side === 'blue'} />
        <path d="M-13-27-8-22-12-17" stroke="#dad8b5" strokeWidth="2" fill="none" />
       </g>}
       {fortress && activated && <GatlingGuard side={side} throwing={throwing} aimAngle={lastAim.current} />}
     </g>
    <rect x="-30" y="18" width="60" height="6" rx="1" fill="#0b1612" stroke="#a6a18a" strokeWidth=".5" />
    <rect x="-29" y="19" width={58 * hp / max} height="4" fill={c} />
    <text y="36" textAnchor="middle" fill="#ded6bc" fontSize="10" fontWeight="700">{Math.ceil(hp)}</text>
  </g>
}

function BeerStall({ side, hp, max, kind = 'beer' }: { side: Side; hp: number; max: number; kind?: 'beer' | 'sausage' }) {
  const c = side === 'blue' ? '#5baaa0' : '#c46249'
  const sausage = kind === 'sausage'
  const health = Math.max(0, hp / max)
  const damaged = health < .7
  const critical = health < .35
  if (hp <= 0) return <g><ellipse rx="32" ry="12" fill="#161b17" opacity=".6" /><path d="M-27 2-17-13-4-7 8-18 25-7 18 7-5 11Z" fill="#55554b" stroke="#272d27" strokeWidth="2.5" /></g>
  return <g className={`beer-stall ${damaged ? 'stall-damaged' : ''} ${critical ? 'stall-critical' : ''}`}>
    <ellipse cx="4" cy="8" rx="36" ry="13" fill="#080e0b" opacity=".55" />
    <path d="M-28-9 3 5 31-9 0-23Z" fill="#252f2c" stroke="#111c17" strokeWidth="2.5" opacity={critical ? .72 : 1} />
    <path d="M-25-10 3 2 28-10 3-18Z" fill={c} stroke="#1c2a24" strokeWidth="1.5" />
    <path d="M-22-8V19L3 29V2Z" fill="#5b6255" stroke="#242d27" strokeWidth="2" />
    <path d="M3 2 28-10V16L3 29Z" fill="#414b43" stroke="#242d27" strokeWidth="2" opacity={critical ? .72 : 1} />
    {damaged && <g className="stall-smoke" pointerEvents="none"><ellipse cx="-13" cy="-35" rx="6" ry="4" fill="#aaa99b" opacity=".5" /><ellipse cx="-7" cy="-46" rx="8" ry="5" fill="#aaa99b" opacity=".34" /><circle cx="3" cy="-54" r="5" fill="#aaa99b" opacity=".22" /></g>}
    {critical && <g className="stall-debris" stroke="#2d3028" strokeWidth="2"><path d="M-24-9-13 2" /><path d="M18-8 27 3" /><path d="M-4-22 5-14" /></g>}
    <path d="M-19-7H1V5H-19Z" fill="#e2d49c" stroke="#262d25" strokeWidth="1.5" />
    <path d="M-13-4H-5" stroke="#9d7c3c" strokeWidth="2" />
    <path d="M-13 12Q-3 7 7 13" fill="none" stroke="#d6bc6a" strokeWidth="2.5" />
    <path d="M-2-18V-35H19V-25" stroke="#a8a794" strokeWidth="1.5" />
    <path d="M-2-35H19V-24H-2Z" fill={sausage ? '#d08b50' : '#d8c77e'} stroke="#1c2a24" strokeWidth="1.5" opacity={critical ? .65 : 1} />
    <text x="8" y="-27" textAnchor="middle" fill="#273226" fontSize="5" fontWeight="900">{sausage ? 'WURST' : 'BIER'}</text>
    {!sausage ? <g transform="translate(15 -47) rotate(-8)"><path d="M-6-5H6L5 7Q0 10-5 7Z" fill="#e7dfb4" stroke="#243027" strokeWidth="1.4" /><path d="M6-2Q12-2 9 4Q7 7 5 5" fill="none" stroke="#e7dfb4" strokeWidth="1.7" /><path d="M-4-5Q0-10 4-5" fill="#f8f0c8" stroke="#243027" strokeWidth="1" /></g> : <g transform="translate(8 -17) rotate(-8)"><path d="M-19 1Q-15-6-7-3L12-2Q20 0 17 6Q14 11 7 8L-12 7Q-20 6-19 1Z" fill="#b95832" stroke="#3a241b" strokeWidth="1.8" /><path d="M-11-1-8 5M-3-2 0 5M5-1 8 6" stroke="#e5b15d" strokeWidth="1.5" strokeLinecap="round" /><path d="M-22 11H20" stroke="#b69a67" strokeWidth="1.5" strokeLinecap="round" /></g>}
    <rect x="-31" y="35" width="62" height="4" rx="1" fill="#0b1612" stroke="#a6a18a" strokeWidth=".5" />
    <rect x="-30" y="36" width={60 * hp / max} height="2" fill={c} />
  </g>
}

function BuildingPlacementPreview({ card }: { card: Card }) {
  return <g transform="scale(.8)" opacity=".8"><BeerStall side="blue" kind={card.name === 'Würstchenbude' ? 'sausage' : 'beer'} hp={card.hp} max={card.hp} /></g>
}

const Environment = memo(function Environment() {
  return <>
    <defs>
      <pattern id="asphalt" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#343c30" /><path d="M1 2h.3M5 6h.5M3 4h.2" stroke="#9b9a76" strokeWidth=".18" opacity=".4" /></pattern>
      <pattern id="brickwork" width="6" height="4" patternUnits="userSpaceOnUse"><rect width="6" height="4" fill="#45483e" /><path d="M0 0H6M0 2H6M3 0V2M0 2V4" stroke="#272e26" strokeWidth=".25" /></pattern>
      <pattern id="grit" width="120" height="100" patternUnits="userSpaceOnUse">{Array.from({ length: 65 }, (_, i) => <circle key={i} cx={noise(i) * 120} cy={noise(i + 100) * 100} r={noise(i + 200) * 1.2} fill={i % 2 ? '#c2b594' : '#101a15'} opacity=".22" />)}</pattern>
       <radialGradient id="flareGlow"><stop stopColor="#fd6835" stopOpacity=".6" /><stop offset="1" stopColor="#eb5228" stopOpacity="0" /></radialGradient>
       <linearGradient id="floodlightCone" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f5edbd" stopOpacity=".16" /><stop offset=".55" stopColor="#e8e4b5" stopOpacity=".055" /><stop offset="1" stopColor="#dfe4bf" stopOpacity="0" /></linearGradient>
      <linearGradient id="canal" x2="1" y2="0"><stop stopColor="#111f1d" /><stop offset=".5" stopColor="#344d41" /><stop offset="1" stopColor="#142823" /></linearGradient>
      <filter id="smokeBlur"><feGaussianBlur stdDeviation="10" /></filter>
    </defs>
    {/* The slab has exposed concrete sides instead of a floating flat board. */}
    <path d="M100 290 440 590 1120 390V419L440 622 100 320Z" fill="#292e28" stroke="#101b16" strokeWidth="3" />
    <path d="M440 590V622L1120 419V390Z" fill="#1b2520" />
    <g transform={groundMatrix}>
      <rect x="-4" y="-4" width="108" height="108" fill="#535b4b" stroke="#18231c" strokeWidth=".7" />
      <rect width="100" height="100" fill="url(#asphalt)" />
      {(['blue', 'red'] as const).flatMap(side => [0, 1].map(lane => {
        const route = laneRoute(side, lane)
        const d = route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
        return <g key={`${side}-${lane}`}><path d={d} stroke="#182019" strokeWidth="7" fill="none" strokeLinejoin="round" /><path d={d} stroke="#867d5b" opacity=".7" strokeWidth="5.5" fill="none" strokeLinejoin="round" /><path d={d} stroke="#c0b38b" opacity=".5" strokeWidth=".25" strokeDasharray="1.2 1.4" fill="none" /></g>
      }))}
      {Array.from({ length: 70 }, (_, i) => <ellipse key={i} cx={noise(i + 10) * 98} cy={noise(i + 80) * 98} rx={1 + noise(i + 90) * 4} ry={.3 + noise(i + 180) * 2} fill={i % 3 === 0 ? '#171f19' : '#66694a'} opacity=".35" />)}
      <path d="M5 5H95V95H5Z M50 5V95 M5 25H19V75H5 M95 25H81V75H95" fill="none" stroke="#c3bfa0" strokeWidth=".35" opacity=".28" strokeDasharray="4 .8" />
      <circle cx="50" cy="50" r="13" fill="none" stroke="#c3bfa0" strokeWidth=".35" opacity=".25" />
      <path d="M12 15 16 18 14 23 19 25 M70 83 73 87 72 91 77 94 M27 48 31 50 29 56" fill="none" stroke="#171e18" strokeWidth=".5" />
      <rect x="44" width="12" height="100" fill="#161e19" stroke="#76715a" strokeWidth="1" />
      <rect x="46" width="8" height="100" fill="url(#canal)" />
      {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${47 + noise(i) * 3} ${i * 5}h2`} stroke="#8b9c77" opacity=".18" strokeWidth=".3" />)}
      {[31, 66].map(y => <g key={y}><rect x="40" y={y - 4} width="20" height="8" fill="#292b23" stroke="#151b16" strokeWidth=".7" /><rect x="40" y={y - 4.5} width="20" height="1" fill="#9b885e" /><rect x="40" y={y + 3.5} width="20" height="1" fill="#9b885e" />{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${41 + i * 1.6} ${y - 3}v6`} stroke={i % 3 ? '#6b6c56' : '#898369'} strokeWidth="1.2" />)}<path d={`M40 ${y - 6}H60 M40 ${y + 3}H60`} stroke="#a5a78b" strokeWidth=".4" />{[40, 45, 50, 55, 60].map(x => <path key={x} d={`M${x} ${y - 3}v-3 M${x} ${y + 6}v-3`} stroke="#676b57" strokeWidth=".5" />)}</g>)}
      {/* Graffiti-stained terraces and concrete perimeter. */}
      <rect x="-4" y="-13" width="108" height="9" fill="url(#brickwork)" stroke="#141f19" strokeWidth=".5" />
      {[0, 1, 2].map(row => <g key={row}>{Array.from({ length: 67 }, (_, i) => <circle key={i} cx={-2 + i * 1.58} cy={-6 - row * 2.6} r=".65" fill={['#17221d', '#778271', '#a39a7b', '#47756b', '#a45139'][Math.floor(noise(i + row * 100) * 5)]} />)}</g>)}
      <rect x="-4" y="100" width="108" height="4" fill="#636251" stroke="#232e24" strokeWidth=".5" />
      {Array.from({ length: 28 }, (_, i) => <path key={i} d={`M${noise(i + 500) * 98} ${noise(i + 650) * 98}l.7 .3-.2 .9-.7-.3Z`} fill={i % 3 ? '#c4bda1' : '#a16544'} opacity=".6" />)}
      <rect width="100" height="100" fill="url(#grit)" pointerEvents="none" />
      {[26, 66].flatMap(y => [16, 84].map(x => <g key={`${x}-${y}`}><rect x={x - 4} y={y - 4} width="8" height="8" fill="none" stroke="#c7ab6c" strokeWidth=".35" strokeDasharray="1 .6" /><path d={`M${x < 50 ? 29 : 71} ${y - 1.5}l${x < 50 ? -2 : 2} 1.5 ${x < 50 ? 2 : -2} 1.5`} fill="none" stroke="#cbbf90" strokeWidth=".5" opacity=".7" /></g>))}
    </g>
    {/* Floodlights and flare haze sit in screen space, above the ground plane. */}
     {[{x:120,y:260}, {x:740,y:75}, {x:1090,y:390}].map((p, i) => <g key={i}><path d={`M${p.x - 30} ${p.y - 115} ${p.x + 30} ${p.y - 115} ${p.x + 110} ${p.y + 80} ${p.x - 90} ${p.y + 80}Z`} fill="url(#floodlightCone)" /><path d={`M${p.x} ${p.y}V${p.y - 120}`} stroke="#28372f" strokeWidth="6" /><path d={`M${p.x - 3} ${p.y}V${p.y - 120}`} stroke="#859184" strokeWidth="1.5" /><rect x={p.x - 28} y={p.y - 133} width="56" height="18" rx="2" fill="#303e34" stroke="#7c8c78" />{[0,1,2,3].map(j => <rect key={j} x={p.x - 24 + j * 13} y={p.y - 129} width="9" height="10" fill="#e0ddae" />)}</g>)}
    {[{x:230,y:220},{x:810,y:90},{x:1050,y:410}].map((p, i) => <g key={i} className="pyro-haze" style={{ animationDelay: `${i * -3}s` }} pointerEvents="none"><circle cx={p.x} cy={p.y} r="80" fill="url(#flareGlow)" /><g filter="url(#smokeBlur)" fill={i === 0 ? '#a0b1a0' : '#b65c3f'} opacity=".19"><ellipse cx={p.x - 10} cy={p.y - 30} rx="29" ry="38" /><ellipse cx={p.x + 10} cy={p.y - 75} rx="46" ry="30" /></g><g transform={`translate(${p.x} ${p.y}) scale(.8)`}><PyroFlame /></g></g>)}
  </>
})

const VerticalEnvironment = memo(function VerticalEnvironment() {
  const p = (x: number, y: number) => baseProject(x, y)
  const points = (coords: Array<[number, number]>) => coords.map(([x, y]) => { const q = p(x, y); return `${q.x},${q.y}` }).join(' ')
  const lanePath = (lane: number, side: Side) => laneRoute(side, lane).map((q, i) => { const v = p(q.x, q.y); return `${i ? 'L' : 'M'}${v.x} ${v.y}` }).join(' ')
  const fenceSegments: Array<[number, number]> = [[-28, 17], [29, 67], [79, 128]]
  return <>
    <defs>
      <pattern id="vertical-asphalt" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#3f4939" /><path d="M1 2h.4M6 7h.7M4 5h.25" stroke="#a09b78" strokeWidth=".25" opacity=".45" /></pattern>
      <pattern id="vertical-grit" width="140" height="140" patternUnits="userSpaceOnUse">{Array.from({ length: 100 }, (_, i) => <circle key={i} cx={noise(i) * 140} cy={noise(i + 300) * 140} r={noise(i + 500) * 1.5} fill={i % 2 ? '#c7b992' : '#101a14'} opacity=".25" />)}</pattern>
      <linearGradient id="vertical-river" x2="0" y2="1"><stop stopColor="#182d2b" /><stop offset=".45" stopColor="#527f77" /><stop offset="1" stopColor="#1c332d" /></linearGradient>
      <linearGradient id="vertical-bridge" x2="0" y2="1"><stop stopColor="#c39a5d" /><stop offset=".5" stopColor="#725131" /><stop offset="1" stopColor="#b2824b" /></linearGradient>
      <radialGradient id="vertical-ground" cx="50%" cy="42%" r="72%"><stop stopColor="#293326" /><stop offset=".58" stopColor="#22271d" /><stop offset="1" stopColor="#1b1914" /></radialGradient>
      <filter id="vertical-smoke"><feGaussianBlur stdDeviation="10" /></filter>
    </defs>
    <rect width="775" height="1220" fill="url(#vertical-ground)" />
    <polygon points={points([[-2, -2], [102, -2], [102, 102], [-2, 102]])} fill="#29291d" stroke="#11150f" strokeWidth="22" opacity=".92" />
     <polygon points={points([[0, 0], [100, 0], [100, 100], [0, 100]])} fill="#566247" stroke="#a49d76" strokeWidth="3" />
     <polygon points={points([[0, 0], [100, 0], [100, 100], [0, 100]])} fill="url(#vertical-asphalt)" />
     <polygon points={points([[0, 0], [100, 0], [100, 100], [0, 100]])} fill="url(#vertical-grit)" />
     <g className="arena-smoke-clouds" pointerEvents="none">
       {[
         [150, 220, 1.1], [520, 285, .8], [300, 430, .95], [650, 560, 1.2],
         [180, 690, .75], [500, 790, 1], [330, 930, .85], [620, 1040, .7],
       ].map(([x, y, scale], i) => <g key={i} transform={`translate(${x} ${y})`}>
         <g className="arena-smoke-cloud" style={{ animationDelay: `${-(i * 1.7)}s`, animationDuration: `${18 + (i % 4) * 4}s` }}>
           <ellipse cx="-28" cy="4" rx={34 * scale} ry={18 * scale} fill="#aab5a0" opacity=".12" />
           <ellipse cx="0" cy="-8" rx={46 * scale} ry={24 * scale} fill="#c2c8ad" opacity=".16" />
           <ellipse cx="34" cy="5" rx={30 * scale} ry={16 * scale} fill="#9ca998" opacity=".11" />
         </g>
       </g>)}
     </g>
     <g className="ground-structure" pointerEvents="none">
       {Array.from({ length: 13 }, (_, i) => {
         const y = i * 8
         const a = p(0, y)
         const b = p(100, y)
         return <path key={`ground-joint-y-${i}`} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#171e17" strokeWidth="2" opacity=".2" />
       })}
       {[12, 25, 38, 62, 75, 88].map(x => {
         const a = p(x, 0)
         const b = p(x, 100)
         return <path key={`ground-joint-x-${x}`} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#171e17" strokeWidth="1.5" opacity=".16" />
       })}
       {[[4, 22, 30], [68, 44, 20], [8, 76, 25], [72, 91, 18]].map(([x, y, w], i) => {
         const a = p(x, y)
         const b = p(x + w, y + 1.5)
         const c = p(x + w - 2, y + 4)
         const d = p(x - 2, y + 2.5)
         return <path key={`ground-patch-${i}`} d={`M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}L${d.x} ${d.y}Z`} fill={i % 2 ? '#8b8062' : '#1b241b'} opacity=".12" />
       })}
     </g>
     {/* Permanent troop roads: both lanes bend around the canal and run through the pub checkpoint. */}
    {[0, 1].flatMap(lane => (['blue', 'red'] as Side[]).map(side => <g key={`${side}-${lane}`}><path d={lanePath(lane, side)} fill="none" stroke="#172018" strokeWidth="25" strokeLinecap="round" strokeLinejoin="round" /><path d={lanePath(lane, side)} fill="none" stroke={side === 'blue' ? '#849d77' : '#907964'} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" opacity=".9" /><path d={lanePath(lane, side)} fill="none" stroke="#d0c18e" strokeWidth="1.2" strokeDasharray="3 4" opacity=".8" /></g>))}
    {/* Stadium fence across the arena. The two lane openings are deliberately left clear. */}
    {fenceSegments.map(([from, to], i) => {
      const a = p(50, from)
      const b = p(50, to)
      const pointAt = (t: number, ox = 0, oy = 0) => ({ x: a.x + (b.x - a.x) * t + ox, y: a.y + (b.y - a.y) * t + oy })
      return <g key={i} className="stadium-fence">
        <path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} stroke="#101610" strokeWidth="10" />
        <path d={`M${a.x - 5} ${a.y - 6}L${b.x - 5} ${b.y - 6} M${a.x + 5} ${a.y + 6}L${b.x + 5} ${b.y + 6}`} stroke="#87947b" strokeWidth="2" />
        {/* Diamond mesh, extended beyond the pitch to the card edges. */}
        {[.08, .2, .32, .44, .56, .68, .8, .92].map(t => {
          const q = pointAt(t)
          return <g key={t}><path d={`M${q.x - 13} ${q.y - 9}L${q.x + 13} ${q.y + 9} M${q.x - 13} ${q.y + 9}L${q.x + 13} ${q.y - 9}`} stroke="#788673" strokeWidth="1" strokeDasharray="3 2" opacity=".9" /></g>
        })}
        {[0, .12, .24, .36, .48, .6, .72, .84, .96, 1].map(t => {
          const q = pointAt(t)
          return <path key={t} d={`M${q.x} ${q.y - 12}V${q.y + 12}`} stroke="#aab38b" strokeWidth="2.2" />
        })}
        {/* Heavy upper rail and barbed wire. */}
        <path d={`M${a.x - 6} ${a.y - 11}L${b.x - 6} ${b.y - 11}`} stroke="#c2bd91" strokeWidth="2.5" />
        {[.08, .24, .4, .56, .72, .88].map(t => {
          const q = pointAt(t, -6, -11)
          return <g key={t}><path d={`M${q.x - 6} ${q.y - 5}L${q.x} ${q.y}L${q.x + 6} ${q.y - 5}`} fill="none" stroke="#d7c895" strokeWidth="1.5" /><circle cx={q.x} cy={q.y} r="1.7" fill="#d7c895" /></g>
        })}
        {[0, .25, .5, .75, 1].map(t => {
          const q = pointAt(t)
          return <path key={t} d={`M${q.x} ${q.y - 14}V${q.y + 14}`} stroke="#4c5b4b" strokeWidth="4" />
        })}
      </g>
    })}
    {/* Home/away terrace walls, graffiti and torn banners. */}
    <polygon points={points([[-2, -3], [102, -3], [102, 0], [-2, 0]])} fill="#29342a" stroke="#111b14" strokeWidth="2" />
    <polygon points={points([[-2, 100], [102, 100], [102, 103], [-2, 103]])} fill="#29342a" stroke="#111b14" strokeWidth="2" />
    <path d="M215 185l320-24M190 205l360-26" stroke="#bdc085" strokeWidth="3" opacity=".24" />
    <g className="vertical-lighting" pointerEvents="none">{[{x:92,y:450},{x:650,y:530},{x:104,y:840},{x:650,y:760}].map((q, i) => <g key={i}><path d={`M${q.x - 7} ${q.y - 98}L${q.x - 62} ${q.y + 120}H${q.x + 62}L${q.x + 7} ${q.y - 98}Z`} fill="url(#floodlightCone)" opacity=".7" /><path d={`M${q.x} ${q.y}v-95`} stroke="#77856e" strokeWidth="4" /><rect x={q.x - 18} y={q.y - 103} width="36" height="10" rx="2" fill="#303b31" stroke="#a0aa85" />{[0,1,2].map(j => <rect key={j} x={q.x - 14 + j * 11} y={q.y - 100} width="7" height="5" fill="#ede7b2" />)}</g>)}</g>
     {[{x:210,y:400},{x:570,y:515},{x:260,y:760},{x:520,y:860}].map((q, i) => <g key={i} className="pyro-haze vertical-pyro-haze" style={{ animationDelay: `${i * -2}s` }} pointerEvents="none"><circle cx={q.x} cy={q.y} r="75" fill="url(#flareGlow)" /><g filter="url(#vertical-smoke)" fill={i % 2 ? '#a96a4d' : '#9fae98'} opacity=".18"><ellipse cx={q.x} cy={q.y - 25} rx="30" ry="42" /><ellipse cx={q.x + 14} cy={q.y - 65} rx="44" ry="28" /></g></g>)}
     <g className="terrace-atmosphere" pointerEvents="none">
       {Array.from({ length: 24 }, (_, i) => {
         const home = i < 12
         const q = p(home ? -8 : 108, 18 + (i % 12) * 5)
         const fanCards = [cards[1], cards[0], cards[2], cards[3], cards[4], cards[5]]
         return <g key={`fan-${i}`} transform={`translate(${q.x} ${q.y}) scale(${i % 3 === 0 ? .44 : .36})`} className={`terrace-fan terrace-fan-${home ? 'home' : 'away'}`} style={{ animationDelay: `${-(i % 7) * .22}s` }}>
           <Fan card={fanCards[i % fanCards.length]} side={home ? 'blue' : 'red'} moving={i % 4 === 0} />
         </g>
       })}
        {[{x:-7,y:38,c:'#4faaa0'},{x:107,y:38,c:'#c46651'},{x:-7,y:68,c:'#4faaa0'},{x:107,y:68,c:'#c46651'}].map((f, i) => { const q = p(f.x, f.y); const away = i % 2 === 1; return <g key={`flag-${i}`} className={`terrace-flag terrace-flag-${away ? 'away' : 'home'}`} transform={`translate(${q.x} ${q.y})`}><path d="M0 55V-18" stroke="#b9a46d" strokeWidth="3" /><g className="flag-cloth"><path d={away ? 'M0-16H-38V13Q-18 8 0 15Z' : 'M0-16H38V13Q18 8 0 15Z'} fill={f.c} stroke="#1a251b" strokeWidth="2" /><path d={away ? 'M-28-5H-10M-25 1H-13' : 'M10-5H28M13 1H25'} fill="none" stroke="#243a31" strokeWidth="2" /></g></g> })}
       {Array.from({ length: 30 }, (_, i) => <path key={`rain-${i}`} className="arena-rain" style={{ animationDelay: `${-(i % 9) * .23}s`, animationDuration: `${1.1 + (i % 5) * .24}s` }} d={`M${170 + (i * 23) % 430} ${145 + (i * 47) % 850}l${-7 - (i % 3) * 2} ${18 + (i % 4) * 4}`} stroke="#adc5bd" strokeWidth={1.4 + (i % 3) * .45} opacity={.18 + (i % 4) * .04} />)}
       {Array.from({ length: 22 }, (_, i) => <path key={`confetti-${i}`} className={`arena-confetti confetti-${i % 4}`} style={{ animationDelay: `${-(i % 11) * .31}s`, animationDuration: `${2.2 + (i % 4) * .55}s` }} d={`M${180 + (i * 31) % 400} ${160 + (i * 61) % 780}l${i % 2 ? 9 : -7} ${i % 3 ? 4 : -6}`} stroke={['#d7df8f', '#e27752', '#b9c7ad', '#d8b45d'][i % 4]} strokeWidth="3" />)}
     </g>
  </>
})

export function Arena({ game, selectedCard, active, perspective = 'blue', onPlace }: { game: Game; selectedCard: Card; active: boolean; perspective?: Side; onPlace: (x: number, y: number, drop: boolean) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{x: number; y: number} | null>(null)
  const [draggingOver, setDraggingOver] = useState(false)
  const project = (x: number, y: number) => baseProject(perspective === 'red' ? 100 - x : x, y)
  function fromScreen(x: number, y: number) {
    const worldX = (1024 - y) / 8.32
    return { x: perspective === 'red' ? 100 - worldX : worldX, y: (x - 192) / 3.84 }
  }
  function point(x: number, y: number) {
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return null
    const screen = new DOMPoint(x, y).matrixTransform(matrix.inverse())
    const raw = fromScreen(screen.x, screen.y)
    if (raw.x < 0 || raw.x >= 100 || raw.y < 0 || raw.y >= 100) return null
    const column = Math.floor((screen.x - 192) / 32)
    const row = Math.floor((screen.y - 192) / 32)
    const snapped = fromScreen(192 + column * 32 + 16, 192 + row * 32 + 16)
    return snapped.x >= 0 && snapped.x < 100 && snapped.y >= 0 && snapped.y < 100 ? snapped : null
  }
  const cellAllowed = (x: number, y: number) => x >= 0 && x < 100 && y >= 0 && y < 100 && canDeploy(game, selectedCard, x, y)
  const showPlacement = active && draggingOver
  const hoverAllowed = hover && cellAllowed(hover.x, hover.y)
  const groundPolygon = (x: number, y: number, size: number) => [[x, y], [x + size, y], [x + size, y + size], [x, y + size]].map(([a, b]) => { const p = project(a, b); return `${p.x},${p.y}` }).join(' ')
  const objects = [
    ...buildings.map(b => {
      const shot = game.flares.filter(flare => flare.source === b.key).sort((a, c) => c.id - a.id)[0]
      const target = shot ? game.units.find(unit => unit.id === shot.target) : undefined
      const origin = project(b.x, b.y)
      const aim = target ?? shot
      const end = aim ? project(aim.x, aim.y) : { x: origin.x, y: origin.y + (b.side === 'blue' ? -200 : 200) }
      const aimAngle = Math.atan2(end.y - 20 - (origin.y - 109.7712), end.x - (origin.x + 2.64)) * 180 / Math.PI
      return { key: b.key, layer: game.hp[b.key] <= 0 ? -1 : 0, ...origin, node: <Club side={b.side} fortress={b.key.includes('Fortress')} hp={game.hp[b.key]} max={b.max} activated={game.hp[`${b.side}PubOne`] <= 0 || game.hp[`${b.side}PubTwo`] <= 0} aimAngle={aimAngle} throwing={game.buildingCooldown[b.key] > (b.key.includes('Fortress') ? GATLING_INTERVAL : FLARE_INTERVAL) - .3} /> }
    }),
     ...game.structures.map(s => ({ key: `structure-${s.id}`, layer: 0, ...project(s.x, s.y), node: <BeerStall side={s.side} kind={s.card.name === 'Würstchenbude' ? 'sausage' : 'beer'} hp={s.hp} max={s.max} /> })),
      ...game.units.map(u => ({ key: String(u.id), layer: 0, ...project(u.x, u.y), node: <><title>{u.card.name} · {Math.ceil(u.hp)} HP</title><g className="arena-troop" transform="scale(.8)">{u.card.name === 'Flitzer' ? <Flitzer side={u.side} moving={u.moving} /> : <Fan card={u.card} side={u.side} moving={u.moving} back={u.facingBack} fighting={u.cooldown > u.card.rate - .2} />}<rect x="-18" y="8" width="36" height="3.5" rx="1" fill="#111c17" stroke="#0b0f0d" strokeWidth=".7" /><rect x="-18" y="8" width={36 * Math.max(0, u.hp) / u.card.hp} height="3.5" rx="1" fill={u.side === 'blue' ? '#6cc8ae' : '#ef805b'} />{u.cooldown > u.card.rate - .2 && <path className="impact-flash" d="M16-23 24-31 22-21 31-19 22-17 23-9 17-17Z" fill="#efd8a0" />}</g></> })),
   ].sort((a, b) => a.layer - b.layer || a.y - b.y)
   return <svg ref={svg} className="iso-arena vertical-arena" viewBox="180 176 408 864" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Vertikale isometrische Derby-Arena. Deine Clubhäuser sind unten, die Kiez-Clubhäuser oben." onClick={e => { const p = point(e.clientX, e.clientY); if (p) onPlace(p.x, p.y, false) }} onPointerDown={e => setHover(point(e.clientX, e.clientY))} onPointerMove={e => { if (draggingOver) setHover(point(e.clientX, e.clientY)) }} onPointerLeave={() => { setHover(null); setDraggingOver(false) }} onDragEnter={e => { e.preventDefault(); setDraggingOver(true) }} onDragOver={e => { e.preventDefault(); setDraggingOver(true); setHover(point(e.clientX, e.clientY)) }} onDragLeave={() => { setHover(null); setDraggingOver(false) }} onDrop={e => { e.preventDefault(); const p = point(e.clientX, e.clientY); if (p) onPlace(p.x, p.y, true); setHover(null); setDraggingOver(false) }}>
    <VerticalEnvironment />
    <g pointerEvents="none">
      <polygon points={groundPolygon(0, 0, 100)} fill="none" stroke="#101c17" strokeWidth="7" />
      <polygon points={groundPolygon(0, 0, 100)} fill="none" stroke="#e4d6a5" strokeWidth="2.5" strokeDasharray="10 5" />
      <defs><clipPath id="placement-grid-clip"><polygon points={groundPolygon(0, 0, 100)} /></clipPath></defs>
      <g clipPath="url(#placement-grid-clip)">
      {showPlacement && Array.from({ length: 480 }, (_, i) => {
        const x = 128 + (i % 16) * 32
        const y = 128 + Math.floor(i / 16) * 32
        const center = fromScreen(x + 16, y + 16)
        const allowed = cellAllowed(center.x, center.y)
        const corners = [[x, y], [x + 32, y], [x + 32, y + 32], [x, y + 32]]
        return <g key={i}>
          <rect x={x} y={y} width="32" height="32" fill={allowed ? '#64d6af' : '#c45142'} fillOpacity={allowed ? .06 : .1} stroke={allowed ? '#a0dec2' : '#b87667'} strokeOpacity=".38" strokeWidth=".7" />
          {allowed && [[0, -32], [32, 0], [0, 32], [-32, 0]].map(([dx, dy], edge) => {
            const neighbor = fromScreen(x + 16 + dx, y + 16 + dy)
            if (cellAllowed(neighbor.x, neighbor.y)) return null
            const a = { x: corners[edge][0], y: corners[edge][1] }
            const b = { x: corners[(edge + 1) % 4][0], y: corners[(edge + 1) % 4][1] }
            return <line key={edge} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#95f3c8" strokeWidth="2.5" />
          })}
        </g>
      })}
      {showPlacement && hover && <rect x={project(hover.x, hover.y).x - 16} y={project(hover.x, hover.y).y - 16} width="32" height="32" fill={hoverAllowed ? '#82f4c0' : '#ef6354'} fillOpacity=".35" stroke={hoverAllowed ? '#e1ffe9' : '#ff9788'} strokeWidth="3" />}
      </g>
    </g>
    <g pointerEvents="none" className="beer-puddles">{game.puddles.map(puddle => {
      const p = project(puddle.x, puddle.y)
      const fade = Math.min(1, (PUDDLE_LIFETIME - puddle.age) / .8)
      const spread = .5 + Math.min(1, puddle.age / .25) * .5
      return <g key={puddle.id} transform={`translate(${p.x} ${p.y})`} opacity={fade}>
        <g transform={`rotate(-15) scale(${spread})`} className="beer-puddle">
          <path d="M-23-2Q-26-8-14-8Q-12-13 0-9Q10-12 17-6Q28-5 24 1Q29 7 12 8Q5 12-6 8Q-21 12-21 4Q-30 3-23-2Z" fill="#bd8429" fillOpacity=".55" stroke="#cba34e" strokeOpacity=".6" strokeWidth=".8" />
          <path d="M-17-3Q-9-7 1-5 M6 4Q13 6 19 2" fill="none" stroke="#efe0a0" strokeOpacity=".65" strokeWidth="1.5" />
          {[[-14, 1], [-11, 3], [8, -4], [11, -3], [14, -2]].map(([x,y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.1 : 1.7} fill="#f0e2b9" opacity=".7" />)}
          <g transform="translate(17 4) rotate(75) scale(.38)" opacity=".7"><BeerCup /></g>
        </g>
        {puddle.age < .4 && <g className="beer-splash" opacity={1 - puddle.age / .4}>{Array.from({ length: 7 }, (_, i) => {
          const a = i * Math.PI * 2 / 7
          const t = puddle.age / .4
          return <ellipse key={i} cx={Math.cos(a) * (8 + t * 30)} cy={Math.sin(a) * (5 + t * 12) - 24 * Math.sin(t * Math.PI)} rx="1.7" ry="3" fill={i % 2 ? '#e9b94d' : '#fff1c8'} />
        })}</g>}
      </g>
    })}</g>
    <g pointerEvents="none" className="blood-stains">{game.bloodStains.map(stain => {
      const p = project(stain.x, stain.y)
      const fade = Math.min(1, (BLOOD_STAIN_LIFETIME - stain.age) / .8)
      const spread = .55 + Math.min(1, stain.age / .35) * .45
      return <g key={stain.id} transform={`translate(${p.x} ${p.y})`} opacity={fade}>
        <g className="blood-stain" transform={`rotate(-12) scale(${spread})`}>
          <path d="M-24-2Q-27-8-15-9Q-8-15 1-10Q11-14 18-7Q29-5 24 2Q27 8 12 9Q4 14-6 9Q-20 13-22 5Q-30 4-24-2Z" fill="#7e2428" fillOpacity=".68" stroke="#b33c32" strokeOpacity=".55" strokeWidth="1" />
          <path d="M-17-3Q-7-8 3-5 M4 5Q13 6 19 1" fill="none" stroke="#d05443" strokeOpacity=".65" strokeWidth="1.5" />
          {[[-14, 2], [-9, 5], [8, -4], [14, -1], [18, 3]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.5 : 2.2} fill="#a8322f" opacity=".75" />)}
        </g>
      </g>
    })}</g>
    <g pointerEvents="none" className="ground-fires">{game.fires.map(fire => {
      const p = project(fire.x, fire.y)
      const fade = Math.min(1, (FIRE_LIFETIME - fire.age) / .7)
      const burn = Math.min(1, (FIRE_LIFETIME - fire.age) / 1.3)
      return <g key={fire.id} className="ground-fire" transform={`translate(${p.x} ${p.y})`} opacity={fade}>
        <title>Brennende Fackel</title>
        <ellipse rx="23" ry="9" fill="#15150e" opacity=".6" />
        <ellipse rx="27" ry="12" fill="#f4782f" opacity={.17 * burn} />
        <ellipse rx="15" ry="5" fill="#ffb94d" opacity={.3 * burn} />
        <path d="M-7 4 10-2" stroke="#403021" strokeWidth="4" strokeLinecap="round" />
        <path d="M4 0 10-2" stroke="#f3b974" strokeWidth="3" />
        {[{x:-13,y:0,s:.45},{x:9,y:-2,s:.65},{x:1,y:4,s:.5},{x:17,y:4,s:.32}].map((f,i) => <g key={i} transform={`translate(${f.x} ${f.y}) scale(${f.s * burn})`}><PyroFlame smoke={i === 1} /></g>)}
        <g className="torch-smoke" transform={`translate(4 -3) scale(${.7 + fire.age * .18})`} fill="#999687" opacity={.65}>
          {[0,1,2].map(i => <g key={i} className={`smoke-puff puff-${i}`}><ellipse cy="-12" rx="4.5" ry="6" /><circle cx="3" cy="-15" r="3.5" /></g>)}
        </g>
      </g>
    })}</g>
    <g pointerEvents="none" className="blood-splashes">{game.blood.map(splash => {
      const p = project(splash.x, splash.y)
      const t = Math.min(1, splash.age / .38)
      const fade = 1 - t
      // Units are anchored at their feet; move the impact to the head so the
      // fountain reads as a hit instead of floating above the pitch.
      return <g key={splash.id} transform={`translate(${p.x} ${p.y - 42})`} opacity={fade} className="blood-splash">
        <circle r={2.8 + t * 1.5} fill="#a62f2b" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
          const angle = -Math.PI * .92 + i * Math.PI * .27
          const length = 9 + (i % 3) * 6
          return <ellipse key={i} cx={Math.cos(angle) * length * t} cy={Math.sin(angle) * length * t} rx={1.5 + (i % 2) * .5} ry={3 + (i % 3)} fill={i % 2 ? '#d34a36' : '#8f2528'} transform={`rotate(${angle * 180 / Math.PI})`} />
        })}
        <path d={`M-3 ${-2 - t * 10}L${-12 - t * 16} ${-8 - t * 4} M3 ${-2 - t * 8}L${12 + t * 16} ${-9 - t * 6}`} stroke="#b9362e" strokeWidth="2.1" strokeLinecap="round" />
      </g>
    })}</g>
    <g pointerEvents="none" className="damage-events">{game.damageEvents.map(hit => {
      const p = project(hit.x, hit.y)
      const fade = Math.max(0, 1 - hit.age / .9)
      return <text key={hit.id} x={p.x} y={p.y - 34 - Math.min(hit.age / .9, 1) * 18} className={`damage-event damage-event-${hit.kind}`} opacity={fade}>{hit.kind === 'heal' ? '+' : '-'}{Math.max(1, Math.round(hit.amount))}</text>
    })}</g>
    <g pointerEvents="none" className="spell-effects">{game.spells.map(spell => {
      const target = project(spell.x, spell.y)
      const start = project(spell.fromX, spell.fromY)
      const rawFlight = Math.min(1, spell.age / SPELL_FLIGHT)
      const flight = 1 - Math.pow(1 - rawFlight, 1.65)
      const flying = (spell.type === 'signal' || spell.type === 'salvo') && spell.age < SPELL_FLIGHT
      const arcHeight = 115
      const flyingPoint = { x: start.x + (target.x - start.x) * flight, y: start.y + (target.y - start.y) * flight - arcHeight * Math.sin(Math.PI * flight) }
      // Rotate with the tangent of the parabola, so the projectile follows
      // the rising and falling part of the arc instead of pointing straight
      // at the destination for the whole flight.
      const flightAngle = Math.atan2((target.y - start.y) - arcHeight * Math.PI * Math.cos(Math.PI * flight), target.x - start.x) * 180 / Math.PI
      // Perspective: the projectile is small near the club and target, and
      // appears largest while it is closest to the viewer at the arc peak.
      const flightScale = .56 + Math.sin(Math.PI * rawFlight) * .82
      const p = flying ? flyingPoint : target
      const pulse = 1 + Math.sin(spell.age * 8) * .08
      return <g key={`${spell.id}-${flying ? 'flight' : 'impact'}`} transform={`translate(${p.x} ${p.y}) scale(${flying ? flightScale : pulse})`} className={`spell-effect spell-${spell.type} ${flying ? 'spell-flying' : 'spell-landed'}`}>
        {spell.type === 'smoke' && <><ellipse rx="72" ry="43" /><>{[[-53, 12, 1], [-39, -18, 1.25], [-20, 4, 1.45], [2, -13, 1.35], [25, 8, 1.3], [0, 25, 1.25], [44, -10, 1.1], [58, 16, .95]].map(([x, y, s], i) => <circle key={i} cx={x} cy={y} r={29 * s} />)}</></>}
        {spell.type === 'signal' && flying && <g transform={`rotate(${flightAngle})`}><path className="signal-trail" d="M-68 0H-12" /><g className="rocket-smoke">{[[-42, -5, 5], [-31, 5, 4], [-20, -3, 3]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g><g className="signal-rocket"><path d="M-13-4 8-4 14 0 8 4-13 4Z" /><path d="M-10-4-15-9M-10 4-15 9" /><path className="rocket-flame" d="M-13 0-29-7-22 0-29 7Z" /></g></g>}
        {spell.type === 'signal' && !flying && <><circle r="25" /><path d="M-18 0H18M0-18V18M-13-13L13 13M13-13-13 13" /></>}
        {spell.type === 'salvo' && flying && <g transform={`rotate(${flightAngle})`}>{[-9, 0, 9].map((x, i) => <g key={i} transform={`translate(${x} ${i % 2 ? -5 : 5}) rotate(${i * 18 - 18})`}><path className="salvo-trail" d="M-48 0H-9" /><g className="rocket-smoke"><circle cx="-31" cy="-3" r="4" /><circle cx="-21" cy="3" r="3" /></g><path d="M-9-3 6-3 11 0 6 3-9 3Z" /><path d="M-7-3-12-8M-7 3-12 8" /><path className="rocket-flame" d="M-9 0-23-6-18 0-23 6Z" /></g>)}</g>}
        {spell.type === 'salvo' && !flying && <><circle r="22" /><path d="M-28 13 0-20 26 9M-18-4 8 20" /></>}
        {(spell.type === 'signal' || spell.type === 'salvo') && !flying && <g className="spell-impact-fire" aria-hidden="true">
          <circle className="impact-glow" r="47" />
          <g className="impact-smoke">{[[-25, -22, 12], [0, -34, 16], [24, -22, 11], [5, -52, 9]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}</g>
          <path className="impact-flame impact-flame-outer" d="M0 30C-30 16-31-10-16-30C-18-14-7-17-8-39C8-24 15-17 11-5C25-17 31 5 18 21C13 29 6 32 0 30Z" />
          <path className="impact-flame impact-flame-inner" d="M0 24C-14 14-13-2-5-17C-4-7 4-8 4-22C16-9 14 10 0 24Z" />
          <circle className="impact-core" r="7" />
          {[0, 1, 2, 3, 4, 5].map(i => <path key={i} className="impact-spark" d={`M0-28l${Math.cos(i * Math.PI / 3) * 34} ${-38 + Math.sin(i * Math.PI / 3) * 24}`} />)}
        </g>}
        {spell.type === 'beer-shower' && <>{Array.from({ length: 13 }, (_, i) => <path key={i} d={`M${-42 + i * 7} -38v${22 + (i % 3) * 7}`} />)}<ellipse cy="7" rx="46" ry="18" /></>}
      </g>
    })}</g>
     <g pointerEvents="none">{objects.map(o => <g key={o.key} transform={`translate(${o.x} ${o.y})`}>{o.node}</g>)}</g>
    <g pointerEvents="none" className="pyro-projectiles">{game.torches.map(torch => {
      const start = project(torch.fromX, torch.fromY)
      const end = project(torch.x, torch.y)
      const t = Math.min(1, torch.age / TORCH_FLIGHT)
      const at = (f: number) => ({ x: start.x + 21 + (end.x - start.x - 21) * f, y: start.y - 44 + (end.y - start.y + 44) * f - 60 * Math.sin(Math.PI * f) })
      const p = at(t)
      return <g key={torch.id} className="flying-torch">
        <title>Geworfene Pyrofackel</title>
        {[1,2,3,4,5].map(i => {
          const time = t - i * .045
          if (time < 0) return null
          const trail = at(time)
          return <g key={i}><circle cx={trail.x + i} cy={trail.y - i * 2} r={2 + i} fill="#aaa08c" opacity={.23 - i * .03} /><circle cx={trail.x} cy={trail.y + i} r={1.4 - i * .15} fill="#ffce70" opacity={.9 - i * .12} /></g>
        })}
        <g transform={`translate(${p.x} ${p.y}) rotate(${t * (end.x >= start.x ? 320 : -320)})`}>
          <path d="M0 10V-7" stroke="#392a20" strokeWidth="5" strokeLinecap="round" />
          <path d="M0 8V-7" stroke="#c6ab81" strokeWidth="3" />
          <g transform="translate(0 -8) scale(.85)"><PyroFlame smoke={false} /></g>
        </g>
      </g>
    })}</g>
    <g pointerEvents="none" className="beer-projectiles">{game.beers.map(beer => {
      const start = project(beer.fromX, beer.fromY)
      const end = project(beer.x, beer.y)
      const t = Math.min(1, beer.age / BEER_FLIGHT)
      const x = start.x + 18 + (end.x - start.x - 18) * t
      const y = start.y - 28 + (end.y - start.y + 28) * t - Math.sin(Math.PI * t) * 55
      return <g key={beer.id} className="flying-beer"><title>Fliegender Bierbecher</title>
        {[1, 2, 3].map(i => <ellipse key={i} cx={x - (end.x >= start.x ? 1 : -1) * i * 5} cy={y + i * 3} rx="1.3" ry="2" fill={i === 1 ? '#fff2d0' : '#e6b94d'} opacity={.8 - i * .15} />)}
        <g transform={`translate(${x} ${y}) rotate(${t * (end.x >= start.x ? 260 : -260)})`}><BeerCup /></g>
      </g>
    })}</g>
    <g pointerEvents="none" className="bengalo-effects">
      {game.flares.map(flare => {
        const b = buildings.find(b => b.key === flare.source)!
        const start = project(b.x, b.y)
        start.x += b.key.includes('Fortress') ? 2.64 : 18
        start.y -= b.key.includes('Fortress') ? 109.7712 : 85
        const end = project(flare.x, flare.y)
        end.y -= 20
        if (b.key.includes('Fortress')) {
          const angle = Math.atan2(end.y - start.y, end.x - start.x)
          start.x += Math.cos(angle) * 33.264
          start.y += Math.sin(angle) * 33.264
        }
        const t = Math.min(1, flare.age / FLARE_FLIGHT)
        const at = (p: number) => ({ x: start.x + (end.x - start.x) * p, y: start.y + (end.y - start.y) * p - (b.key.includes('Fortress') ? 0 : 65) * Math.sin(Math.PI * p) })
        const p = at(t)
        const tail = at(Math.max(0, t - .16))
        return <g key={flare.id} className="flying-bengalo">
          {[1, 2, 3, 4, 5].map(i => {
            const trailTime = t - i * .055
            if (trailTime < 0) return null
            const trail = at(trailTime)
            return <circle key={i} cx={trail.x + i * 1.5} cy={trail.y - i * 2} r={2 + i * 1.1} fill="#b0a793" opacity={.22 - i * .03} />
          })}
          <path d={`M${tail.x} ${tail.y} Q${p.x - 5} ${p.y - 4} ${p.x} ${p.y}`} fill="none" stroke="#e89b64" strokeWidth="3" opacity=".55" strokeLinecap="round" />
          {b.key.includes('Fortress') ? <g transform={`translate(${p.x} ${p.y}) rotate(${Math.atan2(p.y - tail.y, p.x - tail.x) * 180 / Math.PI})`}>
            <path d="M-11-3H3L9 0 3 3H-11Z" fill="#f1d09a" stroke="#753f2d" strokeWidth="1" />
            <path d="M-11-2-23 0-11 2" fill="#ff9b42" />
            <circle cx="7" r="5" fill="#ffcf76" opacity=".5" />
          </g> : <g transform={`translate(${p.x} ${p.y}) rotate(${t * 500})`}><path d="M0-6V5" stroke="#e2c99b" strokeWidth="3" /><g transform="translate(0 -6) scale(.65)"><PyroFlame smoke={false} /></g></g>}
        </g>
      })}
      {game.impacts.map(impact => {
        const p = project(impact.x, impact.y)
        const t = impact.age / .45
        return <g key={impact.id} transform={`translate(${p.x} ${p.y})`} opacity={1 - t} className="bengalo-impact"><ellipse rx={10 + t * 30} ry={4 + t * 12} fill="#ef7e3a" fillOpacity=".25" stroke="#efad65" strokeWidth="1.5" /><circle cy="-12" r={20 + t * 15} fill="url(#flareGlow)" /><ellipse cx={t * 12} cy={-12 - t * 25} rx={6 + t * 15} ry={5 + t * 12} fill="#a99f8e" opacity=".24" /><g transform="translate(0 -5) scale(.8)"><PyroFlame smoke={false} /></g>{[0,1,2,3,4].map(i => <path key={i} d={`M0-8l${Math.cos(i * 1.25) * (12 + t * 22)} ${Math.sin(i * 1.25) * (12 + t * 22) - 12}`} stroke="#ffcf80" strokeWidth="2" />)}</g>
      })}
    </g>
    {showPlacement && hover && <g opacity={hoverAllowed ? .8 : .35} pointerEvents="none" transform={`translate(${project(hover.x, hover.y).x} ${project(hover.x, hover.y).y})`}>
      {selectedCard.kind === 'spell' ? <SpellPlacementPreview card={selectedCard} /> : selectedCard.kind === 'building' ? <BuildingPlacementPreview card={selectedCard} /> : selectedCard.name === 'Flitzer' ? <g transform="scale(.8)"><Flitzer side="blue" /></g> : <g transform="scale(.8)"><Fan card={selectedCard} /></g>}
    </g>}
  </svg>
}
