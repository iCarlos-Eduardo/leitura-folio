import { useCallback, useEffect, useRef, useState } from 'react'

type ImmersiveDestination = 'timeline' | 'shelf' | 'library' | 'profile' | 'goals' | 'notifications' | 'superadmin' | 'store'

type LibraryUser = {
  name: string
  handle: string
  avatar?: string
}

type Props = {
  currentUser: LibraryUser
  onExit: () => void
  onNavigate: (page: ImmersiveDestination) => void
  onCreatePost: () => void
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
  hint: string
  x: number
  y: number
  color: string
  page?: ImmersiveDestination
  action?: 'post'
}

type Solid = { x: number; y: number; width: number; height: number }

const WORLD_WIDTH = 960
const WORLD_HEIGHT = 600
const PLAYER_WIDTH = 28
const PLAYER_HEIGHT = 42

const interactions: Interaction[] = [
  { id: 'shelf', label: 'Abrir minha estante', hint: 'Sua coleção e progresso de leitura', x: 155, y: 316, color: '#d28b4b', page: 'shelf' },
  { id: 'library', label: 'Explorar biblioteca', hint: 'O catálogo completo de livros', x: 805, y: 305, color: '#8aa877', page: 'library' },
  { id: 'timeline', label: 'Sentar e ver o início', hint: 'Publicações da comunidade', x: 480, y: 225, color: '#d7a957', page: 'timeline' },
  { id: 'post', label: 'Escrever nova publicação', hint: 'Compartilhe sua leitura', x: 610, y: 205, color: '#c17d51', action: 'post' },
  { id: 'profile', label: 'Ver meu perfil', hint: 'Seu cantinho de leitor', x: 112, y: 472, color: '#a87966', page: 'profile' },
  { id: 'notifications', label: 'Ver correspondências', hint: 'Notificações e novidades', x: 268, y: 478, color: '#6f8e92', page: 'notifications' },
  { id: 'dashboard', label: 'Abrir painel do superadmin', hint: 'Indicadores e administração', x: 495, y: 480, color: '#8f7356', page: 'superadmin' },
  { id: 'goals', label: 'Consultar metas', hint: 'Acompanhe seus objetivos', x: 700, y: 480, color: '#b19358', page: 'goals' },
  { id: 'store', label: 'Entrar na lojinha', hint: 'Produtos e pedidos', x: 850, y: 472, color: '#9e6d49', page: 'store' },
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
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))

  ctx.fillStyle = 'rgba(42, 26, 16, .3)'
  ctx.beginPath(); ctx.ellipse(14, 40, 13, 5, 0, 0, Math.PI * 2); ctx.fill()
  const bob = moving ? (step % 2 === 0 ? -1 : 0) : 0
  ctx.translate(0, bob)

  const legOffset = moving ? (step % 2 === 0 ? 3 : -3) : 0
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

function overlapsSolid(x: number, y: number) {
  const foot = { x: x + 5, y: y + 31, width: PLAYER_WIDTH - 10, height: 11 }
  if (foot.x < 20 || foot.y < 74 || foot.x + foot.width > WORLD_WIDTH - 20 || foot.y + foot.height > WORLD_HEIGHT - 18) return true
  return solids.some(solid => foot.x < solid.x + solid.width && foot.x + foot.width > solid.x && foot.y < solid.y + solid.height && foot.y + foot.height > solid.y)
}

function nearestInteraction(player: Player) {
  const px = player.x + PLAYER_WIDTH / 2
  const py = player.y + PLAYER_HEIGHT / 2
  let nearest: Interaction | null = null
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const interaction of interactions) {
    const distance = Math.hypot(px - interaction.x, py - interaction.y)
    if (distance < 82 && distance < nearestDistance) {
      nearest = interaction
      nearestDistance = distance
    }
  }
  return nearest
}

export default function ImmersiveLibrary({ currentUser, onExit, onNavigate, onCreatePost }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const interactionPromptRef = useRef<HTMLDivElement | null>(null)
  const keysRef = useRef<Record<string, boolean>>({})
  const playerRef = useRef<Player>({ x: 466, y: 505, direction: 'up', moving: false, step: 0 })
  const lastTimeRef = useRef(0)
  const walkTimeRef = useRef(0)
  const [nearby, setNearby] = useState<Interaction | null>(null)
  const nearbyRef = useRef<Interaction | null>(null)
  const [showGuide, setShowGuide] = useState(true)

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
      const interaction = nearbyRef.current
      if (prompt && interaction) {
        if (canvasNode.clientWidth < 640) {
          const pixelRatio = window.devicePixelRatio || 1
          const cssWidth = viewWidth / pixelRatio
          const cssHeight = viewHeight / pixelRatio
          const interactionX = ((interaction.x - cameraX) * scale) / pixelRatio
          const interactionY = ((interaction.y - cameraY) * scale) / pixelRatio
          const promptHalfWidth = Math.min(150, cssWidth * 0.39)
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
      drawPlayer(context, player)
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

      const nextNearby = nearestInteraction(player)
      if (nextNearby?.id !== nearbyRef.current?.id) {
        nearbyRef.current = nextNearby
        setNearby(nextNearby)
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
      resizeObserver.disconnect()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [onExit, useInteraction])

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
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/70">Modo imersão · Superadmin</p>
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
              <button type="button" onClick={() => setShowGuide(false)} className="mt-3 rounded-lg bg-amber-200 px-4 py-2 text-xs font-extrabold text-[#2b1a10] transition hover:bg-amber-100">Começar a explorar</button>
            </div>
          )}

          {nearby && !showGuide && (
            <div ref={interactionPromptRef} className="absolute z-10 w-[min(78%,300px)] -translate-x-1/2 -translate-y-full rounded-xl border border-amber-100/25 bg-[#1c120d]/95 p-3 text-center shadow-2xl backdrop-blur-sm sm:w-[390px] sm:translate-y-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-200/65">Você encontrou</p>
              <p className="mt-0.5 font-serif text-base font-bold text-amber-50">{nearby.label}</p>
              <p className="mt-0.5 text-[11px] text-amber-100/60">{nearby.hint}</p>
              <button type="button" onClick={useInteraction} className="mt-2 rounded-lg px-4 py-2 text-xs font-extrabold text-[#21150f] shadow-lg transition hover:brightness-110" style={{ backgroundColor: nearby.color }}>
                Abrir <span className="ml-1 hidden opacity-60 sm:inline">E / Enter</span>
              </button>
            </div>
          )}

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
