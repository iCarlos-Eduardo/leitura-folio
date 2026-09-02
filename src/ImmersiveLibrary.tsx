import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'

type ImmersiveDestination = 'timeline' | 'shelf' | 'library' | 'profile' | 'goals' | 'notifications' | 'superadmin' | 'store'

type LibraryUser = {
  id: string
  name: string
  handle: string
  avatar?: string
}

type RaceUser = LibraryUser

type RaceBook = {
  id: string
  title: string
  author: string
  cover: string
  totalChapters: number
}

type RaceShelfEntry = {
  userId: string
  bookId: string
  status: string
  progress: number
  endDate?: string | null
}

export type ImmersiveOnlineUser = LibraryUser & {
  immersive?: boolean
  x?: number | null
  y?: number | null
  direction?: Direction | null
  moving?: boolean
}

type Props = {
  currentUser: LibraryUser
  onlineUsers: ImmersiveOnlineUser[]
  token: string
  hubUrl: string
  mediaBaseUrl: string
  isSuperAdmin: boolean
  raceUsers: RaceUser[]
  raceBooks: RaceBook[]
  raceShelf: RaceShelfEntry[]
  onExit: () => void
  onNavigate: (page: ImmersiveDestination) => void
  onCreatePost: () => void
  onUserClick: (userId: string) => void
}

type Direction = 'up' | 'down' | 'left' | 'right'

type Player = {
  x: number
  y: number
  direction: Direction
  moving: boolean
  step: number
}

type Interaction = {
  id: string
  label: string
  shortLabel: string
  hint: string
  x: number
  y: number
  color: string
  page?: ImmersiveDestination
  action?: 'post'
}

type Solid = { x: number; y: number; width: number; height: number }

type RemoteWaypoint = {
  x: number
  y: number
  direction: Direction
  moving: boolean
  receivedAt: number
}

type LibraryNpc = ImmersiveOnlineUser & Player & {
  immersive: boolean
  targetX: number
  targetY: number
  route: RemoteWaypoint[]
  decisionTimer: number
  speed: number
}

const WORLD_WIDTH = 960
const WORLD_HEIGHT = 600
const PLAYER_WIDTH = 28
const PLAYER_HEIGHT = 42
const PLAYER_POSITION_KEY = 'folio_immersive_player_position'
const GUIDE_SEEN_KEY = 'folio_immersive_guide_seen'

const NPC_PATROL_ROUTES = [
  [{ x: 270, y: 280 }, { x: 675, y: 280 }, { x: 675, y: 345 }, { x: 270, y: 345 }],
  [{ x: 315, y: 215 }, { x: 640, y: 215 }, { x: 640, y: 365 }, { x: 315, y: 365 }],
  [{ x: 190, y: 500 }, { x: 780, y: 500 }, { x: 780, y: 330 }, { x: 190, y: 330 }],
]

function stableUserHash(userId: string) {
  let hash = 2166136261
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function deterministicNpcPosition(userId: string, timestamp = Date.now()) {
  const hash = stableUserHash(userId)
  const route = NPC_PATROL_ROUTES[hash % NPC_PATROL_ROUTES.length]
  const segments = route.map((point, index) => {
    const next = route[(index + 1) % route.length]
    return { point, next, length: Math.hypot(next.x - point.x, next.y - point.y) }
  })
  const routeLength = segments.reduce((total, segment) => total + segment.length, 0)
  let distance = ((timestamp / 1000) * 34 + (hash % Math.round(routeLength))) % routeLength
  for (const segment of segments) {
    if (distance <= segment.length) {
      const progress = segment.length ? distance / segment.length : 0
      const dx = segment.next.x - segment.point.x
      const dy = segment.next.y - segment.point.y
      const direction: Direction = Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up')
      return {
        x: segment.point.x + dx * progress,
        y: segment.point.y + dy * progress,
        direction,
      }
    }
    distance -= segment.length
  }
  return { ...route[0], direction: 'down' as Direction }
}

export function prepareFreshImmersivePosition(userId: string) {
  const position = deterministicNpcPosition(userId)
  sessionStorage.setItem(PLAYER_POSITION_KEY, JSON.stringify({ ...position, moving: false, step: 0 }))
}

function storedPlayer(): Player {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PLAYER_POSITION_KEY) || '') as Partial<Player>
    if (typeof saved.x === 'number' && typeof saved.y === 'number') {
      return {
        x: Math.max(20, Math.min(WORLD_WIDTH - PLAYER_WIDTH - 20, saved.x)),
        y: Math.max(74, Math.min(WORLD_HEIGHT - PLAYER_HEIGHT - 18, saved.y)),
        direction: saved.direction === 'up' || saved.direction === 'down' || saved.direction === 'left' || saved.direction === 'right' ? saved.direction : 'up',
        moving: false,
        step: 0,
      }
    }
  } catch {
    // A posição é apenas conveniência visual; um valor inválido reinicia o avatar.
  }
  return { x: 466, y: 505, direction: 'up', moving: false, step: 0 }
}

const interactions: Interaction[] = [
  { id: 'shelf', label: 'Abrir minha estante', shortLabel: 'Estante', hint: 'Sua coleção e progresso de leitura', x: 155, y: 316, color: '#d28b4b', page: 'shelf' },
  { id: 'library', label: 'Explorar biblioteca', shortLabel: 'Biblioteca', hint: 'O catálogo completo de livros', x: 805, y: 305, color: '#8aa877', page: 'library' },
  { id: 'timeline', label: 'Sentar e ver o início', shortLabel: 'Início', hint: 'Publicações da comunidade', x: 480, y: 225, color: '#d7a957', page: 'timeline' },
  { id: 'post', label: 'Escrever nova publicação', shortLabel: 'Publicar', hint: 'Compartilhe sua leitura', x: 610, y: 205, color: '#c17d51', action: 'post' },
  { id: 'profile', label: 'Ver meu perfil', shortLabel: 'Perfil', hint: 'Seu cantinho de leitor', x: 112, y: 472, color: '#a87966', page: 'profile' },
  { id: 'notifications', label: 'Ver correspondências', shortLabel: 'Avisos', hint: 'Notificações e novidades', x: 268, y: 478, color: '#6f8e92', page: 'notifications' },
  { id: 'dashboard', label: 'Abrir painel do superadmin', shortLabel: 'Painel', hint: 'Indicadores e administração', x: 495, y: 480, color: '#8f7356', page: 'superadmin' },
  { id: 'goals', label: 'Consultar metas', shortLabel: 'Metas', hint: 'Acompanhe seus objetivos', x: 700, y: 480, color: '#b19358', page: 'goals' },
  { id: 'store', label: 'Entrar na lojinha', shortLabel: 'Loja', hint: 'Produtos e pedidos', x: 850, y: 472, color: '#9e6d49', page: 'store' },
]

const solids: Solid[] = [
  { x: 42, y: 72, width: 208, height: 214 },
  { x: 710, y: 72, width: 208, height: 205 },
  { x: 355, y: 82, width: 252, height: 105 },
  { x: 58, y: 388, width: 114, height: 70 },
  { x: 222, y: 392, width: 92, height: 66 },
  { x: 385, y: 405, width: 220, height: 53 },
  { x: 652, y: 393, width: 112, height: 67 },
  { x: 810, y: 394, width: 104, height: 64 },
]

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, radius)
}

function drawBookcase(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, accent: string, title: string) {
  ctx.fillStyle = '#352419'
  roundedRect(ctx, x - 7, y - 8, width + 14, height + 18, 7)
  ctx.fill()
  ctx.fillStyle = '#6c472c'
  ctx.fillRect(x, y, width, height)
  ctx.fillStyle = '#2b1e16'
  ctx.fillRect(x + 11, y + 28, width - 22, height - 41)
  ctx.fillStyle = accent
  ctx.fillRect(x + 22, y - 18, width - 44, 29)
  ctx.fillStyle = '#fff5d9'
  ctx.font = '700 13px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText(title, x + width / 2, y + 1)

  const colors = ['#a85943', '#d2a649', '#567c72', '#8c6658', '#718954', '#bd7655', '#6f6aa0']
  for (let shelf = 0; shelf < 4; shelf += 1) {
    const sy = y + 39 + shelf * 40
    ctx.fillStyle = '#8a5d37'
    ctx.fillRect(x + 7, sy + 27, width - 14, 7)
    let bx = x + 16
    let index = shelf * 5
    while (bx < x + width - 15) {
      const bookWidth = 12 + ((index * 7) % 8)
      const bookHeight = 22 + ((index * 5) % 10)
      ctx.fillStyle = colors[index % colors.length]
      ctx.fillRect(bx, sy + 27 - bookHeight, bookWidth, bookHeight)
      ctx.fillStyle = 'rgba(255,255,255,.22)'
      ctx.fillRect(bx + 3, sy + 30 - bookHeight, 2, bookHeight - 6)
      bx += bookWidth + 5
      index += 1
    }
  }
}

function drawRug(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#6d3130'
  roundedRect(ctx, 305, 235, 350, 214, 20)
  ctx.fill()
  ctx.strokeStyle = '#c89758'
  ctx.lineWidth = 7
  roundedRect(ctx, 319, 249, 322, 186, 15)
  ctx.stroke()
  ctx.strokeStyle = '#8f5a41'
  ctx.lineWidth = 3
  roundedRect(ctx, 334, 264, 292, 156, 11)
  ctx.stroke()
  ctx.fillStyle = 'rgba(213, 171, 91, .28)'
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath()
    ctx.arc(360 + i * 40, 342, 8, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawDesk(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#4a3021'
  roundedRect(ctx, 355, 95, 252, 92, 7)
  ctx.fill()
  ctx.fillStyle = '#8c5d37'
  roundedRect(ctx, 365, 84, 232, 78, 6)
  ctx.fill()
  ctx.fillStyle = '#eadbb7'
  ctx.save()
  ctx.translate(474, 105)
  ctx.rotate(-0.05)
  ctx.fillRect(-47, 0, 45, 36)
  ctx.fillRect(2, 0, 45, 36)
  ctx.fillStyle = '#9c7850'
  ctx.fillRect(-1, 1, 2, 34)
  ctx.strokeStyle = '#bca781'
  ctx.lineWidth = 1
  for (let y = 8; y < 31; y += 7) {
    ctx.beginPath(); ctx.moveTo(-40, y); ctx.lineTo(-8, y); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(9, y); ctx.lineTo(40, y); ctx.stroke()
  }
  ctx.restore()
  ctx.fillStyle = '#b68245'
  ctx.fillRect(563, 106, 7, 38)
  ctx.fillStyle = '#243e3d'
  ctx.beginPath(); ctx.ellipse(566, 103, 14, 7, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#6d452b'
  ctx.fillRect(385, 162, 11, 44)
  ctx.fillRect(566, 162, 11, 44)
}

function drawSmallStation(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, color: string, icon: string, title: string) {
  ctx.fillStyle = '#3f2b20'
  roundedRect(ctx, x, y, width, 66, 7)
  ctx.fill()
  ctx.fillStyle = color
  roundedRect(ctx, x + 7, y + 7, width - 14, 47, 5)
  ctx.fill()
  ctx.fillStyle = '#fff6dc'
  ctx.font = '24px serif'
  ctx.textAlign = 'center'
  ctx.fillText(icon, x + width / 2, y + 37)
  ctx.fillStyle = '#4a2f20'
  ctx.font = '700 11px "Plus Jakarta Sans", sans-serif'
  ctx.fillText(title, x + width / 2, y + 83)
}

function drawRoom(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT)
  gradient.addColorStop(0, '#17110d')
  gradient.addColorStop(0.16, '#2b1d15')
  gradient.addColorStop(0.17, '#a8764f')
  gradient.addColorStop(1, '#c99b68')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  ctx.fillStyle = '#261a13'
  ctx.fillRect(0, 0, WORLD_WIDTH, 70)
  ctx.fillStyle = '#533825'
  ctx.fillRect(0, 62, WORLD_WIDTH, 12)
  ctx.fillStyle = '#d5aa70'
  for (let y = 77; y < WORLD_HEIGHT; y += 38) {
    ctx.fillRect(0, y, WORLD_WIDTH, 2)
  }
  ctx.strokeStyle = 'rgba(86, 51, 29, .2)'
  ctx.lineWidth = 2
  for (let x = -260; x < WORLD_WIDTH + 260; x += 120) {
    ctx.beginPath(); ctx.moveTo(x, 74); ctx.lineTo(x + 390, WORLD_HEIGHT); ctx.stroke()
  }

  ctx.fillStyle = '#e6c983'
  ctx.beginPath(); ctx.ellipse(480, 55, 100, 28, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#f9e8ab'
  ctx.beginPath(); ctx.ellipse(480, 55, 66, 19, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#52331e'
  ctx.fillRect(476, 0, 8, 38)

  drawRug(ctx)
  drawBookcase(ctx, 50, 90, 190, 184, '#a66438', 'MINHA ESTANTE')
  drawBookcase(ctx, 720, 90, 190, 176, '#597459', 'BIBLIOTECA')
  drawDesk(ctx)
  drawSmallStation(ctx, 58, 392, 114, '#865a52', '♙', 'PERFIL')
  drawSmallStation(ctx, 222, 396, 92, '#52747a', '✉', 'AVISOS')
  drawSmallStation(ctx, 385, 409, 220, '#675241', '▥', 'PAINEL')
  drawSmallStation(ctx, 652, 397, 112, '#957740', '◎', 'METAS')
  drawSmallStation(ctx, 810, 398, 104, '#855539', '◆', 'LOJA')

  ctx.fillStyle = 'rgba(48, 31, 20, .24)'
  ctx.beginPath(); ctx.ellipse(480, 558, 185, 22, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#5e4029'
  ctx.font = 'italic 16px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('“Entre páginas, todo caminho leva a uma história.”', 480, 565)
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player) {
  const { x, y, direction, moving, step } = player
  const animationFrame = Math.floor(step)
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))

  ctx.fillStyle = 'rgba(42, 26, 16, .3)'
  ctx.beginPath(); ctx.ellipse(14, 40, 13, 5, 0, 0, Math.PI * 2); ctx.fill()
  const bob = moving ? (animationFrame % 2 === 0 ? -1 : 0) : 0
  ctx.translate(0, bob)

  const legOffset = moving ? (animationFrame % 2 === 0 ? 3 : -3) : 0
  ctx.fillStyle = '#3b322d'
  ctx.fillRect(7 + legOffset, 31, 6, 10)
  ctx.fillRect(16 - legOffset, 31, 6, 10)
  ctx.fillStyle = '#492f22'
  ctx.fillRect(5 + legOffset, 39, 9, 4)
  ctx.fillRect(15 - legOffset, 39, 9, 4)

  ctx.fillStyle = '#6d3f2d'
  roundedRect(ctx, 4, 17, 21, 19, 6)
  ctx.fill()
  ctx.fillStyle = '#d49a64'
  ctx.fillRect(direction === 'left' ? 1 : 23, 20, 5, 12)

  ctx.fillStyle = '#9a5c38'
  ctx.beginPath(); ctx.arc(14, 12, 11, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#d6a16d'
  roundedRect(ctx, 6, 8, 16, 15, 6)
  ctx.fill()
  ctx.fillStyle = '#42291d'
  ctx.beginPath(); ctx.arc(14, 7, 10, Math.PI, Math.PI * 2); ctx.fill()
  ctx.fillRect(4, 7, 4, 9)
  ctx.fillRect(21, 7, 4, 9)

  if (direction !== 'up') {
    ctx.fillStyle = '#2b211d'
    const eyeShift = direction === 'left' ? -2 : direction === 'right' ? 2 : 0
    ctx.fillRect(10 + eyeShift, 14, 2, 2)
    ctx.fillRect(17 + eyeShift, 14, 2, 2)
  }

  ctx.fillStyle = '#d8ad53'
  ctx.fillRect(13, 18, 3, 14)
  ctx.restore()
}

function drawAvatarFace(ctx: CanvasRenderingContext2D, x: number, y: number, avatar: HTMLImageElement | null, fallback: string) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + 14, y + 13, 8, 0, Math.PI * 2)
  ctx.clip()
  if (avatar?.complete && avatar.naturalWidth) {
    ctx.drawImage(avatar, x + 6, y + 5, 16, 16)
  } else {
    ctx.fillStyle = '#d6a16d'
    ctx.fillRect(x + 6, y + 5, 16, 16)
    ctx.fillStyle = '#3b2418'
    ctx.font = '700 9px "Plus Jakarta Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText((fallback || 'L').charAt(0).toUpperCase(), x + 14, y + 16)
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(255, 236, 188, .75)'
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(x + 14, y + 13, 8.5, 0, Math.PI * 2); ctx.stroke()
}

function drawNpc(ctx: CanvasRenderingContext2D, npc: LibraryNpc, avatar: HTMLImageElement | null) {
  drawPlayer(ctx, npc)
  drawAvatarFace(ctx, npc.x, npc.y, avatar, npc.name)
  const firstName = npc.name.split(' ')[0] || npc.handle || 'Leitor'
  ctx.font = '700 10px "Plus Jakarta Sans", sans-serif'
  const status = npc.immersive ? 'NO MODO' : 'NPC'
  const labelWidth = Math.max(58, Math.min(104, Math.max(ctx.measureText(firstName).width + 16, ctx.measureText(status).width + 18)))
  ctx.fillStyle = 'rgba(31, 20, 14, .86)'
  roundedRect(ctx, npc.x + 14 - labelWidth / 2, npc.y - 27, labelWidth, 25, 6)
  ctx.fill()
  ctx.fillStyle = '#fff0c9'
  ctx.textAlign = 'center'
  ctx.fillText(firstName, npc.x + 14, npc.y - 17)
  ctx.fillStyle = npc.immersive ? '#62c98c' : '#b8aa99'
  ctx.font = '800 6px "Plus Jakarta Sans", sans-serif'
  ctx.fillText(status, npc.x + 14, npc.y - 7)
}

const RACE_ANIMALS = ['🐇', '🦊', '🐻', '🐱', '🐶', '🦉', '🐼', '🐸']

function raceAnimal(userId: string) {
  return RACE_ANIMALS[stableUserHash(userId) % RACE_ANIMALS.length]
}

function ReadingRaces({ users, books, shelf, onClose }: { users: RaceUser[]; books: RaceBook[]; shelf: RaceShelfEntry[]; onClose: () => void }) {
  const [tab, setTab] = useState<'book' | 'year'>('book')
  const availableBooks = useMemo(() => books
    .map(book => ({ book, racers: shelf.filter(entry => entry.bookId === book.id).length }))
    .filter(item => item.racers > 0)
    .sort((a, b) => b.racers - a.racers || a.book.title.localeCompare(b.book.title)), [books, shelf])
  const [selectedBookId, setSelectedBookId] = useState(() => availableBooks[0]?.book.id || '')
  const selectedBook = availableBooks.find(item => item.book.id === selectedBookId)?.book || availableBooks[0]?.book
  const usersById = useMemo(() => new Map(users.map(user => [user.id, user])), [users])
  const bookRacers = selectedBook ? shelf
    .filter(entry => entry.bookId === selectedBook.id)
    .map(entry => ({ entry, user: usersById.get(entry.userId) }))
    .filter((item): item is { entry: RaceShelfEntry; user: RaceUser } => Boolean(item.user))
    .sort((a, b) => b.entry.progress - a.entry.progress) : []
  const currentYear = new Date().getFullYear()
  const annualRacers = users.map(user => ({
    user,
    total: shelf.filter(entry => entry.userId === user.id && (entry.status === 'read' || entry.status === 'favorite') && entry.endDate && new Date(entry.endDate).getFullYear() === currentYear).length,
  })).filter(item => item.total > 0).sort((a, b) => b.total - a.total)
  const annualLeader = Math.max(1, annualRacers[0]?.total || 1)

  const sharedTrack = (racers: { user: RaceUser; progress: number; detail: string }[], checkpoints: string[]) => {
    const trackHeight = Math.max(190, 48 + racers.length * 38)
    return (
      <div className="overflow-x-hidden rounded-xl border-2 border-[#b8814f] bg-[#91704b] p-2 shadow-inner shadow-black/40">
        <div className="relative overflow-hidden rounded-lg bg-[linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(#73543a,#8e6b49)] bg-[size:12.5%_100%,100%_100%]" style={{ height: trackHeight }}>
          <div className="absolute inset-y-0 left-[6%] border-l-2 border-dashed border-amber-50/55" />
          <div className="absolute inset-y-0 right-[6%] w-2 bg-[repeating-conic-gradient(#f8ead0_0_25%,#3d2a20_0_50%)] bg-[size:8px_8px] shadow-md" />
          <span className="absolute right-[2%] top-1 text-2xl drop-shadow-lg">🏁</span>
          <div className="absolute inset-x-[6%] top-2 flex justify-between text-[8px] font-black uppercase tracking-wide text-amber-50/60">
            {checkpoints.map((label, index) => <span key={`${label}-${index}`} className={index === checkpoints.length - 1 ? 'translate-x-1/2' : index === 0 ? '-translate-x-1/2' : ''}>{label}</span>)}
          </div>
          {racers.map((racer, index) => {
            const position = 6 + Math.max(0, Math.min(100, racer.progress)) * 0.88
            return (
              <div key={racer.user.id} className="absolute flex -translate-x-1/2 items-center gap-1 transition-all duration-500" style={{ left: `${position}%`, top: 31 + index * 38 }}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2f2118]/80 text-xl shadow-lg ring-1 ring-amber-100/25">{raceAnimal(racer.user.id)}</span>
                <span className={`max-w-28 whitespace-nowrap rounded-md bg-[#24160f]/90 px-1.5 py-1 text-[8px] font-extrabold leading-tight text-amber-50 shadow-md ${position > 76 ? '-order-1 text-right' : ''}`}>
                  <span className="block truncate">#{index + 1} {racer.user.name.split(' ')[0]}</span>
                  <span className="block text-[7px] text-amber-200/65">{racer.detail}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-[#0e0906]/80 p-2 backdrop-blur-sm sm:items-center sm:p-5" onClick={event => event.currentTarget === event.target && onClose()}>
      <section className="flex max-h-[88%] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-200/25 bg-[#24160f] shadow-2xl shadow-black/70">
        <header className="flex items-center justify-between border-b border-amber-100/15 px-4 py-3">
          <div><p className="font-serif text-lg font-bold text-amber-50">Corrida de leitura</p><p className="text-[10px] font-bold uppercase tracking-[.16em] text-amber-200/55">Clube da estante</p></div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-white/75 hover:bg-white/10">×</button>
        </header>
        <div className="grid grid-cols-2 gap-1 border-b border-amber-100/10 p-2">
          <button type="button" onClick={() => setTab('book')} className={`rounded-lg px-3 py-2 text-xs font-extrabold ${tab === 'book' ? 'bg-amber-200 text-[#28180f]' : 'text-amber-100/60 hover:bg-white/5'}`}>Por livro</button>
          <button type="button" onClick={() => setTab('year')} className={`rounded-lg px-3 py-2 text-xs font-extrabold ${tab === 'year' ? 'bg-amber-200 text-[#28180f]' : 'text-amber-100/60 hover:bg-white/5'}`}>Geral {currentYear}</button>
        </div>
        <div className="overflow-y-auto p-3 sm:p-4">
          {tab === 'book' ? <>
            {availableBooks.length ? <select value={selectedBook?.id || ''} onChange={event => setSelectedBookId(event.target.value)} className="mb-4 w-full rounded-lg border border-amber-100/20 bg-[#160e0a] px-3 py-2 text-xs font-bold text-amber-50 outline-none focus:border-amber-300">
              {availableBooks.map(item => <option key={item.book.id} value={item.book.id}>{item.book.title} · {item.racers} corredor(es)</option>)}
            </select> : null}
            {bookRacers.length ? sharedTrack(
              bookRacers.map(item => ({ user: item.user, progress: item.entry.progress, detail: `Cap. ${Math.round((item.entry.progress / 100) * Math.max(1, selectedBook?.totalChapters || 1))}` })),
              ['Início', `Cap. ${Math.round(Math.max(1, selectedBook?.totalChapters || 1) / 2)}`, `Cap. ${Math.max(1, selectedBook?.totalChapters || 1)}`],
            ) : <p className="py-10 text-center text-sm text-amber-100/50">Nenhuma corrida de livro disponível ainda.</p>}
          </> : <>
            {annualRacers.length ? sharedTrack(
              annualRacers.map(item => ({ user: item.user, progress: (item.total / annualLeader) * 100, detail: `${item.total} livro${item.total === 1 ? '' : 's'}` })),
              ['Início', `${Math.max(1, Math.ceil(annualLeader / 2))} livros`, `${annualLeader} livros`],
            ) : <p className="py-10 text-center text-sm text-amber-100/50">Ainda não há livros concluídos em {currentYear}.</p>}
          </>}
        </div>
      </section>
    </div>
  )
}

function overlapsSolid(x: number, y: number) {
  const foot = { x: x + 5, y: y + 31, width: PLAYER_WIDTH - 10, height: 11 }
  if (foot.x < 20 || foot.y < 74 || foot.x + foot.width > WORLD_WIDTH - 20 || foot.y + foot.height > WORLD_HEIGHT - 18) return true
  return solids.some(solid => foot.x < solid.x + solid.width && foot.x + foot.width > solid.x && foot.y < solid.y + solid.height && foot.y + foot.height > solid.y)
}

function nearestInteraction(player: Player, isSuperAdmin: boolean) {
  const px = player.x + PLAYER_WIDTH / 2
  const py = player.y + PLAYER_HEIGHT / 2
  let nearest: Interaction | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const interaction of interactions) {
    if (!isSuperAdmin && (interaction.id === 'dashboard' || interaction.id === 'store')) continue
    const distance = Math.hypot(px - interaction.x, py - interaction.y)
    if (distance < 82 && distance < nearestDistance) {
      nearest = interaction
      nearestDistance = distance
    }
  }
  return nearest
}

export default function ImmersiveLibrary({ currentUser, onlineUsers, token, hubUrl, mediaBaseUrl, isSuperAdmin, raceUsers, raceBooks, raceShelf, onExit, onNavigate, onCreatePost, onUserClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const interactionPromptRef = useRef<HTMLDivElement | null>(null)
  const keysRef = useRef<Record<string, boolean>>({})
  const playerRef = useRef<Player>(storedPlayer())
  const npcsRef = useRef<LibraryNpc[]>([])
  const avatarImagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const immersiveConnectionRef = useRef<ReturnType<HubConnectionBuilder['build']> | null>(null)
  const lastMoveBroadcastRef = useRef(0)
  const lastTimeRef = useRef(0)
  const walkTimeRef = useRef(0)
  const [nearby, setNearby] = useState<Interaction | null>(null)
  const [nearbyUser, setNearbyUser] = useState<LibraryNpc | null>(null)
  const [showRaces, setShowRaces] = useState(false)
  const nearbyRef = useRef<Interaction | null>(null)
  const nearbyUserRef = useRef<LibraryNpc | null>(null)
  const [showGuide, setShowGuide] = useState(() => sessionStorage.getItem(GUIDE_SEEN_KEY) !== '1')

  function dismissGuide() {
    sessionStorage.setItem(GUIDE_SEEN_KEY, '1')
    setShowGuide(false)
  }

  useEffect(() => {
    const previous = new Map(npcsRef.current.map(npc => [npc.id, npc]))
    npcsRef.current = onlineUsers.slice(0, 20).map((user, index) => {
      const existing = previous.get(user.id)
      // O estado recebido em tempo real tem prioridade sobre a consulta periódica.
      // A saída efetiva é tratada pelo evento immersivePlayerLeft.
      const immersive = Boolean(user.immersive || existing?.immersive)
      if (existing) {
        // Enquanto estiver no modo, apenas o canal em tempo real pode alterar
        // movimento e posição. A consulta HTTP pode conter coordenadas antigas.
        if (existing.immersive) return {
          ...existing,
          name: user.name,
          handle: user.handle,
          avatar: user.avatar,
        }
        return {
          ...existing,
          ...user,
          immersive,
          x: existing.x,
          y: existing.y,
          targetX: immersive && typeof user.x === 'number' ? user.x : existing.targetX,
          targetY: immersive && typeof user.y === 'number' ? user.y : existing.targetY,
          direction: user.direction || existing.direction,
          moving: immersive ? Boolean(user.moving) : existing.moving,
        }
      }
      const patrol = deterministicNpcPosition(user.id)
      const initialX = immersive && typeof user.x === 'number' ? user.x : patrol.x
      const initialY = immersive && typeof user.y === 'number' ? user.y : patrol.y
      return {
        ...user,
        immersive,
        x: initialX,
        y: initialY,
        targetX: initialX,
        targetY: initialY,
        route: [],
        direction: user.direction || patrol.direction,
        moving: immersive ? Boolean(user.moving) : true,
        step: index % 4,
        decisionTimer: 0.5 + (index % 5) * 0.4,
        speed: 42 + (index % 4) * 5,
      }
    })

    for (const user of [currentUser, ...onlineUsers]) {
      const url = user.avatar || ''
      if (!/^(https?:|\/\/|\/|uploads\/|media\/|files\/)/i.test(url) || avatarImagesRef.current.has(url)) continue
      const image = new Image()
      image.decoding = 'async'
      image.src = url
      avatarImagesRef.current.set(url, image)
    }
  }, [currentUser, onlineUsers])

  useEffect(() => {
    type RemotePlayer = {
      userId: string
      name: string
      handle: string
      avatar: string
      x: number
      y: number
      direction: Direction
      moving: boolean
    }

    const resolveAvatar = (value: string) => {
      if (!value) return 'L'
      if (/^https?:\/\//i.test(value)) return value
      if (value.startsWith('/')) return `${mediaBaseUrl.replace(/\/$/, '')}${value}`
      if (/^(uploads|media|files)\//i.test(value)) return `${mediaBaseUrl.replace(/\/$/, '')}/${value}`
      return value
    }
    const upsertRemote = (remote: RemotePlayer) => {
      if (remote.userId === currentUser.id) return
      const avatar = resolveAvatar(remote.avatar)
      const index = npcsRef.current.findIndex(npc => npc.id === remote.userId)
      const receivedAt = performance.now()
      const waypoint: RemoteWaypoint = {
        x: remote.x,
        y: remote.y,
        direction: remote.direction || 'down',
        moving: Boolean(remote.moving),
        receivedAt,
      }
      const base: LibraryNpc = {
        id: remote.userId,
        name: remote.name,
        handle: remote.handle,
        avatar,
        immersive: true,
        x: remote.x,
        y: remote.y,
        targetX: remote.x,
        targetY: remote.y,
        route: [waypoint],
        direction: remote.direction || 'down',
        moving: Boolean(remote.moving),
        step: 0,
        decisionTimer: 1,
        speed: 48,
      }
      if (index >= 0) {
        const existing = npcsRef.current[index]
        const lastPoint = existing.route[existing.route.length - 1]
        const origin = lastPoint || { x: existing.x, y: existing.y, direction: existing.direction, moving: existing.moving, receivedAt: receivedAt - 100 }
        const jumpDistance = Math.hypot(remote.x - origin.x, remote.y - origin.y)
        const route = jumpDistance > 110
          ? [waypoint]
          : [...(existing.route.length ? existing.route : [origin]), waypoint].slice(-24)
        npcsRef.current[index] = {
          ...existing,
          ...base,
          x: existing.x,
          y: existing.y,
          targetX: remote.x,
          targetY: remote.y,
          route,
        }
      } else npcsRef.current.push(base)
      if (/^(https?:|\/\/|\/)/i.test(avatar) && !avatarImagesRef.current.has(avatar)) {
        const image = new Image()
        image.decoding = 'async'
        image.src = avatar
        avatarImagesRef.current.set(avatar, image)
      }
    }
    const handleSnapshot = (players: RemotePlayer[]) => {
      npcsRef.current.forEach(npc => { npc.immersive = false })
      players.forEach(upsertRemote)
    }
    const handleLeft = ({ userId }: { userId: string }) => {
      const npc = npcsRef.current.find(item => item.id === userId)
      if (npc) {
        npc.immersive = false
        npc.moving = false
        npc.route = []
        npc.decisionTimer = 0.5
      }
    }

    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build()
    immersiveConnectionRef.current = connection
    connection.on('immersiveSnapshot', handleSnapshot)
    connection.on('immersivePlayerJoined', upsertRemote)
    connection.on('immersivePlayerMoved', upsertRemote)
    connection.on('immersivePlayerLeft', handleLeft)

    const enter = () => {
      const player = playerRef.current
      return connection.invoke('EnterImmersive', player.x, player.y, player.direction)
    }
    connection.onreconnected(() => { void enter().catch(() => undefined) })
    void connection.start().then(enter).catch(() => undefined)

    return () => {
      immersiveConnectionRef.current = null
      connection.off('immersiveSnapshot', handleSnapshot)
      connection.off('immersivePlayerJoined', upsertRemote)
      connection.off('immersivePlayerMoved', upsertRemote)
      connection.off('immersivePlayerLeft', handleLeft)
      if (connection.state === HubConnectionState.Connected) {
        void connection.invoke('LeaveImmersive').finally(() => connection.stop())
      } else if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop()
      }
    }
  }, [currentUser.id, hubUrl, mediaBaseUrl, token])

  const useInteraction = useCallback(() => {
    const interaction = nearbyRef.current
    if (!interaction) return
    if (interaction.action === 'post') {
      onCreatePost()
      return
    }
    if (interaction.page) onNavigate(interaction.page)
  }, [onCreatePost, onNavigate])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const canvasNode = canvas
    const context = ctx
    context.imageSmoothingEnabled = false

    function resizeCanvas() {
      const width = Math.max(1, Math.round(canvasNode.clientWidth * window.devicePixelRatio))
      const height = Math.max(1, Math.round(canvasNode.clientHeight * window.devicePixelRatio))
      if (canvasNode.width !== width || canvasNode.height !== height) {
        canvasNode.width = width
        canvasNode.height = height
        context.imageSmoothingEnabled = false
      }
    }

    function drawViewport(player: Player) {
      const viewWidth = canvasNode.width
      const viewHeight = canvasNode.height
      const portrait = viewHeight > viewWidth
      const scale = portrait
        ? Math.max(viewWidth / 420, viewHeight / WORLD_HEIGHT)
        : Math.min(viewWidth / WORLD_WIDTH, viewHeight / WORLD_HEIGHT)
      const visibleWorldWidth = viewWidth / scale
      const visibleWorldHeight = viewHeight / scale
      const playerCenterX = player.x + PLAYER_WIDTH / 2
      const playerCenterY = player.y + PLAYER_HEIGHT / 2
      const cameraX = portrait
        ? Math.max(0, Math.min(WORLD_WIDTH - visibleWorldWidth, playerCenterX - visibleWorldWidth / 2))
        : -(visibleWorldWidth - WORLD_WIDTH) / 2
      const cameraY = portrait
        ? Math.max(0, Math.min(WORLD_HEIGHT - visibleWorldHeight, playerCenterY - visibleWorldHeight / 2))
        : -(visibleWorldHeight - WORLD_HEIGHT) / 2

      const prompt = interactionPromptRef.current
      const interaction = nearbyUserRef.current || nearbyRef.current
      if (prompt && interaction) {
        if (canvasNode.clientWidth < 640) {
          const pixelRatio = window.devicePixelRatio || 1
          const cssWidth = viewWidth / pixelRatio
          const cssHeight = viewHeight / pixelRatio
          const interactionX = ((interaction.x - cameraX) * scale) / pixelRatio
          const interactionY = ((interaction.y - cameraY) * scale) / pixelRatio
          const promptHalfWidth = Math.min(90, cssWidth * 0.24)
          const promptX = Math.max(promptHalfWidth + 8, Math.min(cssWidth - promptHalfWidth - 8, interactionX))
          const promptY = Math.max(155, Math.min(cssHeight - 96, interactionY - 18))
          prompt.style.left = `${promptX}px`
          prompt.style.top = `${promptY}px`
          prompt.style.bottom = 'auto'
        } else {
          prompt.style.left = '50%'
          prompt.style.top = 'auto'
          prompt.style.bottom = '24px'
        }
      }

      context.setTransform(1, 0, 0, 1, 0, 0)
      context.fillStyle = '#120d09'
      context.fillRect(0, 0, viewWidth, viewHeight)
      context.save()
      context.scale(scale, scale)
      context.translate(-cameraX, -cameraY)
      drawRoom(context)
      for (const npc of npcsRef.current) {
        drawNpc(context, npc, avatarImagesRef.current.get(npc.avatar || '') || null)
      }
      drawPlayer(context, player)
      drawAvatarFace(context, player.x, player.y, avatarImagesRef.current.get(currentUser.avatar || '') || null, currentUser.name)
      context.restore()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault()
      keysRef.current[event.code] = true
      if ((event.code === 'Enter' || event.code === 'KeyE' || event.code === 'Space') && !event.repeat) useInteraction()
      if (event.code === 'Escape') onExit()
    }

    function handleKeyUp(event: KeyboardEvent) {
      keysRef.current[event.code] = false
    }

    function animate(time: number) {
      const delta = Math.min((time - (lastTimeRef.current || time)) / 1000, 0.035)
      lastTimeRef.current = time
      const keys = keysRef.current
      const player = playerRef.current
      let dx = 0
      let dy = 0
      if (keys.ArrowUp || keys.KeyW) { dy -= 1; player.direction = 'up' }
      if (keys.ArrowDown || keys.KeyS) { dy += 1; player.direction = 'down' }
      if (keys.ArrowLeft || keys.KeyA) { dx -= 1; player.direction = 'left' }
      if (keys.ArrowRight || keys.KeyD) { dx += 1; player.direction = 'right' }
      if (dx && dy) { dx *= 0.707; dy *= 0.707 }
      player.moving = dx !== 0 || dy !== 0
      if (player.moving) {
        const speed = 185 * delta
        const nextX = player.x + dx * speed
        const nextY = player.y + dy * speed
        if (!overlapsSolid(nextX, player.y)) player.x = nextX
        if (!overlapsSolid(player.x, nextY)) player.y = nextY
        walkTimeRef.current += delta
        if (walkTimeRef.current > 0.14) {
          player.step = (player.step + 1) % 4
          walkTimeRef.current = 0
        }
      } else {
        player.step = 0
      }

      const immersiveConnection = immersiveConnectionRef.current
      if (immersiveConnection?.state === HubConnectionState.Connected && time - lastMoveBroadcastRef.current >= 90) {
        lastMoveBroadcastRef.current = time
        void immersiveConnection.invoke('MoveImmersive', player.x, player.y, player.direction, player.moving).catch(() => undefined)
      }

      for (const npc of npcsRef.current) {
        if (npc.immersive) {
          const playbackTime = time - 140
          while (npc.route.length >= 2 && npc.route[1].receivedAt <= playbackTime) npc.route.shift()
          if (npc.route.length >= 2) {
            const from = npc.route[0]
            const to = npc.route[1]
            const duration = Math.max(1, to.receivedAt - from.receivedAt)
            const progress = Math.max(0, Math.min(1, (playbackTime - from.receivedAt) / duration))
            npc.x = from.x + (to.x - from.x) * progress
            npc.y = from.y + (to.y - from.y) * progress
            npc.direction = to.direction
            npc.moving = to.moving
          } else if (npc.route.length === 1 && playbackTime >= npc.route[0].receivedAt) {
            const point = npc.route[0]
            npc.x = point.x
            npc.y = point.y
            npc.direction = point.direction
            npc.moving = point.moving
          }
          if (npc.moving) npc.step = (npc.step + delta * 7) % 4
          else npc.step = 0
          continue
        }
        const patrol = deterministicNpcPosition(npc.id)
        npc.x = patrol.x
        npc.y = patrol.y
        npc.targetX = patrol.x
        npc.targetY = patrol.y
        npc.direction = patrol.direction
        npc.moving = true
        npc.step = (npc.step + delta * 7) % 4
      }

      const nextNearby = nearestInteraction(player, isSuperAdmin)
      if (nextNearby?.id !== nearbyRef.current?.id) {
        nearbyRef.current = nextNearby
        setNearby(nextNearby)
      }
      const playerCenterX = player.x + PLAYER_WIDTH / 2
      const playerCenterY = player.y + PLAYER_HEIGHT / 2
      const nextNearbyUser = npcsRef.current
        .map(npc => ({ npc, distance: Math.hypot(playerCenterX - (npc.x + PLAYER_WIDTH / 2), playerCenterY - (npc.y + PLAYER_HEIGHT / 2)) }))
        .filter(item => item.distance < 58)
        .sort((a, b) => a.distance - b.distance)[0]?.npc || null
      if (nextNearbyUser?.id !== nearbyUserRef.current?.id) {
        nearbyUserRef.current = nextNearbyUser
        setNearbyUser(nextNearbyUser)
      }

      resizeCanvas()
      drawViewport(player)
      frameRef.current = window.requestAnimationFrame(animate)
    }

    const resizeObserver = new ResizeObserver(resizeCanvas)
    resizeObserver.observe(canvasNode)
    window.addEventListener('keydown', handleKeyDown, { passive: false })
    window.addEventListener('keyup', handleKeyUp)
    canvasNode.focus()
    frameRef.current = window.requestAnimationFrame(animate)
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      sessionStorage.setItem(PLAYER_POSITION_KEY, JSON.stringify(playerRef.current))
      resizeObserver.disconnect()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [currentUser.avatar, currentUser.name, isSuperAdmin, onExit, useInteraction])

  function pressKey(code: string, pressed: boolean) {
    keysRef.current[code] = pressed
  }

  const directionButton = (code: string, label: string, className: string) => (
    <button
      type="button"
      aria-label={label}
      className={`absolute flex h-12 w-12 touch-none select-none items-center justify-center rounded-xl border border-amber-100/25 bg-stone-950/75 text-xl font-black text-amber-100 shadow-lg backdrop-blur ${className}`}
      onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pressKey(code, true) }}
      onPointerUp={() => pressKey(code, false)}
      onPointerCancel={() => pressKey(code, false)}
      onPointerLeave={() => pressKey(code, false)}
    >
      {label}
    </button>
  )

  return (
    <main className="fixed inset-0 z-[100] overflow-hidden bg-[#120d09] text-[#fff4dc]">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-10 pt-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border-2 border-amber-200/50 bg-[#6d452b] shadow-lg">
            {currentUser.avatar ? <img src={currentUser.avatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center font-serif text-xl">{currentUser.name.charAt(0)}</span>}
          </div>
          <div className="min-w-0">
            <p className="truncate font-serif text-base font-bold text-amber-50 sm:text-lg">Biblioteca de {currentUser.name.split(' ')[0]}</p>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/70">Modo imersão · {onlineUsers.length + 1} online</p>
          </div>
        </div>
        <button type="button" onClick={onExit} className="shrink-0 rounded-lg border border-white/20 bg-black/40 px-3 py-2 text-xs font-bold text-white/85 backdrop-blur transition hover:bg-black/65 hover:text-white">
          <span className="hidden sm:inline">Sair da imersão </span>×
        </button>
      </div>

      <div className="flex h-full items-center justify-center p-0 sm:p-4">
        <div className="relative h-full w-full max-w-[1200px] overflow-hidden bg-[#c99b68] shadow-2xl shadow-black/70 sm:h-auto sm:aspect-[8/5] sm:rounded-2xl sm:border sm:border-amber-100/15">
          <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} tabIndex={0} aria-label="Biblioteca interativa. Use as setas ou WASD para caminhar." className="block h-full w-full outline-none" />

          {showGuide && (
            <div className="absolute left-1/2 top-[18%] w-[min(88%,420px)] -translate-x-1/2 rounded-xl border border-amber-100/20 bg-[#21150f]/90 p-4 text-center shadow-2xl backdrop-blur-sm">
              <p className="font-serif text-lg font-bold text-amber-50">Caminhe entre suas histórias</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/75">Use <strong>WASD</strong> ou as <strong>setas</strong>. Aproxime-se dos móveis e pressione <strong>E</strong> ou <strong>Enter</strong> para abrir.</p>
              <button type="button" onClick={dismissGuide} className="mt-3 rounded-lg bg-amber-200 px-4 py-2 text-xs font-extrabold text-[#2b1a10] transition hover:bg-amber-100">Começar a explorar</button>
            </div>
          )}

          {nearby && !nearbyUser && !showGuide && (
            <div ref={interactionPromptRef} className="absolute z-10 w-auto max-w-[180px] -translate-x-1/2 -translate-y-full text-center sm:w-[390px] sm:max-w-none sm:translate-y-0 sm:rounded-xl sm:border sm:border-amber-100/25 sm:bg-[#1c120d]/95 sm:p-3 sm:shadow-2xl sm:backdrop-blur-sm">
              <button type="button" onClick={useInteraction} className="whitespace-nowrap rounded-lg px-3 py-2 text-xs font-extrabold text-[#21150f] shadow-xl transition hover:brightness-110 sm:hidden" style={{ backgroundColor: nearby.color }}>
                {nearby.shortLabel}, abrir
              </button>
              {nearby.id === 'shelf' && <button type="button" onClick={() => setShowRaces(true)} className="mt-1.5 whitespace-nowrap rounded-lg bg-emerald-300 px-3 py-2 text-xs font-extrabold text-[#17251d] shadow-xl transition hover:bg-emerald-200 sm:hidden">Corridas, abrir</button>}
              <div className="hidden sm:block">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-200/65">Você encontrou</p>
                <p className="mt-0.5 font-serif text-base font-bold text-amber-50">{nearby.label}</p>
                <p className="mt-0.5 text-[11px] text-amber-100/60">{nearby.hint}</p>
                <button type="button" onClick={useInteraction} className="mt-2 rounded-lg px-4 py-2 text-xs font-extrabold text-[#21150f] shadow-lg transition hover:brightness-110" style={{ backgroundColor: nearby.color }}>
                  Abrir <span className="ml-1 opacity-60">E / Enter</span>
                </button>
                {nearby.id === 'shelf' && <button type="button" onClick={() => setShowRaces(true)} className="ml-2 mt-2 rounded-lg bg-emerald-300 px-4 py-2 text-xs font-extrabold text-[#17251d] transition hover:bg-emerald-200">Ver corridas</button>}
              </div>
            </div>
          )}

          {nearbyUser && !showGuide && (
            <div ref={interactionPromptRef} className="absolute z-10 w-auto max-w-[190px] -translate-x-1/2 -translate-y-full text-center sm:w-[340px] sm:max-w-none sm:translate-y-0 sm:rounded-xl sm:border sm:border-amber-100/25 sm:bg-[#1c120d]/95 sm:p-3 sm:shadow-2xl sm:backdrop-blur-sm">
              <button type="button" onClick={() => onUserClick(nearbyUser.id)} className="whitespace-nowrap rounded-lg bg-emerald-300 px-3 py-2 text-xs font-extrabold text-[#17251d] shadow-xl transition hover:bg-emerald-200 sm:hidden">
                {nearbyUser.name.split(' ')[0]}, ver perfil
              </button>
              <div className="hidden sm:block">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-300/75">{nearbyUser.immersive ? 'Explorando agora' : 'Personagem NPC'}</p>
                <p className="mt-1 font-serif text-base font-bold text-amber-50">{nearbyUser.name}</p>
                <p className="mt-0.5 text-[11px] text-amber-100/60">@{nearbyUser.handle || 'leitor'}</p>
                <button type="button" onClick={() => onUserClick(nearbyUser.id)} className="mt-2 rounded-lg bg-emerald-300 px-4 py-2 text-xs font-extrabold text-[#17251d] transition hover:bg-emerald-200">Ver perfil</button>
              </div>
            </div>
          )}

          {showRaces && <ReadingRaces users={raceUsers} books={raceBooks} shelf={raceShelf} onClose={() => setShowRaces(false)} />}

          <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 h-40 w-40 sm:hidden">
            {directionButton('ArrowUp', '↑', 'left-14 top-0')}
            {directionButton('ArrowLeft', '←', 'left-0 top-14')}
            {directionButton('ArrowDown', '↓', 'left-14 top-14')}
            {directionButton('ArrowRight', '→', 'left-28 top-14')}
          </div>
        </div>
      </div>
    </main>
  )
}
