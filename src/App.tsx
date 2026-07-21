import { useEffect, useMemo, useRef, useState } from 'react'

type BookStatus = 'reading' | 'want' | 'read' | 'rereading' | 'abandoned'
type PostType = 'comment' | 'reaction' | 'theory'
type Page = 'timeline' | 'shelf' | 'library' | 'book' | 'profile' | 'profile-list' | 'goals' | 'notifications'
type ProfileListKind = 'following' | 'followers' | 'posts'
type BookSearchField = 'all' | 'title' | 'author' | 'series' | 'genre' | 'trope' | 'tag'
type ColorTheme = 'light' | 'dark'

const BRAND_NAME = ''
const BRAND_LOGO_URL = '/assets/image/logo/logo.jpeg'

interface User {
  id: string
  name: string
  email: string
  password: string
  role?: 'admin' | 'reader'
  handle: string
  bio: string
  avatar: string
  booksRead: number
  pagesRead: number
  following: string[]
  followers: string[]
}

interface Book {
  id: string
  title: string
  author: string
  cover: string
  totalPages: number
  totalChapters: number
  chaptersEstimated?: boolean
  isActive?: boolean
  source?: string
  genres: string[]
  rating: number
  synopsis: string
  series?: string
  volume?: string
  language?: string
  releaseDate?: string
  unreleased?: boolean
  publicShared?: boolean
  tropes?: string[]
  tags?: string[]
  ratingCount?: number
}

interface ShelfEntry {
  userId: string
  bookId: string
  status: BookStatus
  progress: number
  rating?: number
  spiceRating?: number
  startDate?: string | null
  endDate?: string | null
  currentPage?: number
  format?: string
  price?: number
  store?: string
  personalTags?: string[]
  mainCouple?: string
  crush?: string
  favoriteQuotes?: string[]
  review?: string
  cryRating?: number
  freakoutRating?: number
  gripRating?: number
  hangoverRating?: number
  favorite?: boolean
  top10?: boolean
  recommend?: boolean
  reread?: boolean
}

interface Post {
  id: string
  userId: string
  bookId: string
  chapter: number
  percent: number
  text?: string | null
  reactionEmoji?: string
  type: PostType
  timestamp: string
  likes: string[]
  comments: number
}

interface TimelineEvent {
  id: string
  userId: string
  type: 'started' | 'finished' | 'rereading' | 'abandoned' | 'progress' | 'posted' | 'registered'
  bookId?: string
  postId?: string
  data?: Record<string, number>
  timestamp: string
}

interface Reply {
  id: string
  postId: string
  parentReplyId?: string | null
  userId: string
  text: string
  timestamp: string
  likes: string[]
  comments: number
}

interface FolioNotification {
  id: string
  type: 'follow' | 'like' | 'reply' | 'reply_like' | 'reply_reply' | 'book_comment'
  userId: string
  postId?: string
  bookId?: string
  chapter?: number
  text?: string
  timestamp: string
  read: boolean
}

interface ReadingGoal {
  targetBooks: number
  targetDays: number
  checkIns: string[]
  currentStreak: number
  bestStreak: number
  checkedInToday: boolean
  year?: number
  booksReadThisYear?: number
}

type ActionFeedback = {
  success?: string
  error: string
  silentSuccess?: boolean
}

interface ToastMessage {
  id: number
  type: 'success' | 'error'
  text: string
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'https://localhost:7113' : '')
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || API_BASE_URL || 'https://api.sgpf.com.br'
const BACKGROUND_REFRESH_INTERVAL_MS = 10000
const DEVICE_NOTIFICATION_SW_URL = '/folio-service-worker.js'
const DEVICE_NOTIFICATION_STORAGE_PREFIX = 'folio_device_notified_ids_'
const POST_PAGE_SIZE = 5
const POST_IMAGE_MARKER = '__folio_post_image__:'

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Erro ${response.status}`)
  }

  if (response.status === 204) return undefined as T
  const text = await response.text()
  if (!text.trim()) return undefined as T
  return JSON.parse(text) as T
}

function errorMessage(error: unknown, fallback: string) {
  const text = error instanceof Error ? error.message : ''
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text) as { message?: string }
    return parsed.message || fallback
  } catch {
    return text
  }
}

function resolveMediaUrl(value?: string | null) {
  const url = (value || '').trim()
  if (!url) return ''
  if (/^(data:|blob:)/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (/^http:\/\//i.test(url) && window.location.protocol === 'https:') {
    return url.replace(/^http:\/\//i, 'https://')
  }
  if (/^https?:\/\//i.test(url)) return encodeURI(url)
  if (url.startsWith('/assets/') || url.startsWith('/icons/')) return url
  if (url.startsWith('/')) return `${MEDIA_BASE_URL.replace(/\/$/, '')}${url}`
  if (/^(uploads|media|files)\//i.test(url)) return `${MEDIA_BASE_URL.replace(/\/$/, '')}/${url}`
  return url
}

function isMediaUrl(value?: string | null) {
  const url = (value || '').trim()
  return /^(https?:|data:|blob:|\/\/|\/|uploads\/|media\/|files\/)/i.test(url)
}

function postTextParts(text?: string | null) {
  const rawText = text || ''
  const lines = rawText.split('\n')
  const markerIndex = lines.findIndex(line => line.startsWith(POST_IMAGE_MARKER))
  if (markerIndex < 0) return { text: rawText.trim(), imageUrl: '' }

  const imageUrl = lines[markerIndex].slice(POST_IMAGE_MARKER.length).trim()
  const visibleText = lines.filter((_, index) => index !== markerIndex).join('\n').trim()
  return { text: visibleText, imageUrl }
}

function textWithPostImage(text: string, imageUrl: string) {
  const trimmed = text.trim()
  if (!imageUrl) return trimmed
  return [trimmed, `${POST_IMAGE_MARKER}${imageUrl}`].filter(Boolean).join('\n')
}

const STATUS_LABELS: Record<BookStatus, string> = {
  reading: 'Lendo',
  want: 'TBR',
  read: 'Lido',
  rereading: 'Relendo',
  abandoned: 'Abandonei',
}

const BOOK_SEARCH_FIELD_LABELS: Record<BookSearchField, string> = {
  all: 'Tudo',
  title: 'Título',
  author: 'Autor',
  series: 'Série',
  genre: 'Gênero',
  trope: 'Trope',
  tag: 'Tag',
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function chapterFromPercent(book: Book, percent: number) {
  if (percent <= 0) return 1
  return clamp(Math.round((book.totalChapters * percent) / 100), 1, book.totalChapters)
}

function percentFromChapter(book: Book, chapter: number) {
  return clamp(Math.round((chapter / book.totalChapters) * 100), 1, 100)
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function bookMatchesSearch(book: Book, query: string, field: BookSearchField) {
  const needle = normalizeSearch(query)
  if (!needle) return false
  const valuesByField: Record<BookSearchField, string[]> = {
    all: [
      book.title,
      book.author,
      book.series || '',
      ...(book.genres || []),
      ...(book.tropes || []),
      ...(book.tags || []),
    ],
    title: [book.title],
    author: [book.author],
    series: [book.series || ''],
    genre: book.genres || [],
    trope: book.tropes || [],
    tag: book.tags || [],
  }
  return valuesByField[field].some(value => normalizeSearch(value).includes(needle))
}

function readerMatchesSearch(user: User, query: string) {
  const needle = normalizeSearch(query)
  if (!needle) return true
  const handle = normalizeSearch(user.handle)
  const handleWithAt = `@${handle}`
  const name = normalizeSearch(user.name)
  return name.includes(needle) || handle.includes(needle.replace(/^@+/, '')) || handleWithAt.includes(needle)
}

function mergeBooksById(...groups: Book[][]) {
  const merged = new Map<string, Book>()
  groups.flat().forEach(book => {
    if (!merged.has(book.id)) merged.set(book.id, book)
  })
  return Array.from(merged.values())
}

const RATING_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const GENRE_OPTIONS = [
  'Academia Mágica',
  'Adulto',
  'Biografia',
  'Bully Romance',
  'Chick Lit',
  'Ciência',
  'Comédia Romântica',
  'Cozy Mystery',
  'Cyberpunk',
  'Dark Academia Romance',
  'Dark Fantasy',
  'Dark Romance',
  'Desenvolvimento Pessoal',
  'Distopia',
  'Drama',
  'Fantasia',
  'Fantasia Épica',
  'Fantasia Urbana',
  'Ficção',
  'Ficção Científica',
  'Ficção Histórica',
  'Ficção Literária',
  'Finanças',
  'Gothic Romance',
  'Gótico',
  'História',
  'Horror',
  'Horror Psicológico',
  'Mafia Romance',
  'MC Romance (Motoclubes)',
  'Middle Grade',
  'Mistério',
  'Mitologia',
  'Não Ficção',
  'New Adult',
  'Paranormal',
  'Policial',
  'Psicologia',
  'Realismo Mágico',
  'Retelling',
  'Romance',
  'Romance Contemporâneo',
  'Romance de Época',
  'Romance de Esportes',
  'Romance Histórico',
  'Romance LGBTQIA',
  'Romance Militar',
  'Romantasia',
  'Sci-Fi',
  'Space Opera',
  'Stalker Romance',
  'Suspense',
  'Terror',
  'Thriller',
  'Thriller Psicológico',
  'Young Adult',
]
const TROPE_OPTIONS = [
  'Age Gap',
  'Alpha Hero',
  'Amnesia',
  'Arranged Marriage',
  "Best Friend's Brother",
  'Betrayal',
  'Black Cat x Golden Retriever',
  'Bodyguard',
  'Boss x Employee',
  "Brother's Best Friend",
  'Burn the World',
  'Captor/Captive',
  'Celebrity x Normal Person',
  'Childhood Friends',
  'Chosen One',
  'Cinnamon Roll',
  'Demon',
  'Dragon Rider',
  'Dragons',
  'Dual POV',
  'Dubious Consent (quando fizer parte da obra)',
  'Enemies to Lovers',
  'Epistolary',
  'Fae',
  'Fake Dating',
  'Fake Engagement',
  'Fast Burn',
  'Fated Mates',
  'Fish Out of Water',
  'Forbidden Love',
  'Forced Proximity',
  'Found Family',
  'Frenemies to Lovers',
  'Friends to Lovers',
  'Gods',
  'Golden Retriever MMC',
  'Grumpy x Sunshine',
  'Guardian',
  'Hidden Identity',
  'Ice Queen',
  'Kidnapping',
  'Kinky',
  'Love Triangle',
  'Mafia',
  'Magical Academy',
  'Marriage in Trouble',
  'Marriage of Convenience',
  'Masked',
  'Morally Black Hero',
  'Morally Grey',
  'Multiple POV',
  'Neighbors',
  'Novela/Conto',
  'Obsessed Hero',
  'One Bed',
  'Playboy Falls First',
  'Plot Twist',
  'Poly Romance',
  'Portal Fantasy',
  'Possessive Hero',
  'Professor x Student',
  'Protective Hero',
  'Quest',
  'Redemption Arc',
  'Rejected Mate',
  'Revenge',
  'Rivals to Lovers',
  'Road Trip',
  'Roommates',
  'Royal Family',
  'Second Chance',
  'Secret Baby',
  'Secret Heir',
  'Secret Identity',
  'Secret Relationship',
  'Serial Killer',
  'Single Dad',
  'Single Mom',
  'Slow Burn',
  'Small Town',
  'Sports Team',
  'Stalker',
  'STEAM',
  'Strangers to Lovers',
  'Surprise Pregnancy',
  'Time Travel',
  'Touch Her and Die',
  'Trials',
  'Vampire',
  'Vigilante',
  'Vikings',
  'Villain Gets the Girl',
  'Virgin Hero',
  'Virgin Heroine',
  'Werewolf',
  'Why Choose / Reverse Harem',
  'Witch',
  'Workplace Romance',
]

function ratingText(value?: number, label = 'estrelas') {
  return value ? `${value} de 5 ${label}` : 'Sem avaliação'
}

function ratingSummaryText(rating?: number, ratingCount = 0) {
  if (!rating || !ratingCount) return 'Sem nota'
  const ratingValue = Number.isInteger(rating) ? String(rating) : rating.toFixed(1)
  const countLabel = ratingCount === 1 ? 'avaliação' : 'avaliações'
  return `★ ${ratingValue} (${ratingCount} ${countLabel})`
}

function spiceSummaryText(rating?: number, ratingCount = 0) {
  if (!rating || !ratingCount) return 'Sem pimenta'
  const ratingValue = Number.isInteger(rating) ? String(rating) : rating.toFixed(1)
  const countLabel = ratingCount === 1 ? 'avaliação' : 'avaliações'
  return `🌶 ${ratingValue} (${ratingCount} ${countLabel})`
}

function bookRatingText(book: Pick<Book, 'rating' | 'ratingCount'>) {
  return ratingSummaryText(book.rating, book.ratingCount || 0)
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : ''
}

function isDateInYear(value: string | null | undefined, year: number) {
  return Boolean(value && Number(value.slice(0, 4)) === year)
}

type DatePromptOptions = {
  title: string
  description: string
  fallback?: string
}

type DatePromptState = DatePromptOptions & {
  resolve: (value: string | null) => void
}

type AskShelfDate = (options: DatePromptOptions) => Promise<string | null>

function DatePromptDialog({ prompt, onConfirm, onCancel }: {
  prompt: DatePromptState
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(prompt.fallback || localDateKey())
  const [error, setError] = useState('')

  useEffect(() => {
    setValue(prompt.fallback || localDateKey())
    setError('')
  }, [prompt])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!value) {
      setError('Escolha uma data para continuar.')
      return
    }
    onConfirm(value)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center">
      <form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-stone-800 bg-stone-900 p-4 shadow-2xl shadow-black/40">
        <div className="mb-4">
          <h2 className="font-serif text-xl text-stone-50">{prompt.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-400">{prompt.description}</p>
        </div>
        <label className="block text-sm font-semibold text-stone-300">
          Data
          <input
            autoFocus
            type="date"
            value={value}
            onChange={e => {
              setValue(e.target.value)
              setError('')
            }}
            className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
          />
        </label>
        {error && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-bold text-stone-400 hover:bg-stone-800">Cancelar</button>
          <button type="submit" className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-stone-950 hover:bg-amber-200">Salvar data</button>
        </div>
      </form>
    </div>
  )
}

function useDatePrompt() {
  const [prompt, setPrompt] = useState<DatePromptState | null>(null)

  function askDate(options: DatePromptOptions) {
    return new Promise<string | null>(resolve => {
      setPrompt({ ...options, resolve })
    })
  }

  const datePromptDialog = prompt ? (
    <DatePromptDialog
      prompt={prompt}
      onCancel={() => {
        prompt.resolve(null)
        setPrompt(null)
      }}
      onConfirm={value => {
        prompt.resolve(value)
        setPrompt(null)
      }}
    />
  ) : null

  return { askDate, datePromptDialog }
}

async function datesForShelfStatus(status: BookStatus, entry: ShelfEntry | undefined, askDate: AskShelfDate) {
  const changes: Partial<ShelfEntry> = {}
  if ((status === 'reading' || status === 'rereading') && !dateInputValue(entry?.startDate)) {
    const startDate = await askDate({
      title: 'Início da leitura',
      description: 'Essa data ajuda a organizar sua estante e deixa o histórico de leitura mais fiel.',
      fallback: localDateKey(),
    })
    if (!startDate) return null
    changes.startDate = startDate
  }
  if (status === 'read') {
    const endDate = await askDate({
      title: 'Conclusão da leitura',
      description: 'A meta anual só conta livros concluídos dentro do ano da meta.',
      fallback: dateInputValue(entry?.endDate) || localDateKey(),
    })
    if (!endDate) return null
    changes.endDate = endDate
  }
  return changes
}

function canRateStatus(status?: BookStatus) {
  return status === 'read' || status === 'rereading' || status === 'abandoned'
}

function canPostWithStatus(status?: BookStatus) {
  return status === 'reading' || status === 'rereading' || status === 'read' || status === 'abandoned'
}

function newestFirst<T extends { timestamp: string }>(a: T, b: T) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
}

function topReadTerms(userId: string, shelf: ShelfEntry[], books: Book[], field: 'genres' | 'tropes') {
  const counts = new Map<string, number>()
  shelf
    .filter(entry => entry.userId === userId && (entry.status === 'read' || entry.status === 'rereading'))
    .forEach(entry => {
      const book = books.find(item => item.id === entry.bookId)
      const terms = field === 'genres' ? book?.genres : book?.tropes
      ;(terms || []).forEach(term => counts.set(term, (counts.get(term) || 0) + 1))
    })

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, 6)
}

function formatTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diffMinutes = Math.floor(Math.max(0, now.getTime() - d.getTime()) / 60000)
  if (diffMinutes < 1) return 'agora'
  if (diffMinutes < 60) return `${diffMinutes}min`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

type DeviceNotificationStatus = NotificationPermission | 'unsupported'

function deviceNotificationStatus(): DeviceNotificationStatus {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  return Notification.permission
}

function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)))
}

function deviceNotificationStorageKey(userId: string) {
  return `${DEVICE_NOTIFICATION_STORAGE_PREFIX}${userId}`
}

function storedDeviceNotificationIds(userId: string) {
  try {
    const value = localStorage.getItem(deviceNotificationStorageKey(userId))
    const ids = value ? JSON.parse(value) : []
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])
  } catch {
    return new Set<string>()
  }
}

function saveDeviceNotificationIds(userId: string, ids: Set<string>) {
  localStorage.setItem(deviceNotificationStorageKey(userId), JSON.stringify([...ids].slice(-80)))
}

async function registerDeviceNotificationWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register(DEVICE_NOTIFICATION_SW_URL)
  } catch {
    return null
  }
}

async function saveDevicePushSubscription(token: string) {
  const registration = await registerDeviceNotificationWorker()
  if (!registration || !('PushManager' in window)) return 'unsupported' as const

  const keyResponse = await apiRequest<{ publicKey: string }>('/folio/notifications/push-public-key', {}, token)
  if (!keyResponse.publicKey) return 'missing-key' as const

  const existingSubscription = await registration.pushManager.getSubscription()
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyResponse.publicKey),
  })

  await apiRequest('/folio/notifications/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  }, token)

  return 'saved' as const
}

function notificationTypeText(type: FolioNotification['type']) {
  const textByType: Record<FolioNotification['type'], string> = {
    follow: 'começou a seguir você',
    like: 'curtiu sua publicação',
    reply: 'comentou na sua publicação',
    reply_like: 'curtiu seu comentário',
    reply_reply: 'respondeu seu comentário',
    book_comment: 'comentou no livro que você está lendo',
  }
  return textByType[type]
}

function notificationBody(notification: FolioNotification, users: User[], books: Book[]) {
  const user = users.find(item => item.id === notification.userId)
  const book = notification.bookId ? books.find(item => item.id === notification.bookId) : null
  const actor = user?.name || 'Alguém'
  const bookText = book ? ` em ${book.title}` : ''
  const chapterText = notification.chapter ? ` · cap. ${notification.chapter}` : ''
  return `${actor} ${notificationTypeText(notification.type)}${bookText}${chapterText}`
}

async function showDeviceNotification(notification: FolioNotification, users: User[], books: Book[]) {
  if (deviceNotificationStatus() !== 'granted') return
  const registration = await registerDeviceNotificationWorker()
  const options: NotificationOptions = {
    body: notificationBody(notification, users, books),
    icon: '/icons/icon-192.png',
    badge: '/icons/notification-badge.png',
    tag: `folio-${notification.id}`,
    data: { url: '/?page=notifications' },
  }

  if (registration) {
    await registration.showNotification('Entrelinhas', options)
    return
  }

  const fallback = new Notification('Entrelinhas', options)
  fallback.onclick = () => {
    window.focus()
    window.location.href = '/?page=notifications'
  }
}

function Avatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
  }

  const isImage = isMediaUrl(user.avatar)

  return isImage ? (
    <img src={resolveMediaUrl(user.avatar)} alt={user.name} className={`${sizes[size]} shrink-0 select-none rounded-full object-cover`} />
  ) : (
    <div className={`${sizes[size]} flex shrink-0 select-none items-center justify-center rounded-full bg-amber-700 font-semibold text-amber-50`}>
      {user.avatar}
    </div>
  )
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src={resolveMediaUrl(BRAND_LOGO_URL)} alt={BRAND_NAME} className={`${compact ? 'h-12 w-12' : 'h-56 w-56 sm:h-72 sm:w-72'} rounded-lg object-cover`} />
      <span className={`${compact ? 'text-xl' : 'text-7xl sm:text-8xl'} font-serif text-amber-300`}>{BRAND_NAME}</span>
    </div>
  )
}

function ChapterBadge({ chapter }: { chapter?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
      {chapter ? `Cap. ${chapter}` : 'Capítulo'}
    </span>
  )
}

function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-800/80 bg-stone-950/90 px-4 py-3 backdrop-blur-xl md:px-5">
      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-lg text-stone-100">{title}</h1>
        {children}
      </div>
    </header>
  )
}

function LoginPage({ onLogin }: { onLogin: (name: string, email: string, password: string, mode: 'login' | 'register') => Promise<void> }) {
  const [authStep, setAuthStep] = useState<'landing' | 'form'>('landing')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'register' && password !== confirmPassword) {
      setError('As senhas não conferem.')
      return
    }
    setLoading(true)
    try {
      await onLogin(name, email, password, mode)
    } catch {
      setError(mode === 'login' ? 'Email ou senha incorretos.' : 'Não foi possível criar a conta.')
      setLoading(false)
    }
  }

  function openAuthForm(nextMode: 'login' | 'register') {
    setMode(nextMode)
    setName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setLoading(false)
    setAuthStep('form')
  }

  if (authStep === 'landing') {
    return (
      <main className="min-h-screen bg-stone-950 px-4 py-8 text-stone-100">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col items-center justify-center gap-8 text-center">
          <BrandMark />
          <div>
            <h1 className="mx-auto max-w-2xl font-serif text-4xl leading-tight text-stone-50 sm:text-6xl">
              Twitter literário para comentar livros sem tomar spoiler.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-stone-400">
              Organize sua estante, acompanhe capítulos e converse com outros leitores em uma rede feita para proteger sua experiência de leitura.
            </p>
          </div>
          <div className="grid w-full max-w-sm gap-3 sm:grid-cols-2">
            <button onClick={() => openAuthForm('login')} className="rounded-lg bg-amber-300 px-5 py-3 text-sm font-bold text-stone-950 transition hover:bg-amber-200">
              Entrar
            </button>
            <button onClick={() => openAuthForm('register')} className="rounded-lg border border-stone-700 px-5 py-3 text-sm font-bold text-stone-200 transition hover:bg-stone-900">
              Cadastrar
            </button>
          </div>
          <div className="grid w-full gap-3 text-left sm:grid-cols-3">
            {['Feed por capítulo', 'Estante e progresso', 'Teorias protegidas'].map(item => (
              <div key={item} className="rounded-lg border border-stone-800 bg-stone-900/70 p-4 text-sm text-stone-300">
                {item}
              </div>
            ))}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-8 text-stone-100">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <form onSubmit={handleSubmit} className="w-full rounded-lg border border-stone-800 bg-stone-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-stone-50">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
          </div>
          {mode === 'register' && (
            <label className="mb-4 block text-sm text-stone-300">
              Nome
              <input
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  setError('')
                }}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-400"
              />
            </label>
          )}
          <label className="mb-4 block text-sm text-stone-300">
            Email
            <input
              type="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value)
                setError('')
              }}
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-400"
            />
          </label>
          <label className="mb-4 block text-sm text-stone-300">
            Senha
            <div className="mt-1 flex rounded-lg border border-stone-700 bg-stone-950 focus-within:border-amber-400">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => {
                  setPassword(e.target.value)
                  setError('')
                }}
                className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2.5 text-sm text-stone-100 outline-none"
              />
              <button type="button" onClick={() => setShowPassword(value => !value)} className="shrink-0 px-3 text-xs font-bold text-stone-400 hover:text-amber-300">
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </label>
          {mode === 'register' && (
            <label className="mb-4 block text-sm text-stone-300">
              Confirmar senha
              <div className="mt-1 flex rounded-lg border border-stone-700 bg-stone-950 focus-within:border-amber-400">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => {
                    setConfirmPassword(e.target.value)
                    setError('')
                  }}
                  className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-2.5 text-sm text-stone-100 outline-none"
                />
                <button type="button" onClick={() => setShowConfirmPassword(value => !value)} className="shrink-0 px-3 text-xs font-bold text-stone-400 hover:text-amber-300">
                  {showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>
          )}
          {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-200 disabled:opacity-70">
            {loading ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>
          <button type="button" onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setConfirmPassword('')
            setError('')
          }} className="mt-3 w-full text-center text-sm font-semibold text-stone-400 hover:text-amber-300">
            {mode === 'login' ? 'Criar uma conta nova' : 'Já tenho conta'}
          </button>
          <button type="button" onClick={() => setAuthStep('landing')} className="mt-2 w-full text-center text-xs font-semibold text-stone-500 hover:text-stone-300">
            Voltar
          </button>
        </form>
      </div>
    </main>
  )
}

type NavIconName = 'home' | 'library' | 'goals' | 'notifications' | 'shelf' | 'profile'

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    className: 'h-5 w-5',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  }
  const paths: Record<NavIconName, React.ReactNode> = {
    home: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6.5 9.5V20h11V9.5" /><path d="M10 20v-6h4v6" /></>,
    library: <><path d="M5 5.5h4.5A3.5 3.5 0 0 1 13 9v10.5A3.5 3.5 0 0 0 9.5 16H5z" /><path d="M19 5.5h-4.5A3.5 3.5 0 0 0 11 9v10.5a3.5 3.5 0 0 1 3.5-3.5H19z" /></>,
    goals: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>,
    notifications: <><path d="M18 9a6 6 0 0 0-12 0c0 7-2 7-2 8h16c0-1-2-1-2-8" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    shelf: <><path d="M5 4.5h14v15H5z" /><path d="M9.5 4.5v15" /><path d="M14.5 4.5v15" /><path d="M5 10h14" /><path d="M5 15h14" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  }

  return <svg {...common}>{paths[name]}</svg>
}

function ThemeToggle({ theme, onToggle, compact = false }: { theme: ColorTheme; onToggle: () => void; compact?: boolean }) {
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={dark}
      aria-label={dark ? 'Usar modo claro' : 'Usar modo escuro'}
      className={`${compact ? 'h-10 w-10 justify-center rounded-lg' : 'mb-3 w-full rounded-lg px-4 py-2.5'} flex items-center gap-2 border border-stone-700 bg-stone-900 text-sm font-bold text-stone-200 transition hover:bg-stone-800 hover:text-stone-100`}
    >
      <span className="text-base leading-none">{dark ? '☀' : '☾'}</span>
      {!compact && <span>{dark ? 'Modo claro' : 'Modo escuro'}</span>}
    </button>
  )
}

function MobileQuickActions({ theme, onToggleTheme, onCreatePost }: {
  theme: ColorTheme
  onToggleTheme: () => void
  onCreatePost: () => void
}) {
  const [open, setOpen] = useState(false)
  const dark = theme === 'dark'

  function runAction(action: () => void) {
    action()
    setOpen(false)
  }

  return (
    <div className="fixed bottom-[calc(max(env(safe-area-inset-bottom),0px)+4.75rem)] right-4 z-50 md:hidden">
      {open && (
        <div className="mb-2 grid w-44 gap-2 rounded-lg border border-stone-800 bg-stone-950/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => runAction(onCreatePost)}
            className="flex items-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-left text-sm font-bold text-stone-950 transition hover:bg-amber-200"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-950/10 text-base leading-none">+</span>
            Publicar
          </button>
          <button
            type="button"
            onClick={() => runAction(onToggleTheme)}
            className="flex items-center gap-2 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-left text-sm font-bold text-stone-200 transition hover:bg-stone-800 hover:text-stone-100"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-800 text-base leading-none">{dark ? '☀' : '☾'}</span>
            {dark ? 'Modo claro' : 'Modo escuro'}
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        aria-label="Ações rápidas"
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-300 text-2xl font-bold leading-none text-stone-950 shadow-lg shadow-black/30 transition hover:bg-amber-200"
      >
        {open ? '×' : '+'}
      </button>
    </div>
  )
}

function Navigation({ currentUser, page, notificationCount, theme, onToggleTheme, onNavigate, onCreatePost, onLogout }: {
  currentUser: User
  page: Page
  notificationCount: number
  theme: ColorTheme
  onToggleTheme: () => void
  onNavigate: (p: Page) => void
  onCreatePost: () => void
  onLogout: () => void
}) {
  const navItems: { id: Page; icon: NavIconName; label: string }[] = [
    { id: 'timeline', icon: 'home', label: 'Início' },
    { id: 'library', icon: 'library', label: 'Biblioteca' },
    { id: 'goals', icon: 'goals', label: 'Metas' },
    { id: 'notifications', icon: 'notifications', label: 'Notificações' },
    { id: 'shelf', icon: 'shelf', label: 'Estante' },
    { id: 'profile', icon: 'profile', label: 'Perfil' },
  ]

  return (
    <>
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-60 flex-col border-r border-stone-800 bg-stone-950 px-3 py-5 md:flex">
        <button onClick={() => onNavigate('timeline')} className="mb-6 rounded-lg px-2 text-left transition hover:bg-stone-900">
          <BrandMark compact />
        </button>
        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                page === item.id || (item.id === 'profile' && page === 'profile-list') ? 'bg-amber-300/10 text-amber-300' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
              }`}
            >
              <span className="flex w-5 items-center justify-center"><NavIcon name={item.icon} /></span>
              {item.label}
              {item.id === 'notifications' && notificationCount > 0 && (
                <span className="ml-auto rounded-full bg-red-400 px-1.5 py-0.5 text-[10px] font-bold text-stone-950">{notificationCount}</span>
              )}
            </button>
          ))}
        </nav>
        <button onClick={onCreatePost} className="mb-4 rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-200">
          Nova publicação
        </button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <div className="flex items-center gap-3 border-t border-stone-800 pt-4">
          <Avatar user={currentUser} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-100">{currentUser.name}</p>
            <p className="truncate text-xs text-stone-500">@{currentUser.handle}</p>
          </div>
          <button onClick={onLogout} className="text-xs font-semibold text-stone-500 hover:text-stone-200">
            Sair
          </button>
        </div>
      </aside>

      <MobileQuickActions theme={theme} onToggleTheme={onToggleTheme} onCreatePost={onCreatePost} />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-800 bg-stone-950/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-6 items-center gap-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex min-h-12 flex-col items-center justify-center rounded-lg text-[11px] font-semibold ${
                page === item.id || (item.id === 'profile' && page === 'profile-list') ? 'bg-amber-300/10 text-amber-300' : 'text-stone-500'
              }`}
            >
              <span className="mb-0.5 flex items-center justify-center"><NavIcon name={item.icon} /></span>
              {item.label}
              {item.id === 'notifications' && notificationCount > 0 && (
                <span className="absolute right-2 top-1 rounded-full bg-red-400 px-1 text-[9px] font-bold text-stone-950">{notificationCount}</span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}

function PostCard({ post, users, books, currentUser, replies, shelf = [], onBookClick, onUserClick, onAddReply, onToggleLike, onToggleReplyLike, onDeletePost, onDeleteReply, compactBook = false, protectSpoilers = false, spoilerChapterLimit }: {
  post: Post
  users: User[]
  books: Book[]
  currentUser: User
  replies: Reply[]
  shelf?: ShelfEntry[]
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
  onAddReply: (postId: string, text: string, parentReplyId?: string) => Promise<boolean | void> | boolean | void
  onToggleLike: (postId: string) => Promise<boolean | void> | boolean | void
  onToggleReplyLike: (replyId: string) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onDeleteReply: (replyId: string) => Promise<boolean | void> | boolean | void
  compactBook?: boolean
  protectSpoilers?: boolean
  spoilerChapterLimit?: number
}) {
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyingToReplyId, setReplyingToReplyId] = useState<string | null>(null)
  const [nestedReplyText, setNestedReplyText] = useState('')
  const [spoilerAccepted, setSpoilerAccepted] = useState(false)
  const author = users.find(u => u.id === post.userId)!
  const book = books.find(b => b.id === post.bookId)
  const myEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === post.bookId)
  const myChapter = book && myEntry ? chapterFromPercent(book, myEntry.progress) : 0
  const safeChapterLimit = spoilerChapterLimit ?? myChapter
  const contentLabel = post.type === 'theory' ? 'Teoria' : 'Comentário'
  const isOwnPost = post.userId === currentUser.id
  const spoilerState =
    !protectSpoilers || isOwnPost || spoilerAccepted ? 'visible' :
    !myEntry ? 'not-reading' :
    myEntry.status === 'read' || myEntry.status === 'rereading' ? 'visible' :
    post.chapter > safeChapterLimit ? 'blocked' :
    post.chapter === safeChapterLimit ? 'same-chapter' :
    'visible'
  const canInteractWithContent = spoilerState === 'visible'
  const relatedReplies = replies.filter(reply => reply.postId === post.id)
  const oldestFirst = (a: Reply, b: Reply) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  const topLevelReplies = relatedReplies.filter(reply => !reply.parentReplyId).sort(oldestFirst)
  const visibleReplies = showAllReplies ? topLevelReplies : topLevelReplies.slice(0, 1)
  const hiddenReplyCount = Math.max(0, topLevelReplies.length - visibleReplies.length)
  const hiddenConversationCount = hiddenReplyCount + (showAllReplies ? 0 : visibleReplies.reduce((total, reply) => total + relatedReplies.filter(child => child.parentReplyId === reply.id).length, 0))
  const displayedComments = relatedReplies.length
  const liked = post.likes.includes(currentUser.id)
  const postContent = postTextParts(post.text)

  async function submitReply() {
    const trimmed = replyText.trim()
    if (!trimmed) return
    const saved = await onAddReply(post.id, trimmed)
    if (saved === false) return
    setReplyText('')
    setShowReplyBox(false)
  }

  async function submitNestedReply(parentReplyId: string) {
    const trimmed = nestedReplyText.trim()
    if (!trimmed) return
    const saved = await onAddReply(post.id, trimmed, parentReplyId)
    if (saved === false) return
    setNestedReplyText('')
    setReplyingToReplyId(null)
  }

  return (
    <article className="border-b border-stone-800 px-4 py-4 transition hover:bg-stone-900/35 md:px-5">
      <div className="flex gap-3">
        <Avatar user={author} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <button onClick={() => onUserClick(author.id)} className="text-sm font-bold text-stone-100 hover:text-amber-300">{author.name}</button>
            <button onClick={() => onUserClick(author.id)} className="text-sm text-stone-500 hover:text-stone-300">@{author.handle}</button>
            <span className="text-xs text-stone-600">{formatTime(post.timestamp)}</span>
            {post.type === 'theory' && <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-xs font-semibold text-violet-300">teoria</span>}
            {post.userId === currentUser.id && (
              <button onClick={() => onDeletePost(post.id)} className="ml-auto rounded px-2 py-0.5 text-xs font-bold text-red-300 hover:bg-red-400/10">
                Apagar
              </button>
            )}
          </div>
            {book && !compactBook && (
            <button onClick={() => onBookClick(book.id)} className="mb-2 flex max-w-full items-center gap-2 text-left">
              <img src={resolveMediaUrl(book.cover)} alt={book.title} className="h-8 w-6 shrink-0 rounded object-cover" />
              <span className="truncate text-xs font-semibold text-amber-300">{book.title}</span>
              <ChapterBadge chapter={post.chapter} />
            </button>
          )}
          {book && compactBook && <div className="mb-2"><ChapterBadge chapter={post.chapter} /></div>}
          {canInteractWithContent ? (
            <>
              {post.reactionEmoji && <div className="mb-2 text-3xl leading-none">{post.reactionEmoji}</div>}
              {postContent.text && <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-stone-300">{postContent.text}</p>}
              {postContent.imageUrl && (
                <img
                  src={resolveMediaUrl(postContent.imageUrl)}
                  alt="Imagem da publicação"
                  loading="lazy"
                  className="mb-3 max-h-[520px] w-full rounded-lg border border-stone-800 object-cover"
                />
              )}
            </>
          ) : (
            <div className="mb-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
              <p className="text-sm font-bold text-amber-200">
                {spoilerState === 'not-reading' ? `${contentLabel} pode conter spoiler deste livro.` : spoilerState === 'blocked' ? `${contentLabel} pode conter spoiler do capítulo ${post.chapter}.` : `${contentLabel} do seu capítulo atual (${post.chapter}).`}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                {spoilerState === 'not-reading' ? 'Você ainda não adicionou este livro à estante, então o progresso não foi identificado.' : spoilerState === 'same-chapter' ? 'Pode conter detalhes importantes deste capítulo.' : `Seu filtro está no capítulo ${safeChapterLimit}.`}
              </p>
              <button onClick={() => setSpoilerAccepted(true)} className="mt-3 rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-stone-950">
                Ver mesmo assim
              </button>
            </div>
          )}
          <div className="flex items-center gap-5 text-xs">
            <button
              onClick={() => canInteractWithContent && onToggleLike(post.id)}
              disabled={!canInteractWithContent}
              className={`font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${liked ? 'text-red-300' : 'text-stone-500 hover:text-red-300'}`}
            >
              {liked ? '♥' : '♡'} {post.likes.length}
            </button>
            <button onClick={() => canInteractWithContent && setShowReplyBox(value => !value)} disabled={!canInteractWithContent} className="font-semibold text-stone-500 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
              comentar {displayedComments}
            </button>
          </div>
          {showReplyBox && canInteractWithContent && (
            <div className="mt-3 rounded-lg border border-stone-800 bg-stone-950 p-3">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                rows={2}
                placeholder="Responder a publicação..."
                className="w-full resize-none rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setShowReplyBox(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-stone-500 hover:bg-stone-800">Cancelar</button>
                <button onClick={submitReply} disabled={!replyText.trim()} className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">Responder</button>
              </div>
            </div>
          )}
          {topLevelReplies.length > 0 && canInteractWithContent && (
            <div className="mt-3 space-y-2">
              {visibleReplies.map(reply => {
                const replyUser = users.find(user => user.id === reply.userId) || currentUser
                const replyLikes = reply.likes || []
                const replyLiked = replyLikes.includes(currentUser.id)
                const childReplies = relatedReplies
                  .filter(child => child.parentReplyId === reply.id)
                  .sort(oldestFirst)
                const visibleChildReplies = showAllReplies ? childReplies : []
                return (
                  <div key={reply.id} className="rounded-lg bg-stone-950 p-2">
                    <div className="flex gap-2">
                    <button onClick={() => onUserClick(replyUser.id)}><Avatar user={replyUser} size="sm" /></button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onUserClick(replyUser.id)} className="text-xs font-bold text-stone-200 hover:text-amber-300">@{replyUser.handle}</button>
                        {reply.userId === currentUser.id && (
                          <button onClick={() => onDeleteReply(reply.id)} className="text-xs font-bold text-red-300 hover:text-red-200">apagar</button>
                        )}
                      </div>
                      <p className="text-sm text-stone-400">{reply.text}</p>
                      <div className="mt-1 flex items-center gap-4 text-xs">
                        <button onClick={() => onToggleReplyLike(reply.id)} className={`font-semibold ${replyLiked ? 'text-red-300' : 'text-stone-500 hover:text-red-300'}`}>
                          {replyLiked ? '♥' : '♡'} {replyLikes.length}
                        </button>
                        <button onClick={() => {
                          setReplyingToReplyId(value => value === reply.id ? null : reply.id)
                          setNestedReplyText('')
                        }} className="font-semibold text-stone-500 hover:text-amber-300">
                          responder {reply.comments || childReplies.length}
                        </button>
                      </div>
                      {replyingToReplyId === reply.id && (
                        <div className="mt-2 rounded-lg border border-stone-800 bg-stone-900 p-2">
                          <textarea
                            value={nestedReplyText}
                            onChange={e => setNestedReplyText(e.target.value)}
                            rows={2}
                            placeholder={`Responder @${replyUser.handle}...`}
                            className="w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button onClick={() => {
                              setReplyingToReplyId(null)
                              setNestedReplyText('')
                            }} className="rounded-lg px-3 py-1.5 text-xs font-bold text-stone-500 hover:bg-stone-800">Cancelar</button>
                            <button onClick={() => submitNestedReply(reply.id)} disabled={!nestedReplyText.trim()} className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">Responder</button>
                          </div>
                        </div>
                      )}
                      {visibleChildReplies.length > 0 && (
                        <div className="mt-2 space-y-2 border-l border-stone-800 pl-3">
                          {visibleChildReplies.map(child => {
                            const childUser = users.find(user => user.id === child.userId) || currentUser
                            const childLikes = child.likes || []
                            const childLiked = childLikes.includes(currentUser.id)
                            return (
                              <div key={child.id} className="flex gap-2">
                                <button onClick={() => onUserClick(childUser.id)}><Avatar user={childUser} size="sm" /></button>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => onUserClick(childUser.id)} className="text-xs font-bold text-stone-200 hover:text-amber-300">@{childUser.handle}</button>
                                    {child.userId === currentUser.id && (
                                      <button onClick={() => onDeleteReply(child.id)} className="text-xs font-bold text-red-300 hover:text-red-200">apagar</button>
                                    )}
                                  </div>
                                  <p className="text-sm text-stone-400">{child.text}</p>
                                  <button onClick={() => onToggleReplyLike(child.id)} className={`mt-1 text-xs font-semibold ${childLiked ? 'text-red-300' : 'text-stone-500 hover:text-red-300'}`}>
                                    {childLiked ? '♥' : '♡'} {childLikes.length}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    </div>
                  </div>
                )
              })}
              {hiddenConversationCount > 0 || showAllReplies ? (
                <button
                  onClick={() => setShowAllReplies(value => !value)}
                  className="text-xs font-bold text-amber-300 hover:text-amber-200"
                >
                  {showAllReplies ? 'ver menos' : `ver mais ${hiddenConversationCount}`}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function PaginatedPostList({ posts, emptyText, resetKey, renderPost }: {
  posts: Post[]
  emptyText?: string
  resetKey: string
  renderPost: (post: Post) => React.ReactNode
}) {
  const [visibleCount, setVisibleCount] = useState(POST_PAGE_SIZE)
  const visiblePosts = posts.slice(0, visibleCount)
  const hiddenCount = Math.max(0, posts.length - visibleCount)

  useEffect(() => {
    setVisibleCount(POST_PAGE_SIZE)
  }, [resetKey])

  if (!posts.length) {
    return emptyText ? <EmptyState text={emptyText} /> : null
  }

  return (
    <div>
      {visiblePosts.map(renderPost)}
      {hiddenCount > 0 && (
        <div className="border-b border-stone-800 px-4 py-4 text-center md:px-5">
          <button
            onClick={() => setVisibleCount(count => count + POST_PAGE_SIZE)}
            className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold text-stone-300 hover:bg-stone-900"
          >
            Carregar mais {Math.min(POST_PAGE_SIZE, hiddenCount)}
          </button>
        </div>
      )}
    </div>
  )
}

function TimelinePage({ currentUser, users, books, shelf, posts, replies, timeline, onBookClick, onUserClick, onAddReply, onToggleLike, onToggleReplyLike, onDeletePost, onDeleteReply, onToggleFollow }: {
  currentUser: User
  users: User[]
  books: Book[]
  shelf: ShelfEntry[]
  posts: Post[]
  replies: Reply[]
  timeline: TimelineEvent[]
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
  onAddReply: (postId: string, text: string, parentReplyId?: string) => Promise<boolean | void> | boolean | void
  onToggleLike: (postId: string) => Promise<boolean | void> | boolean | void
  onToggleReplyLike: (replyId: string) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onDeleteReply: (replyId: string) => Promise<boolean | void> | boolean | void
  onToggleFollow: (userId: string) => Promise<boolean | void> | boolean | void
}) {
  const [tab, setTab] = useState<'posts' | 'activity'>('posts')
  const [readerQuery, setReaderQuery] = useState('')
  const feedPosts = useMemo(() => {
    const allowed = [...currentUser.following, currentUser.id]
    return posts
      .filter(post => allowed.includes(post.userId))
      .sort(newestFirst)
  }, [posts, currentUser.following, currentUser.id])
  const feedActivity = useMemo(() => {
    const allowed = [...currentUser.following, ...currentUser.followers, currentUser.id]
    return timeline.filter(e => allowed.includes(e.userId)).sort(newestFirst)
  }, [timeline, currentUser.following, currentUser.followers, currentUser.id])
  const foundReaders = users
    .filter(user => user.id !== currentUser.id)
    .filter(user => readerMatchesSearch(user, readerQuery))
    .slice(0, 4)

  return (
    <section>
      <Header title="Início">
        <div className="grid grid-cols-2 rounded-lg bg-stone-900 p-1">
          {([['posts', 'Publicações'], ['activity', 'Atividade']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`rounded-md px-3 py-2 text-sm font-bold transition ${tab === id ? 'bg-amber-300 text-stone-950' : 'text-stone-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </Header>

      <div className="border-b border-stone-800 p-4 md:hidden">
        <label className="block text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
          Buscar leitores
          <input
            value={readerQuery}
            onChange={e => setReaderQuery(e.target.value)}
            placeholder="Pesquisar @ ou nome"
            className="mt-2 w-full rounded-lg border border-stone-700 bg-stone-900 px-3 py-2.5 text-sm normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
          />
        </label>
        {readerQuery && (
          <div className="mt-3 space-y-2">
            {foundReaders.map(user => {
              const following = currentUser.following.includes(user.id)
              return (
                <div key={user.id} className="flex items-center gap-3 rounded-lg border border-stone-800 bg-stone-900 p-3">
                  <button onClick={() => onUserClick(user.id)}><Avatar user={user} size="sm" /></button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onUserClick(user.id)} className="block max-w-full truncate text-sm font-bold text-stone-100 hover:text-amber-300">{user.name}</button>
                    <button onClick={() => onUserClick(user.id)} className="text-xs text-stone-500 hover:text-stone-300">@{user.handle}</button>
                  </div>
                  <button onClick={() => onToggleFollow(user.id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${following ? 'bg-stone-800 text-stone-300' : 'bg-amber-300 text-stone-950'}`}>
                    {following ? 'Seguindo' : 'Seguir'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {tab === 'posts' && (
        <PaginatedPostList
          posts={feedPosts}
          emptyText="Nenhuma publicação de quem você segue ainda."
          resetKey={`timeline-${currentUser.id}`}
          renderPost={post => <PostCard key={post.id} post={post} users={users} books={books} shelf={shelf} currentUser={currentUser} replies={replies} onBookClick={onBookClick} onUserClick={onUserClick} onAddReply={onAddReply} onToggleLike={onToggleLike} onToggleReplyLike={onToggleReplyLike} onDeletePost={onDeletePost} onDeleteReply={onDeleteReply} protectSpoilers />}
        />
      )}

      {tab === 'activity' && (
        feedActivity.length ? feedActivity.map(event => {
          const user = users.find(u => u.id === event.userId)!
          const book = event.bookId ? books.find(b => b.id === event.bookId) : null
          const textByType = {
            started: 'está lendo',
            finished: 'terminou',
            rereading: 'começou a reler',
            abandoned: 'abandonou',
            progress: 'atualizou a leitura',
            posted: 'publicou em',
            registered: 'adicionou à estante',
          }
          return (
            <article key={event.id} className="border-b border-stone-800 px-4 py-4 md:px-5">
              <div className="flex gap-3">
                <Avatar user={user} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-400">
                    <button onClick={() => onUserClick(user.id)} className="font-bold text-stone-100 hover:text-amber-300">{user.name}</button> {textByType[event.type]}{' '}
                    {book && <button onClick={() => onBookClick(book.id)} className="font-bold text-amber-300">{book.title}</button>}
                  </p>
                  <p className="mt-1 text-xs text-stone-600">{formatTime(event.timestamp)} · sem spoilers na timeline</p>
                </div>
              </div>
            </article>
          )
        }) : <EmptyState text="Nenhuma atividade recente." />
      )}
    </section>
  )
}

function BookSearchRow({ book, actionLabel, onAction, secondaryLabel, onSecondaryAction, inactiveLabel, onInactiveAction, dangerLabel, onDangerAction, metaLabel }: {
  book: Book
  actionLabel: string
  onAction: () => void | Promise<void>
  secondaryLabel?: string
  onSecondaryAction?: () => void | Promise<void>
  inactiveLabel?: string
  onInactiveAction?: () => void | Promise<void>
  dangerLabel?: string
  onDangerAction?: () => void | Promise<void>
  metaLabel?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-stone-950 p-2">
      {book.cover ? (
        <img src={resolveMediaUrl(book.cover)} alt={book.title} className="h-12 w-8 rounded object-cover" />
      ) : (
        <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-stone-800 text-[10px] text-stone-500">Sem capa</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
          {metaLabel && <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">{metaLabel}</span>}
        </div>
        <p className="truncate text-xs text-stone-500">{book.author}</p>
        <p className="text-xs text-stone-600">{book.totalPages} págs. · {book.totalChapters} caps.{book.chaptersEstimated ? ' estimados' : ''}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {secondaryLabel && onSecondaryAction && (
          <button onClick={onSecondaryAction} className="rounded-lg border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-300 hover:bg-stone-900">
            {secondaryLabel}
          </button>
        )}
        {inactiveLabel && onInactiveAction && (
          <button onClick={onInactiveAction} className="rounded-lg border border-amber-300/40 px-3 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-300/10">
            {inactiveLabel}
          </button>
        )}
        {dangerLabel && onDangerAction && (
          <button onClick={onDangerAction} className="rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/10">
            {dangerLabel}
          </button>
        )}
        <button onClick={onAction} className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-stone-950">
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

interface BookFormDraft {
  title: string
  author: string
  cover: string
  coverFileName: string
  unreleased: boolean
  publicShared: boolean
  series: string
  volume: string
  genres: string[]
  genreQuery: string
  tropes: string[]
  tropeQuery: string
  language: string
  releaseDate: string
  synopsis: string
  tags: string
  status: BookStatus
  totalPages: string
  totalChapters: string
  currentPage: string
  format: string
  startDate: string
  endDate: string
  rating: string
  spiceRating: string
  price: string
  store: string
  personalTags: string
  mainCouple: string
  crush: string
  favoriteQuotes: string
  review: string
  cryRating: string
  freakoutRating: string
  gripRating: string
  hangoverRating: string
  favorite: boolean
  top10: boolean
  recommend: boolean
  reread: boolean
}

function numberFromText(value: string, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function draftFromBook(book: Book | undefined, status: BookStatus, shelfEntry?: ShelfEntry): BookFormDraft {
  return {
    title: book?.title || '',
    author: book?.author || '',
    cover: book?.cover || '',
    coverFileName: '',
    unreleased: Boolean(book?.unreleased),
    publicShared: book?.publicShared ?? true,
    series: book?.series || '',
    volume: book?.volume || '',
    genres: book?.genres || [],
    genreQuery: '',
    tropes: book?.tropes || [],
    tropeQuery: '',
    language: book?.language || '',
    releaseDate: book?.releaseDate || '',
    synopsis: book?.synopsis || '',
    tags: book?.tags?.join(', ') || '',
    status: shelfEntry?.status || status,
    totalPages: String(book?.totalPages ?? 0),
    totalChapters: String(book?.totalChapters ?? 1),
    currentPage: String(shelfEntry?.currentPage ?? 0),
    format: shelfEntry?.format || '',
    startDate: shelfEntry?.startDate?.slice(0, 10) || '',
    endDate: shelfEntry?.endDate?.slice(0, 10) || '',
    rating: shelfEntry?.rating ? String(shelfEntry.rating) : '',
    spiceRating: shelfEntry?.spiceRating ? String(shelfEntry.spiceRating) : '',
    price: shelfEntry?.price ? String(shelfEntry.price) : '',
    store: shelfEntry?.store || '',
    personalTags: shelfEntry?.personalTags?.join(', ') || '',
    mainCouple: shelfEntry?.mainCouple || '',
    crush: shelfEntry?.crush || '',
    favoriteQuotes: shelfEntry?.favoriteQuotes?.join('\n') || '',
    review: shelfEntry?.review || '',
    cryRating: shelfEntry?.cryRating ? String(shelfEntry.cryRating) : '',
    freakoutRating: shelfEntry?.freakoutRating ? String(shelfEntry.freakoutRating) : '',
    gripRating: shelfEntry?.gripRating ? String(shelfEntry.gripRating) : '',
    hangoverRating: shelfEntry?.hangoverRating ? String(shelfEntry.hangoverRating) : '',
    favorite: Boolean(shelfEntry?.favorite),
    top10: Boolean(shelfEntry?.top10),
    recommend: Boolean(shelfEntry?.recommend),
    reread: Boolean(shelfEntry?.reread),
  }
}

function MultiChoicePicker({ title, searchLabel, countLabel, options, selected, query, onQueryChange, onToggle, hint }: {
  title: string
  searchLabel: string
  countLabel: string
  options: string[]
  selected: string[]
  query: string
  onQueryChange: (value: string) => void
  onToggle: (value: string) => void
  hint: string
}) {
  const filtered = options.filter(option => option.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-stone-200">{title}</h4>
        <span className="text-xs text-stone-500">{selected.length} {countLabel}</span>
      </div>
      <input value={query} onChange={e => onQueryChange(e.target.value)} placeholder={searchLabel} className="mb-3 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" />
      <div className="grid max-h-60 gap-2 overflow-y-auto rounded-lg border border-stone-800 bg-stone-950 p-2 sm:grid-cols-2">
        {filtered.map(option => {
          const active = selected.includes(option)
          return (
            <button key={option} onClick={() => onToggle(option)} className={`rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${active ? 'border-amber-300 bg-amber-300/10 text-amber-200' : 'border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-700'}`}>
              {option}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-stone-500">{hint}</p>
    </div>
  )
}

function BookFormModal({ initialBook, initialShelfEntry, defaultStatus, mode, onClose, onSave, onUploadCover, includeShelfFields = true }: {
  initialBook?: Book
  initialShelfEntry?: ShelfEntry
  defaultStatus: BookStatus
  mode: 'new' | 'edit'
  onClose: () => void
  onSave: (book: Book, shelfData: Partial<ShelfEntry>) => Promise<boolean | void> | boolean | void
  onUploadCover: (file: File) => Promise<string>
  includeShelfFields?: boolean
}) {
  const [draft, setDraft] = useState<BookFormDraft>(() => draftFromBook(initialBook, defaultStatus, initialShelfEntry))
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState('')
  const update = <K extends keyof BookFormDraft,>(key: K, value: BookFormDraft[K]) => setDraft(prev => ({ ...prev, [key]: value }))
  const toggleListValue = (key: 'genres' | 'tropes', value: string) => {
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter(item => item !== value) : [...prev[key], value],
    }))
  }
  const totalPagesValue = Math.round(numberFromText(draft.totalPages))
  const totalChaptersValue = Math.round(numberFromText(draft.totalChapters, 1))
  const canSave = draft.title.trim().length > 0 && draft.author.trim().length > 0 && draft.cover.trim().length > 0 && totalPagesValue > 0 && totalChaptersValue > 0

  async function save() {
    if (!canSave) {
      setError('Informe titulo, autor, capa, paginas e capitulos.')
      return
    }

    setSaving(true)
    setError('')
    const totalPages = Math.max(1, totalPagesValue)
    const totalChapters = Math.max(1, totalChaptersValue)
    const currentPage = includeShelfFields ? Math.max(0, Math.round(numberFromText(draft.currentPage))) : 0
    const progressFromPage = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0
    const status = includeShelfFields ? draft.status : 'want'
    if (includeShelfFields && (status === 'reading' || status === 'rereading') && !draft.startDate) {
      setError('Informe a data de início da leitura.')
      setSaving(false)
      return
    }
    if (includeShelfFields && status === 'read' && !draft.endDate) {
      setError('Informe a data de conclusão da leitura.')
      setSaving(false)
      return
    }
    const progress = status === 'read' ? 100 : clamp(progressFromPage, 0, 100)
    const book: Book = {
      id: initialBook?.id || `custom-${Date.now()}`,
      title: draft.title.trim(),
      author: draft.author.trim(),
      cover: draft.cover.trim(),
      totalPages,
      totalChapters,
      chaptersEstimated: initialBook?.chaptersEstimated ?? true,
      isActive: initialBook?.isActive ?? true,
      source: initialBook?.source || 'manual',
      genres: draft.genres,
      rating: initialBook?.rating || 0,
      synopsis: draft.synopsis.trim(),
      series: draft.series.trim(),
      volume: draft.volume.trim(),
      language: draft.language.trim(),
      releaseDate: undefined,
      unreleased: false,
      publicShared: true,
      tropes: draft.tropes,
      tags: initialBook?.tags || [],
    }
    const shelfData: Partial<ShelfEntry> = {
      status,
      progress,
      currentPage: status === 'read' ? totalPages : currentPage,
      startDate: draft.startDate || undefined,
      endDate: draft.endDate || undefined,
      format: draft.format.trim() || undefined,
    }

    try {
      const saved = await onSave(book, shelfData)
      if (saved === false) return
      onClose()
    } catch {
      setError('Nao foi possivel salvar este livro agora.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center" onClick={e => e.currentTarget === e.target && onClose()}>
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-stone-800 bg-stone-900">
        <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-stone-800 bg-stone-900 px-4 py-3">
          <div>
            <h2 className="font-serif text-xl text-stone-50">{mode === 'new' ? 'Novo livro' : 'Editar livro'}</h2>
            <p className="mt-1 text-xs text-stone-500">Cadastre os dados principais para encontrar e organizar o livro.</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-300 hover:bg-stone-800">Fechar</button>
        </div>

        <div className="space-y-6 p-4">
          <section className="space-y-4 rounded-lg border border-stone-800 bg-stone-950/50 p-4">
            <div>
              <h3 className="font-serif text-lg text-stone-100">Dados principais do livro</h3>
              <p className="mt-1 text-xs text-stone-500">Titulo, autor, capa, paginas e capitulos sao obrigatorios.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-stone-300">Titulo *<input value={draft.title} onChange={e => update('title', e.target.value)} placeholder="Ex.: Quarta Asa" className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>
              <label className="text-sm font-semibold text-stone-300">Autor *<input value={draft.author} onChange={e => update('author', e.target.value)} placeholder="Ex.: Rebecca Yarros" className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-stone-300">Capa do livro *</p>
                <label className="inline-flex w-fit cursor-pointer rounded-lg border border-stone-700 px-3 py-2 text-xs font-bold text-stone-300 hover:bg-stone-800">
                  {uploadingCover ? 'Enviando...' : 'Enviar capa'}
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploadingCover(true)
                    setError('')
                    try {
                      update('cover', await onUploadCover(file))
                      update('coverFileName', file.name)
                    } catch {
                      setError('Nao foi possivel enviar a capa agora.')
                    } finally {
                      setUploadingCover(false)
                    }
                  }} />
                </label>
                <p className="text-xs text-stone-500">{draft.coverFileName || 'Nenhum ficheiro selecionado'}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Previa da capa</p>
                {draft.cover ? <img src={resolveMediaUrl(draft.cover)} alt="Previa da capa" className="h-40 w-28 rounded-lg object-cover" /> : <div className="flex h-40 w-28 items-center justify-center rounded-lg border border-stone-800 bg-stone-950 text-xs text-stone-600">Sem capa</div>}
                <button onClick={() => update('cover', '')} className="mt-2 text-xs font-bold text-red-300 hover:text-red-200">Remover capa</button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-stone-300">Serie<input value={draft.series} onChange={e => update('series', e.target.value)} placeholder="Nome da serie" className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>
              <label className="text-sm font-semibold text-stone-300">Volume<input value={draft.volume} onChange={e => update('volume', e.target.value)} placeholder="Ex.: 1" className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>
            </div>
            <label className="block text-sm font-semibold text-stone-300">
              Sinopse
              <textarea
                value={draft.synopsis}
                onChange={e => update('synopsis', e.target.value)}
                placeholder="Resumo do livro, premissa ou descrição da edição"
                className="mt-1 min-h-28 w-full resize-y rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-100 outline-none focus:border-amber-300"
              />
            </label>
            <MultiChoicePicker title="Generos" searchLabel="Buscar genero..." countLabel="selecionados" options={GENRE_OPTIONS} selected={draft.genres} query={draft.genreQuery} onQueryChange={value => update('genreQuery', value)} onToggle={value => toggleListValue('genres', value)} hint="Marque um ou mais generos cadastrados no app." />
            <MultiChoicePicker title="Tropes" searchLabel="Buscar trope..." countLabel="selecionadas" options={TROPE_OPTIONS} selected={draft.tropes} query={draft.tropeQuery} onQueryChange={value => update('tropeQuery', value)} onToggle={value => toggleListValue('tropes', value)} hint="Use a busca e marque uma ou mais tropes cadastradas no app." />
          </section>

          <section className="space-y-4 rounded-lg border border-stone-800 bg-stone-950/50 p-4">
            <div>
              <h3 className="font-serif text-lg text-stone-100">{includeShelfFields ? 'Leitura e estrutura' : 'Estrutura da obra'}</h3>
              <p className="mt-1 text-xs text-stone-500">{includeShelfFields ? 'Defina como o livro entra na sua estante e a estrutura basica da obra.' : 'Cadastre a estrutura basica para o livro aparecer na Biblioteca.'}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-stone-300">Idioma<input value={draft.language} onChange={e => update('language', e.target.value)} placeholder="Portugues, Ingles..." className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>
              {includeShelfFields && <label className="text-sm font-semibold text-stone-300">Status<select value={draft.status} onChange={e => update('status', e.target.value as BookStatus)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300">{(['want', 'reading', 'read', 'rereading', 'abandoned'] as BookStatus[]).map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>}
              <label className="text-sm font-semibold text-stone-300">Paginas totais *<input type="number" min="1" value={draft.totalPages} onChange={e => update('totalPages', e.target.value)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>
              {includeShelfFields && <label className="text-sm font-semibold text-stone-300">Pagina atual<input type="number" min="0" value={draft.currentPage} onChange={e => update('currentPage', e.target.value)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>}
              <label className="text-sm font-semibold text-stone-300">Capitulos totais *<input type="number" min="1" value={draft.totalChapters} onChange={e => update('totalChapters', e.target.value)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>
              {includeShelfFields && <label className="text-sm font-semibold text-stone-300">Formato<input value={draft.format} onChange={e => update('format', e.target.value)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /></label>}
              {includeShelfFields && (
                <div className="col-span-full grid grid-cols-2 gap-2">
                  <label className="min-w-0 text-xs font-bold uppercase tracking-[0.12em] text-stone-500">
                    Inicio
                    <input type="date" value={draft.startDate} onChange={e => update('startDate', e.target.value)} className="folio-date-input folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-[11px] normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300" />
                  </label>
                  <label className="min-w-0 text-xs font-bold uppercase tracking-[0.12em] text-stone-500">
                    Conclusao
                    <input type="date" value={draft.endDate} onChange={e => update('endDate', e.target.value)} className="folio-date-input folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-[11px] normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300" />
                  </label>
                </div>
              )}
            </div>
          </section>

          {error && <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-stone-800 bg-stone-900 px-4 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold text-stone-400 hover:bg-stone-800">Fechar</button>
          <button onClick={() => save()} disabled={!canSave || saving} className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">{saving ? 'Salvando...' : 'Salvar livro'}</button>
        </div>
      </div>
    </div>
  )
}

function ShelfPage({ currentUser, shelf, books, onBookClick, onUpdateShelfEntry, onRemoveShelfEntry, onAddBook, onSaveBook, onSearchBooks }: {
  currentUser: User
  shelf: ShelfEntry[]
  books: Book[]
  onBookClick: (id: string) => void
  onUpdateShelfEntry: (bookId: string, changes: Partial<ShelfEntry>, feedback?: ActionFeedback) => Promise<boolean | void> | boolean | void
  onRemoveShelfEntry: (bookId: string) => Promise<boolean | void> | boolean | void
  onAddBook: (bookId: string, status: BookStatus) => Promise<boolean | void> | boolean | void
  onSaveBook: (book: Book) => Promise<boolean | void> | boolean | void
  onSearchBooks: (query: string, field: BookSearchField) => Promise<Book[]>
}) {
  const [activeStatus, setActiveStatus] = useState<BookStatus>('reading')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [chapterInput, setChapterInput] = useState('')
  const [bookQuery, setBookQuery] = useState('')
  const [bookSearchField, setBookSearchField] = useState<BookSearchField>('all')
  const [newBookStatus, setNewBookStatus] = useState<BookStatus>('reading')
  const [catalogResults, setCatalogResults] = useState<Book[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [bookSearchAttempted, setBookSearchAttempted] = useState(false)
  const { askDate, datePromptDialog } = useDatePrompt()
  const statuses: BookStatus[] = ['reading', 'want', 'read', 'rereading', 'abandoned']
  const myShelf = shelf.filter(s => s.userId === currentUser.id)
  const statusCounts = statuses.reduce((acc, status) => ({ ...acc, [status]: myShelf.filter(entry => entry.status === status).length }), {} as Record<BookStatus, number>)
  const filtered = myShelf
    .filter(entry => entry.status === activeStatus)
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)

  async function searchCatalog() {
    const query = bookQuery.trim()
    if (query.length < 2) return
    const localResults = books
      .filter(book => bookMatchesSearch(book, query, bookSearchField))
      .sort((a, b) => Number(normalizeSearch(b.title).startsWith(normalizeSearch(query))) - Number(normalizeSearch(a.title).startsWith(normalizeSearch(query))))
      .slice(0, 12)
    setCatalogLoading(true)
    setCatalogError('')
    setBookSearchAttempted(true)
    try {
      const apiResults = await onSearchBooks(query, bookSearchField)
      setCatalogResults(mergeBooksById(localResults, apiResults).slice(0, 20))
    } catch {
      setCatalogResults(localResults)
      setCatalogError(localResults.length ? 'Mostrando resultados da base do app. Não consegui consultar a API agora.' : 'Não consegui consultar agora. Tente novamente em instantes.')
    } finally {
      setCatalogLoading(false)
    }
  }

  function startEdit(book: Book, entry: ShelfEntry) {
    setEditingId(book.id)
    setChapterInput(String(chapterFromPercent(book, entry.progress)))
  }

  async function saveProgress(book: Book) {
    const nextProgress = percentFromChapter(book, Number(chapterInput))
    const status = nextProgress >= 100 ? 'read' : activeStatus === 'read' ? 'reading' : activeStatus
    const dateChanges = await datesForShelfStatus(status, filtered.find(item => item.book.id === book.id)?.entry, askDate)
    if (!dateChanges) return
    const saved = await onUpdateShelfEntry(book.id, {
      progress: nextProgress,
      status,
      ...dateChanges,
    }, {
      success: 'Progresso atualizado com sucesso.',
      error: 'Nao foi possivel atualizar o progresso.',
    })
    if (saved === false) return
    setEditingId(null)
  }

  return (
    <section>
      <Header title="Minha estante">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {statuses.map(status => (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${activeStatus === status ? 'bg-amber-300 text-stone-950' : 'bg-stone-900 text-stone-400'}`}
            >
              {STATUS_LABELS[status]} {statusCounts[status] ? `· ${statusCounts[status]}` : ''}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
          <label className="block text-xs font-bold uppercase tracking-[0.14em] text-stone-500">
            Adicionar livro
            <input
              value={bookQuery}
              onChange={e => {
                setBookQuery(e.target.value)
                setBookSearchAttempted(false)
                setCatalogError('')
                setCatalogResults([])
              }}
              placeholder="Pesquisar por título ou autor"
              className="mt-2 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <select value={bookSearchField} onChange={e => {
              setBookSearchField(e.target.value as BookSearchField)
              setBookSearchAttempted(false)
              setCatalogResults([])
              setCatalogError('')
            }} className="min-w-28 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300">
              {(Object.keys(BOOK_SEARCH_FIELD_LABELS) as BookSearchField[]).map(field => <option key={field} value={field}>{BOOK_SEARCH_FIELD_LABELS[field]}</option>)}
            </select>
            <select value={newBookStatus} onChange={e => setNewBookStatus(e.target.value as BookStatus)} className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300">
              {statuses.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
            <button onClick={searchCatalog} disabled={bookQuery.trim().length < 2 || catalogLoading} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">
              {catalogLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          {bookQuery && (
            <div className="mt-3 space-y-2">
              {catalogResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Resultados de busca</p>
                  {catalogResults.map(book => {
                    const shelfEntry = myShelf.find(entry => entry.bookId === book.id)
                    const registeredBook = books.some(item => item.id === book.id)
                    const secondaryLabel = !shelfEntry && registeredBook && book.isActive !== false ? 'Adicionar' : undefined
                    const metaLabel = book.isActive === false ? 'Inativo' : shelfEntry ? 'Na estante' : registeredBook ? 'Biblioteca' : 'API Google Books'
                    return (
                      <BookSearchRow
                        key={book.id}
                        book={book}
                        metaLabel={metaLabel}
                        actionLabel={registeredBook ? 'Abrir' : 'Cadastrar'}
                        onAction={async () => {
                          if (registeredBook) {
                            onBookClick(book.id)
                          } else {
                            const saved = await onSaveBook(book)
                            if (saved === false) return
                            setBookQuery('')
                            setCatalogResults([])
                            setBookSearchAttempted(false)
                          }
                        }}
                        secondaryLabel={secondaryLabel}
                        onSecondaryAction={async () => {
                          if (registeredBook) {
                            const added = await onAddBook(book.id, newBookStatus)
                            if (added === false) return
                          }
                          setBookQuery('')
                          setCatalogResults([])
                          setBookSearchAttempted(false)
                          setActiveStatus(newBookStatus)
                        }}
                      />
                    )
                  })}
                </div>
              )}
              {catalogError && <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{catalogError}</p>}
              {!catalogResults.length && !catalogLoading && !catalogError && (
                <p className="text-sm text-stone-500">
                  {bookSearchAttempted ? 'Nenhum livro encontrado com esse nome.' : 'Digite e clique em Buscar para consultar o catálogo.'}
                </p>
              )}
            </div>
          )}
        </div>
      </Header>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map(({ entry, book }) => (
          <article key={book.id} className="overflow-hidden rounded-lg border border-stone-800 bg-stone-900">
            <button onClick={() => onBookClick(book.id)} className="grid w-full grid-cols-[92px_1fr] text-left sm:block">
              {book.cover ? (
                <img src={resolveMediaUrl(book.cover)} alt={book.title} className="h-full min-h-36 w-full object-cover sm:h-48" />
              ) : (
                <div className="flex h-full min-h-36 w-full items-center justify-center bg-stone-800 text-xs text-stone-500 sm:h-48">Sem capa</div>
              )}
              <div className="p-3">
                <h2 className="line-clamp-2 font-serif text-base leading-tight text-stone-100">{book.title}</h2>
                <p className="mt-1 text-sm text-stone-500">{book.author}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {book.genres.slice(0, 2).map(genre => <span key={genre} className="rounded-full border border-stone-700 px-2 py-0.5 text-xs text-stone-400">{genre}</span>)}
                </div>
              </div>
            </button>
            <div className="border-t border-stone-800 p-3">
              <div className="mb-3 grid grid-cols-2 gap-2">
                <select
                  value={entry.status}
                  onChange={async e => {
                    const status = e.target.value as BookStatus
                    const dateChanges = await datesForShelfStatus(status, entry, askDate)
                    if (!dateChanges) return
                    onUpdateShelfEntry(book.id, {
                      status,
                      progress: status === 'read' ? 100 : entry.progress >= 100 ? 0 : entry.progress,
                      ...dateChanges,
                    })
                  }}
                  className="folio-field-control w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs font-bold text-stone-100 outline-none focus:border-amber-300"
                >
                  {statuses.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
                {canRateStatus(entry.status) ? (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={entry.rating ?? ''}
                      onChange={e => onUpdateShelfEntry(book.id, { rating: Number(e.target.value) })}
                      className="folio-field-control rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs font-bold text-amber-300 outline-none focus:border-amber-300"
                    >
                      <option value="">★</option>
                      {RATING_OPTIONS.map(value => <option key={value} value={value}>{value} ★</option>)}
                    </select>
                    <select
                      value={entry.spiceRating ?? ''}
                      onChange={e => onUpdateShelfEntry(book.id, { spiceRating: Number(e.target.value) })}
                      className="folio-field-control rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs font-bold text-red-300 outline-none focus:border-red-300"
                    >
                      <option value="">Hot</option>
                      {RATING_OPTIONS.map(value => <option key={value} value={value}>{value} 🌶</option>)}
                    </select>
                  </div>
                ) : editingId === book.id && (entry.status === 'reading' || entry.status === 'rereading') ? (
                  <input
                    type="number"
                    min="1"
                    max={book.totalChapters}
                    value={chapterInput}
                    onChange={e => setChapterInput(e.target.value)}
                    placeholder="Cap."
                    aria-label="Capítulo atual"
                    className="folio-field-control w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs text-stone-100 outline-none focus:border-amber-300"
                  />
                ) : (
                  <span className="folio-field-control flex rounded-lg border border-stone-800 px-2 py-2 text-xs text-stone-500">Cap. {chapterFromPercent(book, entry.progress)}</span>
                )}
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <label className="min-w-0 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
                  Inicio
                  <input
                    type="date"
                    value={dateInputValue(entry.startDate)}
                    onChange={e => onUpdateShelfEntry(book.id, { startDate: e.target.value || undefined })}
                    className="folio-date-input folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-[11px] normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
                  />
                </label>
                <label className="min-w-0 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
                  Conclusao
                  <input
                    type="date"
                    value={dateInputValue(entry.endDate)}
                    onChange={e => onUpdateShelfEntry(book.id, { endDate: e.target.value || undefined })}
                    className="folio-date-input folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-[11px] normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
                  />
                </label>
              </div>
              {entry.status === 'reading' || entry.status === 'rereading' ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">Cap. {chapterFromPercent(book, entry.progress)}</span>
                    <button onClick={() => startEdit(book, entry)} className="text-xs font-semibold text-stone-500 hover:text-stone-200">
                      atualizar
                    </button>
                  </div>
                  {editingId === book.id ? (
                    <div className="grid gap-2">
                      <button onClick={() => saveProgress(book)} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">
                        Salvar progresso
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500">Leitura no capítulo {chapterFromPercent(book, entry.progress)}</p>
                  )}
                </>
              ) : canRateStatus(entry.status) ? (
                <div>
                  <p className="mb-2 text-sm text-stone-400">{entry.status === 'abandoned' ? 'Leitura abandonada' : 'Leitura concluída'}</p>
                  <div className="flex flex-wrap gap-2 text-sm font-bold">
                    {entry.rating && <span className="text-amber-300">{ratingText(entry.rating)}</span>}
                    {entry.spiceRating && <span className="text-red-300">{ratingText(entry.spiceRating, 'pimentas')}</span>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-stone-500">{STATUS_LABELS[entry.status]}</p>
              )}
              <button onClick={() => onRemoveShelfEntry(book.id)} className="mt-3 w-full rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-400/10 hover:text-red-200">
                Remover da estante
              </button>
            </div>
          </article>
        ))}
        {!filtered.length && <div className="sm:col-span-2 xl:col-span-3"><EmptyState text="Nenhum livro nessa categoria ainda." /></div>}
      </div>
      {datePromptDialog}
    </section>
  )
}

function LibraryPage({ currentUser, shelf, books, onBookClick, onAddBook, onSaveBook, onSetBookActive, onDeleteBook, onSearchBooks, onUploadCover }: {
  currentUser: User
  shelf: ShelfEntry[]
  books: Book[]
  onBookClick: (id: string) => void
  onAddBook: (bookId: string, status: BookStatus) => Promise<boolean | void> | boolean | void
  onSaveBook: (book: Book) => Promise<boolean | void> | boolean | void
  onSetBookActive: (bookId: string, active: boolean) => Promise<boolean | void> | boolean | void
  onDeleteBook: (bookId: string) => Promise<boolean | void> | boolean | void
  onSearchBooks: (query: string, field: BookSearchField) => Promise<Book[]>
  onUploadCover: (file: File) => Promise<string>
}) {
  const [query, setQuery] = useState('')
  const [searchField, setSearchField] = useState<BookSearchField>('all')
  const [searchResults, setSearchResults] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [bookModal, setBookModal] = useState<{ mode: 'new' | 'edit'; book?: Book } | null>(null)
  const [newBookStatus, setNewBookStatus] = useState<BookStatus>('want')
  const isAdmin = currentUser.role === 'admin'
  const myShelf = shelf.filter(entry => entry.userId === currentUser.id)
  const normalizedQuery = query.trim()
  const visibleBooks = useMemo(() => {
    const local = normalizedQuery
      ? books.filter(book => bookMatchesSearch(book, normalizedQuery, searchField))
      : books

    return mergeBooksById(local, searchResults)
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, normalizedQuery ? 30 : 60)
  }, [books, normalizedQuery, searchField, searchResults])

  async function searchLibrary() {
    if (normalizedQuery.length < 2) return
    const localResults = books
      .filter(book => bookMatchesSearch(book, normalizedQuery, searchField))
      .slice(0, 12)

    setLoading(true)
    setError('')
    setAttempted(true)
    try {
      const apiResults = await onSearchBooks(normalizedQuery, searchField)
      setSearchResults(mergeBooksById(localResults, apiResults))
    } catch {
      setSearchResults(localResults)
      setError(localResults.length ? 'Mostrando resultados da Biblioteca local.' : 'Nao consegui buscar livros agora.')
    } finally {
      setLoading(false)
    }
  }

  async function saveBookForm(book: Book) {
    const saved = await onSaveBook(book)
    if (saved === false) return false
    setBookModal(null)
    setQuery('')
    setSearchResults([])
    setAttempted(false)
    return true
  }

  return (
    <section>
      <Header title="Biblioteca">
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setSearchResults([])
                setAttempted(false)
                setError('')
              }}
              placeholder="Pesquisar por titulo, autor ou genero"
              className="min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-300"
            />
            <button onClick={() => setBookModal({ mode: 'new' })} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">
              Cadastrar livro
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <select value={searchField} onChange={e => {
              setSearchField(e.target.value as BookSearchField)
              setSearchResults([])
              setAttempted(false)
              setError('')
            }} className="min-w-28 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300">
              {(Object.keys(BOOK_SEARCH_FIELD_LABELS) as BookSearchField[]).map(field => <option key={field} value={field}>{BOOK_SEARCH_FIELD_LABELS[field]}</option>)}
            </select>
            <select value={newBookStatus} onChange={e => setNewBookStatus(e.target.value as BookStatus)} className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300">
              {(['want', 'reading', 'read', 'rereading', 'abandoned'] as BookStatus[]).map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
            <button onClick={searchLibrary} disabled={normalizedQuery.length < 2 || loading} className="rounded-lg border border-stone-700 px-3 py-2 text-sm font-bold text-stone-300 hover:bg-stone-800 disabled:opacity-60">
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          {error && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</p>}
          {attempted && !visibleBooks.length && !loading && !error && <p className="mt-3 text-sm text-stone-500">Nenhum livro encontrado.</p>}
        </div>
      </Header>

      <div className="space-y-2 p-4">
        {visibleBooks.map(book => {
          const registeredBook = books.some(item => item.id === book.id)
          const shelfEntry = myShelf.find(entry => entry.bookId === book.id)
          return (
            <BookSearchRow
              key={book.id}
              book={book}
              metaLabel={book.isActive === false ? 'Inativo' : shelfEntry ? 'Na estante' : registeredBook ? 'Biblioteca' : 'API Google Books'}
              actionLabel={registeredBook ? 'Editar' : 'Cadastrar'}
              onAction={async () => {
                if (registeredBook) {
                  setBookModal({ mode: 'edit', book })
                } else {
                  await saveBookForm(book)
                }
              }}
              secondaryLabel={registeredBook ? book.isActive === false ? undefined : shelfEntry ? 'Abrir' : 'Adicionar' : undefined}
              onSecondaryAction={async () => {
                if (shelfEntry) {
                  onBookClick(book.id)
                } else if (registeredBook) {
                  try {
                    const added = await onAddBook(book.id, newBookStatus)
                    if (added === false) return
                  } catch (error) {
                    setError(errorMessage(error, 'Nao foi possivel adicionar este livro a estante.'))
                  }
                }
              }}
              inactiveLabel={isAdmin && registeredBook ? book.isActive === false ? 'Reativar' : 'Inativar' : undefined}
              onInactiveAction={async () => {
                if (!registeredBook) return
                const nextActive = book.isActive === false
                const confirmed = nextActive || window.confirm('Inativar este livro? Ele continuara salvo para preservar comentarios.')
                if (!confirmed) return
                try {
                  await onSetBookActive(book.id, nextActive)
                } catch (error) {
                  setError(errorMessage(error, nextActive ? 'Nao foi possivel reativar este livro.' : 'Nao foi possivel inativar este livro.'))
                }
              }}
              dangerLabel={isAdmin && registeredBook ? 'Excluir' : undefined}
              onDangerAction={async () => {
                if (!registeredBook) return
                if (!window.confirm('Excluir este livro da Biblioteca? Se ele tiver comentarios, a exclusao sera bloqueada.')) return
                try {
                  await onDeleteBook(book.id)
                } catch (error) {
                  setError(errorMessage(error, 'Nao foi possivel excluir este livro.'))
                }
              }}
            />
          )
        })}
        {!visibleBooks.length && !attempted && <EmptyState text="Nenhum livro cadastrado na Biblioteca ainda." />}
      </div>

      {bookModal && (
        <BookFormModal
          mode={bookModal.mode}
          initialBook={bookModal.book}
          defaultStatus={newBookStatus}
          includeShelfFields={false}
          onClose={() => setBookModal(null)}
          onSave={saveBookForm}
          onUploadCover={onUploadCover}
        />
      )}
    </section>
  )
}

function BookPage({ book, shelf, posts, replies, users, currentUser, onBack, onUserClick, onAddReply, onToggleLike, onToggleReplyLike, onDeletePost, onDeleteReply, onUpdateShelfEntry, onAddBook }: {
  book: Book
  shelf: ShelfEntry[]
  posts: Post[]
  replies: Reply[]
  users: User[]
  currentUser: User
  onBack: () => void
  onUserClick: (id: string) => void
  onAddReply: (postId: string, text: string, parentReplyId?: string) => Promise<boolean | void> | boolean | void
  onToggleLike: (postId: string) => Promise<boolean | void> | boolean | void
  onToggleReplyLike: (replyId: string) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onDeleteReply: (replyId: string) => Promise<boolean | void> | boolean | void
  onUpdateShelfEntry: (bookId: string, changes: Partial<ShelfEntry>, feedback?: ActionFeedback) => Promise<boolean | void> | boolean | void
  onAddBook: (bookId: string, status: BookStatus) => Promise<boolean | void> | boolean | void
}) {
  const [tab, setTab] = useState<'feed' | 'theories' | 'about'>('feed')
  const [newShelfStatus, setNewShelfStatus] = useState<BookStatus>('reading')
  const { askDate, datePromptDialog } = useDatePrompt()
  const myEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === book.id)
  const myProgress = myEntry?.progress ?? 0
  const hasFullBookAccess = myEntry?.status === 'read' || myEntry?.status === 'rereading'
  const defaultChapter = hasFullBookAccess ? book.totalChapters : chapterFromPercent(book, myProgress)
  const [chapterLimit, setChapterLimit] = useState(defaultChapter)
  const [chapterInput, setChapterInput] = useState(String(defaultChapter))
  const readers = shelf.filter(entry => entry.bookId === book.id).length
  const ratings = shelf
    .filter(entry => entry.bookId === book.id && typeof entry.rating === 'number' && entry.rating > 0)
    .map(entry => entry.rating!)
  const spiceRatings = shelf
    .filter(entry => entry.bookId === book.id && typeof entry.spiceRating === 'number' && entry.spiceRating > 0)
    .map(entry => entry.spiceRating!)
  const averageRating = ratings.length
    ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
    : undefined
  const averageSpiceRating = spiceRatings.length
    ? spiceRatings.reduce((total, rating) => total + rating, 0) / spiceRatings.length
    : undefined
  const platformRating = ratingSummaryText(averageRating, ratings.length)
  const platformSpiceRating = spiceSummaryText(averageSpiceRating, spiceRatings.length)

  const postsInBook = posts.filter(post => post.bookId === book.id)
  const comments = postsInBook.filter(post => post.type !== 'theory').sort(newestFirst)
  const theories = postsInBook.filter(post => post.type === 'theory').sort(newestFirst)
  const visibleChapterLimit = hasFullBookAccess ? book.totalChapters : chapterLimit
  const activeList = tab === 'theories' ? theories : comments
  const detailRows = [
    ['Série', book.series || 'Não informado'],
    ['Volume', book.volume || 'Não informado'],
    ['Idioma', book.language || 'Não informado'],
    ['Origem', book.source === 'googlebooks' ? 'Google Books' : book.source === 'manual' ? 'Cadastro manual' : book.source || 'Não informado'],
  ]
  const tropeList = book.tropes || []

  return (
    <section>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-800 bg-stone-950/90 px-4 py-3 backdrop-blur-xl md:px-5">
        <button onClick={onBack} className="rounded-lg px-2 py-1 text-xl leading-none text-stone-400 hover:bg-stone-900 hover:text-stone-100">
          ←
        </button>
        <h1 className="min-w-0 truncate font-serif text-base text-stone-100">{book.title}</h1>
      </header>

      <div className="border-b border-stone-800 p-3 md:p-5">
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[132px_1fr] sm:gap-4">
          <img src={resolveMediaUrl(book.cover)} alt={book.title} className="h-32 w-[5.5rem] rounded-lg object-cover sm:h-52 sm:w-full" />
          <div className="contents min-w-0 sm:block">
            <div className="min-w-0">
              <h2 className="font-serif text-xl leading-tight text-stone-50 sm:text-2xl">{book.title}</h2>
              <p className="mt-0.5 text-sm text-stone-400 sm:mt-1">{book.author}</p>
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-stone-500 sm:mt-3 sm:text-xs">
                <span className="font-bold text-amber-300">{platformRating}</span>
                <span className="font-bold text-red-300">{platformSpiceRating}</span>
                <span>{book.totalPages} páginas</span>
                <span>{book.totalChapters} capítulos{book.chaptersEstimated ? ' estimados' : ''}</span>
                <span>{readers} leitores</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 sm:mt-3">
                {book.genres.map(genre => <span key={genre} className="rounded-full border border-stone-700 bg-stone-900 px-1.5 py-0.5 text-[10px] text-stone-300 sm:px-2 sm:py-1 sm:text-xs">{genre}</span>)}
              </div>
            </div>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-2 sm:mt-4 sm:p-3">
                <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Filtro anti-spoiler</span>
                  <span className="text-xs text-stone-400">{hasFullBookAccess ? 'Livro liberado' : `Seu capítulo: ${defaultChapter}`}</span>
                </div>
                <label className="grid gap-1.5 text-xs text-stone-400 sm:gap-2">
                  {hasFullBookAccess ? 'Comentários e teorias liberados até o fim do livro' : `Mostrar comentários até o capítulo ${chapterLimit}`}
                  <input type="range" min="1" max={book.totalChapters} value={visibleChapterLimit} disabled={hasFullBookAccess} onChange={e => setChapterLimit(Number(e.target.value))} className="accent-amber-300 disabled:opacity-50" />
                </label>
              </div>
              <div className="folio-book-progress mt-2 rounded-lg border border-stone-800 bg-stone-900 p-2 sm:mt-3 sm:p-3">
                {myEntry ? (
                  <>
                    {myEntry.status === 'reading' || myEntry.status === 'rereading' ? (
                      <>
                        <div className="mb-2 grid grid-cols-2 gap-2">
                          <label className="min-w-0 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
                            Status
                            <select
                              value={myEntry.status}
                              onChange={async e => {
                                const status = e.target.value as BookStatus
                                const dateChanges = await datesForShelfStatus(status, myEntry, askDate)
                                if (!dateChanges) return
                                onUpdateShelfEntry(book.id, {
                                  status,
                                  progress: status === 'read' ? 100 : myEntry.progress >= 100 ? 0 : myEntry.progress,
                                  ...dateChanges,
                                })
                                if (status === 'read' || status === 'rereading') {
                                  setChapterInput(String(book.totalChapters))
                                  setChapterLimit(book.totalChapters)
                                }
                              }}
                              className="folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs font-bold normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
                            >
                              {(['reading', 'want', 'read', 'rereading', 'abandoned'] as BookStatus[]).map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                            </select>
                          </label>
                          <label className="min-w-0 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
                            Capitulo
                            <input
                              type="number"
                              min="1"
                              max={book.totalChapters}
                              value={chapterInput}
                              onChange={e => setChapterInput(e.target.value)}
                              className="folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
                              aria-label="Capítulo atual"
                            />
                          </label>
                        </div>
                        <button onClick={async () => {
                          const nextProgress = percentFromChapter(book, Number(chapterInput))
                          const status = nextProgress >= 100 ? 'read' : myEntry.status
                          const dateChanges = await datesForShelfStatus(status, myEntry, askDate)
                          if (!dateChanges) return
                          const saved = await onUpdateShelfEntry(book.id, {
                            progress: nextProgress,
                            status,
                            ...dateChanges,
                          }, {
                            success: 'Progresso atualizado com sucesso.',
                            error: 'Nao foi possivel atualizar o progresso.',
                          })
                          if (saved === false) return
                          setChapterLimit(chapterFromPercent(book, nextProgress))
                        }} className="mb-2 w-full rounded-lg bg-amber-300 px-3 py-1.5 text-sm font-bold text-stone-950 sm:mb-3 sm:py-2">
                          Atualizar
                        </button>
                      </>
                    ) : (
                      <div className="mb-3 grid gap-2 sm:grid-cols-2">
                        <select
                          value={myEntry.status}
                          onChange={async e => {
                            const status = e.target.value as BookStatus
                            const dateChanges = await datesForShelfStatus(status, myEntry, askDate)
                            if (!dateChanges) return
                            onUpdateShelfEntry(book.id, {
                              status,
                              progress: status === 'read' ? 100 : myEntry.progress >= 100 ? 0 : myEntry.progress,
                              ...dateChanges,
                            })
                            if (status === 'read' || status === 'rereading') {
                              setChapterInput(String(book.totalChapters))
                              setChapterLimit(book.totalChapters)
                            }
                          }}
                          className="folio-field-control w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-stone-100 outline-none focus:border-amber-300"
                        >
                          {(['reading', 'want', 'read', 'rereading', 'abandoned'] as BookStatus[]).map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                        </select>
                        {canRateStatus(myEntry.status) && (
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={myEntry.rating ?? ''}
                              onChange={e => onUpdateShelfEntry(book.id, { rating: Number(e.target.value) })}
                              className="folio-field-control min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-amber-300 outline-none focus:border-amber-300"
                            >
                              <option value="">Estrelas</option>
                              {RATING_OPTIONS.map(value => <option key={value} value={value}>{value} ★</option>)}
                            </select>
                            <select
                              value={myEntry.spiceRating ?? ''}
                              onChange={e => onUpdateShelfEntry(book.id, { spiceRating: Number(e.target.value) })}
                              className="folio-field-control min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-red-300 outline-none focus:border-red-300"
                            >
                              <option value="">Pimentas</option>
                              {RATING_OPTIONS.map(value => <option key={value} value={value}>{value} 🌶</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3">
                      <label className="min-w-0 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
                        Inicio
                        <input
                          type="date"
                          value={dateInputValue(myEntry.startDate)}
                          onChange={e => onUpdateShelfEntry(book.id, { startDate: e.target.value || undefined })}
                          className="folio-date-input folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-[11px] normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
                        />
                      </label>
                      <label className="min-w-0 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-500">
                        Conclusao
                        <input
                          type="date"
                          value={dateInputValue(myEntry.endDate)}
                          onChange={e => onUpdateShelfEntry(book.id, { endDate: e.target.value || undefined })}
                          className="folio-date-input folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-[11px] normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
                        />
                      </label>
                    </div>
                  </>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select
                      value={newShelfStatus}
                      onChange={e => setNewShelfStatus(e.target.value as BookStatus)}
                      className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-stone-100 outline-none focus:border-amber-300"
                    >
                      {(['reading', 'want', 'read', 'rereading', 'abandoned'] as BookStatus[]).map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                    </select>
                    <button onClick={() => onAddBook(book.id, newShelfStatus)} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">Adicionar à estante</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[53px] z-[60] grid grid-cols-3 border-b border-stone-800 bg-stone-950">
        {([['feed', 'Feed'], ['theories', 'Teorias'], ['about', 'Sobre']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`border-b-2 px-3 py-3 text-sm font-bold transition ${tab === id ? 'border-amber-300 text-amber-300' : 'border-transparent text-stone-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'about' ? (
        <div className="space-y-4 p-4 md:p-5">
          <div>
            <h3 className="mb-2 font-serif text-lg text-stone-100">Sinopse</h3>
            <p className="text-sm leading-relaxed text-stone-300">{book.synopsis}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {detailRows.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-stone-800 bg-stone-900 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">{label}</p>
                <p className="mt-1 text-sm font-semibold text-stone-200">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-stone-200">Gêneros</h3>
              <div className="flex flex-wrap gap-2">
                {book.genres.length ? book.genres.map(genre => <span key={genre} className="rounded-full border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-300">{genre}</span>) : <span className="text-sm text-stone-500">Não informado</span>}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-stone-200">Tropes</h3>
              <div className="flex flex-wrap gap-2">
                {tropeList.length ? tropeList.map(trope => <span key={trope} className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-200">{trope}</span>) : <span className="text-sm text-stone-500">Não informado</span>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Páginas', book.totalPages],
              [book.chaptersEstimated ? 'Capítulos' : 'Capítulos', book.totalChapters],
              ['Avaliação', platformRating],
              ['Hot', platformSpiceRating],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-stone-800 bg-stone-900 p-3 text-center">
                <div className="font-serif text-xl text-amber-300">{value}</div>
                <div className="text-xs text-stone-500">{label}</div>
              </div>
            ))}
          </div>
          {book.source === 'googlebooks' && (
            <p className="text-xs text-stone-500">Dados importados. Páginas e nota vêm do catálogo; capítulos são estimados quando a API não informa divisão por capítulos.</p>
          )}
          {canRateStatus(myEntry?.status) && (
            <div className="rounded-lg border border-stone-800 bg-stone-900 p-4">
              <h3 className="mb-2 font-serif text-lg text-stone-100">Minha avaliação</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-stone-950 p-3">
                  <p className="text-xs text-stone-500">Nota literária</p>
                  <p className="font-bold text-amber-300">{ratingText(myEntry.rating)}</p>
                </div>
                <div className="rounded-lg bg-stone-950 p-3">
                  <p className="text-xs text-stone-500">Nível hot</p>
                  <p className="font-bold text-red-300">{ratingText(myEntry.spiceRating, 'pimentas')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {!activeList.length && <EmptyState text={tab === 'theories' ? 'Nenhuma teoria publicada ainda.' : 'Nenhum comentário publicado ainda.'} />}
          <PaginatedPostList
            posts={activeList}
            resetKey={`book-${book.id}-${tab}-${visibleChapterLimit}`}
            renderPost={post => <PostCard key={post.id} post={post} users={users} books={[book]} shelf={shelf} currentUser={currentUser} replies={replies} onBookClick={() => {}} onUserClick={onUserClick} onAddReply={onAddReply} onToggleLike={onToggleLike} onToggleReplyLike={onToggleReplyLike} onDeletePost={onDeletePost} onDeleteReply={onDeleteReply} compactBook protectSpoilers spoilerChapterLimit={visibleChapterLimit} />}
          />
        </div>
      )}
      {datePromptDialog}
    </section>
  )
}

function ProfilePage({ currentUser, profileUser, shelf, posts, books, onBookClick, onUpdateUser, onToggleFollow, onOpenProfileList, onLogout, onUploadAvatar }: {
  currentUser: User
  profileUser: User
  users: User[]
  shelf: ShelfEntry[]
  posts: Post[]
  books: Book[]
  onBookClick: (id: string) => void
  onUpdateUser: (changes: Partial<User>) => Promise<boolean | void> | boolean | void
  onUserClick: (userId: string) => void
  onToggleFollow: (userId: string) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onOpenProfileList: (kind: ProfileListKind) => void
  onLogout: () => void
  onUploadAvatar: (file: File) => Promise<string>
}) {
  const isOwnProfile = currentUser.id === profileUser.id
  const followingThisUser = currentUser.following.includes(profileUser.id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profileUser.name)
  const [handle, setHandle] = useState(profileUser.handle)
  const [bio, setBio] = useState(profileUser.bio)
  const [avatar, setAvatar] = useState(isMediaUrl(profileUser.avatar) ? profileUser.avatar : '')
  const [avatarFileName, setAvatarFileName] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [shelfFilter, setShelfFilter] = useState<BookStatus>('reading')
  const myShelf = shelf.filter(entry => entry.userId === profileUser.id)
  const myPosts = posts.filter(post => post.userId === profileUser.id)
  const visibleShelf = myShelf
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId) }))
    .filter((item): item is { entry: ShelfEntry; book: Book } => Boolean(item.book))
  const filteredShelf = visibleShelf.filter(({ entry }) => entry.status === shelfFilter)
  const shelfFilters: BookStatus[] = ['reading', 'want', 'read', 'rereading', 'abandoned']
  const topGenres = topReadTerms(profileUser.id, shelf, books, 'genres')
  const topTropes = topReadTerms(profileUser.id, shelf, books, 'tropes')

  return (
    <section>
      <Header title={isOwnProfile ? 'Perfil' : `@${profileUser.handle}`} />
      <div className="border-b border-stone-800 p-4 md:p-5">
        <div className="flex gap-4">
          <Avatar user={profileUser} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl text-stone-50">{profileUser.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-stone-500">@{profileUser.handle}</p>
              <span className="rounded-full border border-stone-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">
                {profileUser.role === 'admin' ? 'Administrador' : 'Leitor'}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">{profileUser.bio}</p>
          </div>
          {isOwnProfile ? (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button onClick={() => setEditing(value => !value)} className="h-9 rounded-lg border border-stone-700 px-3 text-xs font-bold text-stone-300 hover:bg-stone-900">
                {editing ? 'Fechar' : 'Editar'}
              </button>
              <button onClick={onLogout} className="h-9 rounded-lg border border-stone-700 px-3 text-xs font-bold text-stone-300 hover:bg-stone-900 md:hidden">
                Sair
              </button>
            </div>
          ) : (
            <button onClick={() => onToggleFollow(profileUser.id)} className={`h-9 rounded-lg px-3 text-xs font-bold ${followingThisUser ? 'bg-stone-800 text-stone-300' : 'bg-amber-300 text-stone-950'}`}>
              {followingThisUser ? 'Seguindo' : 'Seguir'}
            </button>
          )}
        </div>
        {isOwnProfile && editing && (
          <div className="mt-5 grid gap-3 rounded-lg border border-stone-800 bg-stone-900 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-stone-300">
                Nome
                <input value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" />
              </label>
              <label className="text-sm font-semibold text-stone-300">
                @
                <input value={handle} onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" />
              </label>
            </div>
            <label className="text-sm font-semibold text-stone-300">
              Frase do perfil
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" />
            </label>
            <div className="grid gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3 sm:grid-cols-[auto_1fr]">
              <Avatar user={{ ...profileUser, avatar: avatar || profileUser.avatar }} size="lg" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-300">Foto</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer rounded-lg border border-stone-700 px-3 py-2 text-xs font-bold text-stone-300 hover:bg-stone-800">
                    {uploadingAvatar ? 'Enviando...' : 'Enviar imagem'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploadingAvatar(true)
                        setAvatarError('')
                        try {
                          const uploadedAvatar = await onUploadAvatar(file)
                          setAvatar(uploadedAvatar)
                          setAvatarFileName(file.name)
                          const saved = await onUpdateUser({ avatar: uploadedAvatar })
                          if (saved === false) {
                            setAvatarError('Imagem enviada, mas nao foi possivel salvar no perfil.')
                          }
                        } catch {
                          setAvatarError('Nao foi possivel enviar a imagem agora.')
                        } finally {
                          setUploadingAvatar(false)
                        }
                      }}
                    />
                  </label>
                  {avatar && (
                    <button onClick={() => {
                      setAvatar('')
                      setAvatarFileName('')
                      setAvatarError('')
                    }} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/10">
                      Remover foto
                    </button>
                  )}
                  <span className="text-xs text-stone-500">{avatarFileName || 'Nenhum ficheiro selecionado'}</span>
                </div>
                {avatarError && <p className="mt-2 text-xs font-semibold text-red-300">{avatarError}</p>}
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={async () => {
                const fallbackAvatar = name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || profileUser.avatar
                const saved = await onUpdateUser({ name: name.trim() || profileUser.name, handle: handle.trim() || profileUser.handle, bio: bio.trim(), avatar: avatar.trim() || fallbackAvatar })
                if (saved === false) return
                setEditing(false)
              }} className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-stone-950">
                Salvar perfil
              </button>
            </div>
          </div>
        )}
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          {[
            ['Seguindo', profileUser.following.length, 'following'],
            ['Seguidores', profileUser.followers.length, 'followers'],
            ['Posts', myPosts.length, 'posts'],
          ].map(([label, value, kind]) => (
            <button key={label} onClick={() => onOpenProfileList(kind as ProfileListKind)} className="rounded-lg border border-stone-800 bg-stone-900 p-3 transition hover:border-amber-300/50 hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300/50">
              <div className="font-serif text-xl text-stone-100">{value}</div>
              <div className="text-xs text-stone-500">{label}</div>
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            ['Gêneros mais lidos', topGenres, 'border-stone-700 bg-stone-900 text-stone-300'],
            ['Tropes mais lidas', topTropes, 'border-amber-300/30 bg-amber-300/10 text-amber-200'],
          ].map(([title, items, classes]) => (
            <div key={title as string} className="rounded-lg border border-stone-800 bg-stone-900 p-3">
              <h3 className="mb-2 text-sm font-bold text-stone-200">{title as string}</h3>
              <div className="flex flex-wrap gap-2">
                {(items as [string, number][]).length ? (items as [string, number][]).map(([term, count]) => (
                  <span key={term} className={`rounded-full border px-2 py-1 text-xs ${classes as string}`}>
                    {term} · {count}
                  </span>
                )) : <span className="text-sm text-stone-500">Sem leituras suficientes ainda.</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-5">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {shelfFilters.map(status => {
            const count = myShelf.filter(entry => entry.status === status).length
            return (
              <button
                key={status}
                onClick={() => setShelfFilter(status)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                  shelfFilter === status ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800'
                }`}
              >
                {STATUS_LABELS[status]} {count ? `· ${count}` : ''}
              </button>
            )
          })}
        </div>

        <div className="space-y-3">
          {filteredShelf.length ? filteredShelf.map(({ entry, book }) => (
            <button key={entry.bookId} onClick={() => onBookClick(book.id)} className="flex w-full gap-3 rounded-lg border border-stone-800 bg-stone-900 p-3 text-left">
              {book.cover ? (
                <img src={resolveMediaUrl(book.cover)} alt={book.title} className="h-20 w-14 rounded object-cover" />
              ) : (
                <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-stone-800 text-[10px] text-stone-500">Sem capa</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
                  {entry.status === 'reading' || entry.status === 'rereading' ? <ChapterBadge chapter={chapterFromPercent(book, entry.progress)} /> : null}
                </div>
                <p className="mb-2 text-xs text-stone-500">{book.author}{entry.status === 'reading' || entry.status === 'rereading' ? ` · Cap. ${chapterFromPercent(book, entry.progress)}` : ''}</p>
                {canRateStatus(entry.status) && (
                  <p className="text-xs font-bold text-stone-300">
                    <span className="text-amber-300">{ratingText(entry.rating)}</span>
                    {' · '}
                    <span className="text-red-300">{ratingText(entry.spiceRating, 'pimentas')}</span>
                  </p>
                )}
              </div>
            </button>
          )) : <EmptyState text={`Nenhum livro em ${STATUS_LABELS[shelfFilter]}.`} />}
        </div>
      </div>
    </section>
  )
}
function ProfileListPage({ kind, currentUser, profileUser, users, books, shelf, posts, replies, onBack, onBookClick, onUserClick, onToggleFollow, onAddReply, onToggleLike, onToggleReplyLike, onDeletePost, onDeleteReply }: {
  kind: ProfileListKind
  currentUser: User
  profileUser: User
  users: User[]
  books: Book[]
  shelf: ShelfEntry[]
  posts: Post[]
  replies: Reply[]
  onBack: () => void
  onBookClick: (id: string) => void
  onUserClick: (userId: string) => void
  onToggleFollow: (userId: string) => Promise<boolean | void> | boolean | void
  onAddReply: (postId: string, text: string, parentReplyId?: string) => Promise<boolean | void> | boolean | void
  onToggleLike: (postId: string) => Promise<boolean | void> | boolean | void
  onToggleReplyLike: (replyId: string) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onDeleteReply: (replyId: string) => Promise<boolean | void> | boolean | void
}) {
  const titleByKind: Record<ProfileListKind, string> = {
    following: 'Seguindo',
    followers: 'Seguidores',
    posts: 'Posts',
  }
  const relationIds = kind === 'following' ? profileUser.following : profileUser.followers
  const relationUsers = relationIds.map(id => users.find(user => user.id === id)).filter((user): user is User => Boolean(user))
  const profilePosts = posts
    .filter(post => post.userId === profileUser.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <section>
      <Header title={titleByKind[kind]}>
        <button onClick={onBack} className="w-fit rounded-lg border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-300 hover:bg-stone-900">
          Voltar ao perfil
        </button>
      </Header>

      {kind === 'posts' ? (
        profilePosts.length ? (
          <PaginatedPostList
            posts={profilePosts}
            resetKey={`profile-posts-${profileUser.id}`}
            renderPost={post => (
              <PostCard
                key={post.id}
                post={post}
                users={users}
                books={books}
                shelf={shelf}
                currentUser={currentUser}
                replies={replies}
                onBookClick={onBookClick}
                onUserClick={onUserClick}
                onAddReply={onAddReply}
                onToggleLike={onToggleLike}
                onToggleReplyLike={onToggleReplyLike}
                onDeletePost={onDeletePost}
                onDeleteReply={onDeleteReply}
                protectSpoilers
              />
            )}
          />
        ) : (
          <EmptyState text="Nenhuma publicacao ainda." />
        )
      ) : (
        <div className="divide-y divide-stone-800">
          {relationUsers.length ? relationUsers.map(user => {
            const following = currentUser.following.includes(user.id)
            const isCurrentUser = currentUser.id === user.id

            return (
              <div key={user.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <button onClick={() => onUserClick(user.id)}>
                  <Avatar user={user} />
                </button>
                <button onClick={() => onUserClick(user.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-bold text-stone-100">{user.name}</p>
                  <p className="truncate text-xs text-stone-500">@{user.handle}</p>
                  {user.bio && <p className="mt-1 line-clamp-2 text-xs text-stone-400">{user.bio}</p>}
                </button>
                {!isCurrentUser && (
                  <button onClick={() => onToggleFollow(user.id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${following ? 'bg-stone-800 text-stone-300' : 'bg-amber-300 text-stone-950'}`}>
                    {following ? 'Seguindo' : 'Seguir'}
                  </button>
                )}
              </div>
            )
          }) : <EmptyState text="Nada por aqui ainda." />}
        </div>
      )}
    </section>
  )
}

function NotificationsPage({ notifications, users, books, showDeviceNotificationControls, deviceNotificationStatus, remotePushRegistered, onEnableDeviceNotifications, onTestDeviceNotification, onBookClick, onUserClick }: {
  notifications: FolioNotification[]
  users: User[]
  books: Book[]
  showDeviceNotificationControls: boolean
  deviceNotificationStatus: DeviceNotificationStatus
  remotePushRegistered: boolean
  onEnableDeviceNotifications: () => void
  onTestDeviceNotification: () => void
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
}) {
  return (
    <section>
      <Header title="Notificações">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-500">Novos seguidores, curtidas, respostas e comentários liberados pelo seu capítulo aparecem aqui.</p>
          {showDeviceNotificationControls && (deviceNotificationStatus === 'default' || (deviceNotificationStatus === 'granted' && !remotePushRegistered)) && (
            <button
              type="button"
              onClick={onEnableDeviceNotifications}
              className="w-full shrink-0 rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950 transition hover:bg-amber-200 sm:w-auto"
            >
              {deviceNotificationStatus === 'granted' ? 'Conectar ao servidor' : 'Ativar no celular'}
            </button>
          )}
          {showDeviceNotificationControls && deviceNotificationStatus === 'granted' && remotePushRegistered && (
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <span className="flex-1 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-center text-sm font-bold text-emerald-700 sm:flex-none">
                Conectadas
              </span>
              <button
                type="button"
                onClick={onTestDeviceNotification}
                className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm font-bold text-stone-200 transition hover:bg-stone-800 hover:text-stone-100"
              >
                Testar
              </button>
            </div>
          )}
          {showDeviceNotificationControls && deviceNotificationStatus === 'denied' && (
            <span className="w-full shrink-0 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-center text-sm font-bold text-red-300 sm:w-auto">
              Bloqueadas no navegador
            </span>
          )}
          {showDeviceNotificationControls && deviceNotificationStatus === 'unsupported' && (
            <span className="w-full shrink-0 rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-center text-sm font-bold text-stone-500 sm:w-auto">
              Indisponível neste navegador
            </span>
          )}
        </div>
      </Header>
      {notifications.length ? (
        <div>
          {notifications.map(notification => {
            const user = users.find(item => item.id === notification.userId)
            const book = notification.bookId ? books.find(item => item.id === notification.bookId) : null
            if (!user) return null
            const textByType: Record<FolioNotification['type'], string> = {
              follow: 'começou a seguir você',
              like: 'curtiu sua publicação',
              reply: 'comentou na sua publicação',
              reply_like: 'curtiu seu comentário',
              reply_reply: 'respondeu seu comentário',
              book_comment: 'comentou no livro que você está lendo',
            }
            return (
              <article key={notification.id} className={`border-b border-stone-800 px-4 py-4 md:px-5 ${notification.read ? 'opacity-70' : ''}`}>
                <div className="flex gap-3">
                  <button onClick={() => onUserClick(user.id)}><Avatar user={user} size="sm" /></button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-300">
                      <button onClick={() => onUserClick(user.id)} className="font-bold text-stone-100 hover:text-amber-300">{user.name}</button>{' '}
                      {textByType[notification.type]}
                      {book && (
                        <>
                          {' em '}
                          <button onClick={() => onBookClick(book.id)} className="font-bold text-amber-300">{book.title}</button>
                        </>
                      )}
                      {notification.chapter ? <span className="text-stone-500"> · cap. {notification.chapter}</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-stone-600">{formatTime(notification.timestamp)}</p>
                  </div>
                  {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-300" />}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState text="Quando houver interações novas, você verá tudo aqui." />
      )}
    </section>
  )
}
function GoalsPage({ currentUser, shelf, books, readingGoal, onUpdateReadingGoal, onToggleReadingCheckIn }: {
  currentUser: User
  shelf: ShelfEntry[]
  books: Book[]
  readingGoal: ReadingGoal
  onUpdateReadingGoal: (changes: { targetBooks?: number; targetDays?: number }) => Promise<boolean | void> | boolean | void
  onToggleReadingCheckIn: () => Promise<boolean | void> | boolean | void
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(readingGoal.targetBooks || 40))
  const [editingDays, setEditingDays] = useState(false)
  const [dayInputVal, setDayInputVal] = useState(String(readingGoal.targetDays || 120))
  const myShelf = shelf.filter(entry => entry.userId === currentUser.id)
  const goalYear = readingGoal.year || new Date().getFullYear()
  const readThisYear = readingGoal.booksReadThisYear ?? myShelf.filter(entry => entry.status === 'read' && isDateInYear(entry.endDate, goalYear)).length
  const progress = Math.min(100, Math.round((readThisYear / Math.max(1, readingGoal.targetBooks)) * 100))
  const remaining = Math.max(0, readingGoal.targetBooks - readThisYear)
  const dayProgress = Math.min(100, Math.round((readingGoal.checkIns.length / Math.max(1, readingGoal.targetDays)) * 100))
  const remainingDays = Math.max(0, readingGoal.targetDays - readingGoal.checkIns.length)
  const currentlyReading = myShelf
    .filter(entry => entry.status === 'reading' || entry.status === 'rereading')
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)
  const recentDays = Array.from({ length: 14 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (13 - index))
    const key = localDateKey(date)
    return {
      key,
      label: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      checked: readingGoal.checkIns.includes(key),
    }
  })

  return (
    <section>
      <Header title="Metas de leitura" />
      <div className="space-y-4 p-4 md:p-5">
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-stone-100">Meta anual</h2>
              <p className="text-sm text-stone-500">Conta livros concluídos em {goalYear}.</p>
            </div>
            {editing ? (
              <div className="flex gap-2">
                <input value={inputVal} onChange={e => setInputVal(e.target.value)} type="number" className="w-20 rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-center text-sm text-stone-100 outline-none focus:border-amber-300" />
                <button onClick={async () => {
                  const targetBooks = clamp(Number(inputVal), 1, 999)
                  const saved = await onUpdateReadingGoal({ targetBooks })
                  if (saved === false) return
                  setInputVal(String(targetBooks))
                  setEditing(false)
                }} className="rounded-lg bg-amber-300 px-3 text-sm font-bold text-stone-950">
                  OK
                </button>
              </div>
            ) : (
              <button onClick={() => {
                setInputVal(String(readingGoal.targetBooks))
                setEditing(true)
              }} className="text-sm font-bold text-amber-300">Editar</button>
            )}
          </div>
          <div className="mb-4 flex items-end gap-3">
            <span className="font-serif text-6xl leading-none text-amber-300">{readThisYear}</span>
            <span className="pb-2 text-sm text-stone-400">de {readingGoal.targetBooks} livros</span>
          </div>
          <ProgressBar value={progress} />
          <div className="mt-2 flex justify-between text-xs text-stone-500">
            <span>{progress}% concluído</span>
            <span>{remaining} restantes</span>
          </div>
        </div>

        <div className="rounded-lg border border-stone-800 bg-stone-900 p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-stone-100">Meta de dias de leitura</h2>
              <p className="text-sm text-stone-500">Faça check-in nos dias em que leu para acompanhar sua sequência.</p>
            </div>
            {editingDays ? (
              <div className="flex gap-2">
                <input value={dayInputVal} onChange={e => setDayInputVal(e.target.value)} type="number" className="w-20 rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-center text-sm text-stone-100 outline-none focus:border-amber-300" />
                <button onClick={async () => {
                  const targetDays = clamp(Number(dayInputVal), 1, 366)
                  const saved = await onUpdateReadingGoal({ targetDays })
                  if (saved === false) return
                  setDayInputVal(String(targetDays))
                  setEditingDays(false)
                }} className="rounded-lg bg-amber-300 px-3 text-sm font-bold text-stone-950">
                  OK
                </button>
              </div>
            ) : (
              <button onClick={() => {
                setDayInputVal(String(readingGoal.targetDays))
                setEditingDays(true)
              }} className="text-sm font-bold text-amber-300">Editar</button>
            )}
          </div>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <span className="font-serif text-6xl leading-none text-amber-300">{readingGoal.checkIns.length}</span>
            <span className="pb-2 text-sm text-stone-400">de {readingGoal.targetDays} dias</span>
            <button
              onClick={() => onToggleReadingCheckIn()}
              className={`ml-auto rounded-lg px-4 py-2 text-sm font-bold ${readingGoal.checkedInToday ? 'border border-amber-300/40 text-amber-200 hover:bg-amber-300/10' : 'bg-amber-300 text-stone-950 hover:bg-amber-200'}`}
            >
              {readingGoal.checkedInToday ? 'Desfazer check-in' : 'Check-in de hoje'}
            </button>
          </div>
          <ProgressBar value={dayProgress} />
          <div className="mt-2 flex justify-between text-xs text-stone-500">
            <span>{dayProgress}% concluído</span>
            <span>{remainingDays} restantes</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-stone-950 p-3">
              <div className="font-serif text-2xl text-stone-100">{readingGoal.currentStreak}</div>
              <div className="text-xs text-stone-500">dias seguidos</div>
            </div>
            <div className="rounded-lg bg-stone-950 p-3">
              <div className="font-serif text-2xl text-stone-100">{readingGoal.bestStreak}</div>
              <div className="text-xs text-stone-500">maior sequência</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {recentDays.map(day => (
              <div key={day.key} className={`rounded-lg border px-1 py-2 text-center text-[10px] font-bold ${day.checked ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-800 bg-stone-950 text-stone-500'}`}>
                {day.label}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            ['Páginas lidas', currentUser.pagesRead.toLocaleString('pt-BR')],
            ['Média por livro', Math.round(currentUser.pagesRead / Math.max(1, currentUser.booksRead))],
            ['Livros na estante', myShelf.length],
            ['Lendo agora', currentlyReading.length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-stone-800 bg-stone-900 p-4">
              <div className="font-serif text-2xl text-stone-100">{value}</div>
              <div className="text-xs text-stone-500">{label}</div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-3 font-serif text-lg text-stone-100">Lendo agora</h3>
          <div className="space-y-3">
            {currentlyReading.map(({ entry, book }) => (
              <div key={book.id} className="flex gap-3 rounded-lg border border-stone-800 bg-stone-900 p-3">
                <img src={resolveMediaUrl(book.cover)} alt={book.title} className="h-16 w-11 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
                  <p className="mb-2 text-xs text-stone-500">{book.author}</p>
                  <p className="text-xs text-stone-500">Cap. {chapterFromPercent(book, entry.progress)}</p>
                </div>
                <span className="text-sm font-bold text-amber-300">Cap. {chapterFromPercent(book, entry.progress)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CreatePostModal({ currentUser, shelf, books, onClose, onPost, onUploadImage }: {
  currentUser: User
  shelf: ShelfEntry[]
  books: Book[]
  onClose: () => void
  onPost: (post: Post) => Promise<boolean | void> | boolean | void
  onUploadImage: (file: File) => Promise<string>
}) {
  const myBooks = shelf
    .filter(entry => entry.userId === currentUser.id && canPostWithStatus(entry.status))
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)
    .sort((a, b) => a.book.title.localeCompare(b.book.title, 'pt-BR'))
  const [selectedBookId, setSelectedBookId] = useState(myBooks[0]?.book.id || '')
  const [bookQuery, setBookQuery] = useState('')
  const selectedBook = books.find(book => book.id === selectedBookId) || myBooks[0]?.book
  const selectedEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === selectedBookId)
  const defaultPercent = selectedEntry?.status === 'read' ? 100 : selectedEntry?.progress ?? 0
  const [postType, setPostType] = useState<PostType>('comment')
  const [text, setText] = useState('')
  const [reactionEmoji, setReactionEmoji] = useState('🤯')
  const [chapter, setChapter] = useState(selectedBook ? String(chapterFromPercent(selectedBook, defaultPercent)) : '1')
  const [postImageUrl, setPostImageUrl] = useState('')
  const [postImageFileName, setPostImageFileName] = useState('')
  const [postImageError, setPostImageError] = useState('')
  const [uploadingPostImage, setUploadingPostImage] = useState(false)
  const emojis = ['😭', '🤯', '♥', '😂', '😡', '🔥', '💔', '😱', '🥹', '👏']
  const canPost = selectedBook && chapter !== '' && !uploadingPostImage && (postType === 'reaction' ? Boolean(reactionEmoji) : text.trim().length > 0 || Boolean(postImageUrl))
  const filteredBooks = myBooks
    .filter(({ book }) => !bookQuery.trim() || bookMatchesSearch(book, bookQuery, 'title') || bookMatchesSearch(book, bookQuery, 'author'))
    .slice(0, 8)

  function handleBookChange(bookId: string) {
    const nextBook = books.find(book => book.id === bookId)
    const nextEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === bookId)
    const nextPercent = nextEntry?.status === 'read' ? 100 : nextEntry?.progress ?? 0
    setSelectedBookId(bookId)
    setChapter(nextBook ? String(chapterFromPercent(nextBook, nextPercent)) : '1')
  }

  function handleChapterChange(value: string) {
    if (!selectedBook) return
    if (value === '') {
      setChapter('')
      return
    }
    const next = clamp(Number(value), 1, selectedBook.totalChapters)
    setChapter(String(next))
  }

  async function handlePost() {
    if (!canPost || !selectedBook) return
    const selectedChapter = clamp(Number(chapter), 1, selectedBook.totalChapters)
    const percent = percentFromChapter(selectedBook, selectedChapter)
    const postText = textWithPostImage(postType === 'reaction' ? '' : text, postImageUrl)
    const posted = await onPost({
      id: `p${Date.now()}`,
      userId: currentUser.id,
      bookId: selectedBook.id,
      chapter: selectedChapter,
      percent,
      text: postText || undefined,
      reactionEmoji: postType === 'reaction' ? reactionEmoji : undefined,
      type: postType,
      timestamp: new Date().toISOString(),
      likes: [],
      comments: 0,
    })
    if (posted === false) return
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center" onClick={e => e.currentTarget === e.target && onClose()}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-stone-800 bg-stone-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-800 bg-stone-900 px-4 py-3">
          <h2 className="font-serif text-lg text-stone-100">Nova publicação</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-stone-500 hover:bg-stone-800 hover:text-stone-100">×</button>
        </div>

        <div className="space-y-4 p-4">
          {!myBooks.length ? (
            <p className="rounded-lg border border-stone-800 bg-stone-950 p-4 text-sm text-stone-400">Adicione um livro como Lendo, Relendo, Lido ou Abandonei para publicar no feed da obra.</p>
          ) : (
            <>
              <label className="block text-sm font-semibold text-stone-300">
                Livro
                <input
                  value={bookQuery}
                  onChange={e => setBookQuery(e.target.value)}
                  placeholder="Buscar por título ou autor"
                  className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-300"
                />
              </label>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-stone-800 bg-stone-950 p-2">
                {filteredBooks.map(({ entry, book }) => {
                  const active = book.id === selectedBookId
                  return (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => handleBookChange(book.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${active ? 'border-amber-300 bg-amber-300/10 text-amber-200' : 'border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-700 hover:bg-stone-800'}`}
                    >
                      <img src={resolveMediaUrl(book.cover)} alt={book.title} className="h-10 w-7 shrink-0 rounded object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{book.title}</span>
                        <span className="block truncate text-xs text-stone-500">{book.author} · {STATUS_LABELS[entry.status]}</span>
                      </span>
                      {active && <span className="text-sm font-bold text-amber-300">✓</span>}
                    </button>
                  )
                })}
                {!filteredBooks.length && <p className="px-3 py-4 text-center text-sm text-stone-500">Nenhum livro encontrado na sua estante.</p>}
              </div>

              {selectedBook && (
                <div>
                  <label className="text-sm font-semibold text-stone-300">
                    Capítulo
                    <input type="number" min="1" max={selectedBook.totalChapters} value={chapter} onChange={e => handleChapterChange(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-300" />
                  </label>
                </div>
              )}

              <div className="grid grid-cols-3 rounded-lg bg-stone-950 p-1">
                {([['comment', 'Comentário'], ['reaction', 'Reação'], ['theory', 'Teoria']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setPostType(id)} className={`rounded-md px-2 py-2 text-xs font-bold ${postType === id ? 'bg-amber-300 text-stone-950' : 'text-stone-400'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {postType === 'reaction' ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-stone-300">Reação rápida</p>
                  <div className="grid grid-cols-5 gap-2">
                    {emojis.map(emoji => (
                      <button key={emoji} onClick={() => setReactionEmoji(emoji)} className={`min-h-12 rounded-lg border text-2xl ${reactionEmoji === emoji ? 'border-amber-300 bg-amber-300/10' : 'border-stone-700 bg-stone-950'}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <label className="block text-sm font-semibold text-stone-300">
                  {postType === 'theory' ? 'Sua teoria' : 'Comentário'}
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    rows={4}
                    placeholder={postType === 'theory' ? 'Ex.: acho que essa personagem ainda sabe mais do que contou...' : 'Escreva livremente. Quem estiver atrás desse ponto não verá agora.'}
                    className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-300"
                  />
                </label>
              )}

              <div className="rounded-lg border border-stone-800 bg-stone-950 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-stone-300">Imagem</p>
                    <p className="text-xs text-stone-500">{postImageFileName || 'Nenhuma imagem selecionada'}</p>
                  </div>
                  <div className="flex gap-2">
                    {postImageUrl && (
                      <button
                        onClick={() => {
                          setPostImageUrl('')
                          setPostImageFileName('')
                          setPostImageError('')
                        }}
                        className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/10"
                      >
                        Remover
                      </button>
                    )}
                    <label className="inline-flex cursor-pointer rounded-lg border border-stone-700 px-3 py-2 text-xs font-bold text-stone-300 hover:bg-stone-800">
                      {uploadingPostImage ? 'Enviando...' : 'Anexar'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingPostImage}
                        onChange={async e => {
                          const file = e.target.files?.[0]
                          e.currentTarget.value = ''
                          if (!file) return
                          setUploadingPostImage(true)
                          setPostImageError('')
                          try {
                            const imageUrl = await onUploadImage(file)
                            setPostImageUrl(imageUrl)
                            setPostImageFileName(file.name)
                          } catch {
                            setPostImageError('Nao foi possivel enviar a imagem agora.')
                          } finally {
                            setUploadingPostImage(false)
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
                {postImageUrl && (
                  <img src={resolveMediaUrl(postImageUrl)} alt="Prévia da imagem" className="mt-3 max-h-72 w-full rounded-lg object-cover" />
                )}
                {postImageError && <p className="mt-2 text-xs font-semibold text-red-300">{postImageError}</p>}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-800 px-4 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold text-stone-400 hover:bg-stone-800">Cancelar</button>
          <button onClick={handlePost} disabled={!canPost} className="rounded-lg bg-amber-300 px-5 py-2 text-sm font-bold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-500">
            {uploadingPostImage ? 'Enviando...' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RightPanel({ currentUser, users, shelf, books, onBookClick, onUserClick, onToggleFollow }: {
  currentUser: User
  users: User[]
  shelf: ShelfEntry[]
  books: Book[]
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
  onToggleFollow: (userId: string) => Promise<boolean | void> | boolean | void
}) {
  const [readerQuery, setReaderQuery] = useState('')
  const currentlyReading = shelf
    .filter(entry => entry.userId === currentUser.id && entry.status === 'reading')
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)
  const suggestions = users
    .filter(user => user.id !== currentUser.id)
    .filter(user => readerQuery ? readerMatchesSearch(user, readerQuery) : !currentUser.following.includes(user.id))
    .slice(0, 4)

  return (
    <aside className="sticky top-3 space-y-3">
      <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
        <h2 className="mb-2 font-serif text-base text-stone-100">Buscar leitores</h2>
        <input
          value={readerQuery}
          onChange={e => setReaderQuery(e.target.value)}
          placeholder="Pesquisar @ ou nome"
          className="mb-3 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
        />
        <div className="space-y-2.5">
          {suggestions.map(user => {
            const following = currentUser.following.includes(user.id)
            return (
              <div key={user.id} className="flex items-center gap-3">
                <button onClick={() => onUserClick(user.id)}><Avatar user={user} size="sm" /></button>
                <div className="min-w-0 flex-1">
                  <button onClick={() => onUserClick(user.id)} className="block max-w-full truncate text-sm font-bold text-stone-100 hover:text-amber-300">{user.name}</button>
                  <button onClick={() => onUserClick(user.id)} className="text-xs text-stone-500 hover:text-stone-300">@{user.handle}</button>
                </div>
                <button onClick={() => onToggleFollow(user.id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${following ? 'bg-stone-800 text-stone-300' : 'bg-amber-300 text-stone-950'}`}>
                  {following ? 'Seguindo' : 'Seguir'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
      <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
        <h2 className="mb-2 font-serif text-base text-stone-100">Proteção ativa</h2>
        <p className="text-sm leading-relaxed text-stone-400">
          Nos feeds de obra, comentários são liberados por capítulo para reduzir spoilers.
        </p>
      </div>
      {currentlyReading.length > 0 && (
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
          <h2 className="mb-2 font-serif text-base text-stone-100">Lendo agora</h2>
          <div className="space-y-3">
            {currentlyReading.map(({ entry, book }) => (
              <button key={book.id} onClick={() => onBookClick(book.id)} className="flex w-full gap-3 text-left">
                <img src={resolveMediaUrl(book.cover)} alt={book.title} className="h-14 w-10 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
                  <p className="mb-1 text-xs text-stone-500">Cap. {chapterFromPercent(book, entry.progress)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-800">
      <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${clamp(value, 0, 100)}%` }} />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-6 py-14 text-center text-sm text-stone-500">{text}</div>
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-[calc(max(env(safe-area-inset-bottom),0px)+5.75rem)] left-3 right-3 z-[70] grid gap-2 md:bottom-5 md:left-auto md:right-5 md:w-96">
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-2xl shadow-black/40 ${
            toast.type === 'success'
              ? 'border-emerald-300/30 bg-emerald-950/95 text-emerald-50'
              : 'border-red-300/30 bg-red-950/95 text-red-50'
          }`}
        >
          <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${toast.type === 'success' ? 'bg-emerald-300' : 'bg-red-300'}`} />
          <p className="min-w-0 flex-1 leading-relaxed">{toast.text}</p>
          <button onClick={() => onDismiss(toast.id)} className="shrink-0 rounded px-1 text-base leading-none opacity-70 hover:opacity-100" aria-label="Fechar aviso">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function ActionLoadingIndicator({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <div className="fixed left-1/2 top-3 z-[80] -translate-x-1/2 rounded-full border border-amber-300/30 bg-stone-950/95 px-4 py-2 text-sm font-bold text-amber-100 shadow-2xl shadow-black/40 backdrop-blur">
      <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent align-[-1px]" />
      Atualizando...
    </div>
  )
}

function storedPage() {
  const params = new URLSearchParams(window.location.search)
  const value = params.get('page') || localStorage.getItem('folio_page')
  return ['timeline', 'shelf', 'library', 'book', 'profile', 'profile-list', 'goals', 'notifications'].includes(value || '') ? value as Page : 'timeline'
}

function storedColorTheme(): ColorTheme {
  const theme = localStorage.getItem('folio_theme') === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  return theme
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('folio_token') || '')
  const [users, setUsers] = useState<User[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [theme, setTheme] = useState<ColorTheme>(() => storedColorTheme())
  const [page, setPage] = useState<Page>(() => storedPage())
  const [selectedBookId, setSelectedBookId] = useState<string | null>(() => localStorage.getItem('folio_selected_book_id'))
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(() => localStorage.getItem('folio_selected_profile_user_id'))
  const [profileListKind, setProfileListKind] = useState<ProfileListKind>('following')
  const [showPostModal, setShowPostModal] = useState(false)
  const [shelf, setShelf] = useState<ShelfEntry[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [replies, setReplies] = useState<Reply[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [notifications, setNotifications] = useState<FolioNotification[]>([])
  const [readingGoal, setReadingGoal] = useState<ReadingGoal>({ targetBooks: 40, targetDays: 120, checkIns: [], currentStreak: 0, bestStreak: 0, checkedInToday: false })
  const [loadingApp, setLoadingApp] = useState(Boolean(token))
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [actionLoadingCount, setActionLoadingCount] = useState(0)
  const [deviceNotifications, setDeviceNotifications] = useState<DeviceNotificationStatus>(() => deviceNotificationStatus())
  const [remotePushRegistered, setRemotePushRegistered] = useState(false)
  const notifiedDeviceNotificationIds = useRef<Set<string>>(new Set())
  const notifiedDeviceNotificationUserId = useRef<string | null>(null)
  const { askDate, datePromptDialog } = useDatePrompt()
  const canUseDeviceNotifications = currentUser?.role === 'admin'

  function dismissToast(id: number) {
    setToasts(current => current.filter(toast => toast.id !== id))
  }

  function showToast(type: ToastMessage['type'], text: string) {
    const id = Date.now() + Math.random()
    setToasts(current => [...current.slice(-2), { id, type, text }])
    window.setTimeout(() => dismissToast(id), 3800)
  }

  function beginActionLoading() {
    setActionLoadingCount(count => count + 1)
  }

  function endActionLoading() {
    setActionLoadingCount(count => Math.max(0, count - 1))
  }

  function handleToggleTheme() {
    setTheme(current => current === 'dark' ? 'light' : 'dark')
  }

  async function handleEnableDeviceNotifications() {
    if (deviceNotificationStatus() === 'unsupported') {
      setDeviceNotifications('unsupported')
      showToast('error', 'Este navegador ainda nao permite notificações do app.')
      return
    }

    await registerDeviceNotificationWorker()
    const permission = await Notification.requestPermission()
    setDeviceNotifications(permission)

    if (permission === 'granted') {
      const pushResult = await saveDevicePushSubscription(token)
      if (pushResult === 'saved') {
        setRemotePushRegistered(true)
        showToast('success', 'Notificações ativadas neste dispositivo.')
        return
      }
      if (pushResult === 'missing-key') {
        showToast('error', 'O servidor ainda precisa da chave Web Push para enviar notificações.')
        return
      }

      showToast('error', 'Este navegador ainda nao permite push do app.')
      return
    }

    showToast('error', 'As notificações ficaram bloqueadas neste navegador.')
  }

  async function handleTestDeviceNotification() {
    return runAction(async () => {
      await apiRequest('/folio/notifications/push-test', { method: 'POST' }, token)
    }, {
      success: 'Notificação de teste enviada.',
      error: 'Nao foi possivel enviar o teste de notificação.',
    })
  }

  async function runAction(action: () => Promise<void>, feedback: ActionFeedback) {
    beginActionLoading()
    try {
      await action()
      if (!feedback.silentSuccess && feedback.success) showToast('success', feedback.success)
      return true
    } catch (error) {
      showToast('error', errorMessage(error, feedback.error))
      return false
    } finally {
      endActionLoading()
    }
  }

  async function loadBootstrap(activeToken = token) {
    if (!activeToken) return
    const data = await apiRequest<{
      currentUserId: string
      users: User[]
      books: Book[]
      shelf: ShelfEntry[]
      posts: Post[]
      replies: Reply[]
      timeline: TimelineEvent[]
      notifications?: FolioNotification[]
      readingGoal?: ReadingGoal
    }>('/folio/bootstrap', {}, activeToken)

    setUsers(data.users)
    setBooks(data.books)
    setShelf(data.shelf)
    setPosts(data.posts)
    setReplies(data.replies)
    setTimeline(data.timeline || [])
    setNotifications(data.notifications || [])
    setReadingGoal(data.readingGoal || { targetBooks: 40, targetDays: 120, checkIns: [], currentStreak: 0, bestStreak: 0, checkedInToday: false })
    setCurrentUser(data.users.find(user => user.id === data.currentUserId) || data.users[0] || null)
    setLoadingApp(false)
  }

  useEffect(() => {
    if (!token) return
    loadBootstrap(token).catch(() => {
      localStorage.removeItem('folio_token')
      setToken('')
      setCurrentUser(null)
      setLoadingApp(false)
    })
  }, [])

  useEffect(() => {
    registerDeviceNotificationWorker().catch(() => {
      // The permission UI still reflects browser support; worker registration is retried on demand.
    })
  }, [])

  useEffect(() => {
    const syncDeviceNotificationStatus = () => {
      setDeviceNotifications(deviceNotificationStatus())
    }

    window.addEventListener('focus', syncDeviceNotificationStatus)
    document.addEventListener('visibilitychange', syncDeviceNotificationStatus)

    return () => {
      window.removeEventListener('focus', syncDeviceNotificationStatus)
      document.removeEventListener('visibilitychange', syncDeviceNotificationStatus)
    }
  }, [])

  useEffect(() => {
    if (!currentUser || !canUseDeviceNotifications || deviceNotifications !== 'granted') {
      setRemotePushRegistered(false)
      return
    }

    let active = true
    registerDeviceNotificationWorker()
      .then(registration => registration?.pushManager.getSubscription())
      .then(async subscription => {
        if (!subscription) return false
        await apiRequest('/folio/notifications/push-subscriptions', {
          method: 'POST',
          body: JSON.stringify(subscription.toJSON()),
        }, token)
        return true
      })
      .then(saved => {
        if (active) setRemotePushRegistered(saved)
      })
      .catch(() => {
        if (active) setRemotePushRegistered(false)
      })

    return () => {
      active = false
    }
  }, [currentUser?.id, canUseDeviceNotifications, deviceNotifications, token])

  useEffect(() => {
    if (!currentUser) {
      notifiedDeviceNotificationUserId.current = null
      notifiedDeviceNotificationIds.current = new Set()
      return
    }

    if (notifiedDeviceNotificationUserId.current !== currentUser.id) {
      const knownIds = storedDeviceNotificationIds(currentUser.id)
      notifications.forEach(notification => knownIds.add(notification.id))
      notifiedDeviceNotificationIds.current = knownIds
      notifiedDeviceNotificationUserId.current = currentUser.id
      saveDeviceNotificationIds(currentUser.id, knownIds)
      return
    }

    if (deviceNotifications !== 'granted' || remotePushRegistered) return

    const freshUnreadNotifications = notifications
      .filter(notification => !notification.read && !notifiedDeviceNotificationIds.current.has(notification.id))
      .sort(newestFirst)

    if (!freshUnreadNotifications.length) return

    freshUnreadNotifications.forEach(notification => notifiedDeviceNotificationIds.current.add(notification.id))
    saveDeviceNotificationIds(currentUser.id, notifiedDeviceNotificationIds.current)
    freshUnreadNotifications.slice(0, 3).forEach(notification => {
      showDeviceNotification(notification, users, books).catch(() => {
        // Device notifications are best-effort; the in-app notification list remains authoritative.
      })
    })
  }, [currentUser?.id, notifications, users, books, deviceNotifications, remotePushRegistered])

  useEffect(() => {
    if (!token || !currentUser) return

    let active = true
    let refreshing = false

    const refreshInBackground = async () => {
      const canRefreshWhileHidden = deviceNotificationStatus() === 'granted'
      if (!active || refreshing || (document.hidden && !canRefreshWhileHidden)) return
      refreshing = true
      try {
        await loadBootstrap(token)
      } catch {
        // Background sync is best-effort; explicit user actions still show errors.
      } finally {
        refreshing = false
      }
    }

    const intervalId = window.setInterval(refreshInBackground, BACKGROUND_REFRESH_INTERVAL_MS)
    const handleFocus = () => {
      void refreshInBackground()
    }
    const handleVisibilityChange = () => {
      if (!document.hidden) void refreshInBackground()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [token, currentUser?.id, deviceNotifications])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('folio_theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('folio_page', page)
  }, [page])

  useEffect(() => {
    if (selectedBookId) localStorage.setItem('folio_selected_book_id', selectedBookId)
    else localStorage.removeItem('folio_selected_book_id')
  }, [selectedBookId])

  useEffect(() => {
    if (selectedProfileUserId) localStorage.setItem('folio_selected_profile_user_id', selectedProfileUserId)
    else localStorage.removeItem('folio_selected_profile_user_id')
  }, [selectedProfileUserId])

  useEffect(() => {
    if (page === 'book' && selectedBookId && books.length && !books.some(book => book.id === selectedBookId)) {
      setSelectedBookId(null)
      setPage('timeline')
    }
  }, [page, selectedBookId, books])

  async function handleLogin(name: string, email: string, password: string, mode: 'login' | 'register') {
    const auth = await apiRequest<{ token: string }>('/auth/' + mode, {
      method: 'POST',
      body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password }),
    })
    localStorage.setItem('folio_token', auth.token)
    setToken(auth.token)
    setLoadingApp(true)
    await loadBootstrap(auth.token)
  }

  function handleBookClick(bookId: string) {
    setSelectedBookId(bookId)
    setPage('book')
  }

  function handleUserClick(userId: string) {
    setSelectedProfileUserId(userId)
    setSelectedBookId(null)
    setPage('profile')
  }

  function handleOpenProfileList(kind: ProfileListKind) {
    setProfileListKind(kind)
    setSelectedBookId(null)
    setPage('profile-list')
  }

  async function handleNavigate(nextPage: Page) {
    setPage(nextPage)
    if (nextPage !== 'book') setSelectedBookId(null)
    if (nextPage === 'profile') setSelectedProfileUserId(currentUser?.id || null)
    if (nextPage === 'notifications') {
      await apiRequest('/folio/notifications/mark-all-read', { method: 'POST' }, token)
      await loadBootstrap()
    }
  }

  async function handleUpdateShelfEntry(bookId: string, changes: Partial<ShelfEntry>, feedback?: ActionFeedback) {
    if (!currentUser) return false
    return runAction(async () => {
      await apiRequest(`/folio/shelf/${encodeURIComponent(bookId)}`, { method: 'PATCH', body: JSON.stringify(changes) }, token)
      await loadBootstrap()
    }, feedback || {
      error: 'Nao foi possivel atualizar a estante.',
      silentSuccess: true,
    })
  }

  async function handleRemoveShelfEntry(bookId: string) {
    if (!currentUser) return false
    return runAction(async () => {
      await apiRequest(`/folio/shelf/${encodeURIComponent(bookId)}`, { method: 'DELETE' }, token)
      await loadBootstrap()
    }, {
      success: 'Livro removido da estante.',
      error: 'Nao foi possivel remover este livro da estante.',
    })
  }

  async function handleAddBook(bookId: string, status: BookStatus) {
    if (!currentUser) return false
    const dateChanges = await datesForShelfStatus(status, undefined, askDate)
    if (!dateChanges) return false
    return runAction(async () => {
      await apiRequest('/folio/shelf', { method: 'POST', body: JSON.stringify({ bookId, status, progress: status === 'read' ? 100 : 0, ...dateChanges }) }, token)
      await loadBootstrap()
    }, {
      success: 'Livro adicionado à estante.',
      error: 'Nao foi possivel adicionar este livro à estante.',
    })
  }

  async function handleSaveBook(book: Book) {
    return runAction(async () => {
      await apiRequest('/folio/books', {
        method: 'POST',
        body: JSON.stringify({
          ...book,
          rating: book.rating,
        }),
      }, token)
      await loadBootstrap()
    }, {
      success: 'Livro salvo com sucesso.',
      error: 'Nao foi possivel salvar este livro.',
    })
  }

  async function handleSetBookActive(bookId: string, active: boolean) {
    return runAction(async () => {
      await apiRequest(`/folio/books/${encodeURIComponent(bookId)}/${active ? 'active' : 'inactive'}`, { method: 'PATCH' }, token)
      await loadBootstrap()
    }, {
      success: active ? 'Livro reativado com sucesso.' : 'Livro inativado com sucesso.',
      error: active ? 'Nao foi possivel reativar este livro.' : 'Nao foi possivel inativar este livro.',
    })
  }

  async function handleDeleteBook(bookId: string) {
    return runAction(async () => {
      await apiRequest(`/folio/books/${encodeURIComponent(bookId)}`, { method: 'DELETE' }, token)
      await loadBootstrap()
    }, {
      success: 'Livro excluido da Biblioteca.',
      error: 'Nao foi possivel excluir este livro.',
    })
  }

  async function handleUploadBookCover(file: File) {
    beginActionLoading()
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_BASE_URL}/folio/books/cover`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json() as { url: string }
      showToast('success', 'Capa enviada com sucesso.')
      return data.url
    } catch (error) {
      showToast('error', errorMessage(error, 'Nao foi possivel enviar a capa.'))
      throw error
    } finally {
      endActionLoading()
    }
  }

  async function handleUploadPostImage(file: File) {
    beginActionLoading()
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_BASE_URL}/folio/media`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json() as { url: string }
      showToast('success', 'Imagem anexada com sucesso.')
      return data.url
    } catch (error) {
      showToast('error', errorMessage(error, 'Nao foi possivel anexar a imagem.'))
      throw error
    } finally {
      endActionLoading()
    }
  }

  async function handleAddReply(postId: string, text: string, parentReplyId?: string) {
    if (!currentUser) return false
    return runAction(async () => {
      const path = parentReplyId
        ? '/folio/replies/replies'
        : `/folio/posts/${encodeURIComponent(postId)}/replies`
      await apiRequest(path, { method: 'POST', body: JSON.stringify(parentReplyId ? { text, parentReplyId } : { text }) }, token)
      await loadBootstrap()
    }, {
      success: 'Resposta publicada com sucesso.',
      error: 'Nao foi possivel publicar a resposta.',
    })
  }

  async function handleDeletePost(postId: string) {
    if (!currentUser) return false
    return runAction(async () => {
      await apiRequest(`/folio/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }, token)
      await loadBootstrap()
    }, {
      success: 'Publicação apagada.',
      error: 'Nao foi possivel apagar a publicação.',
    })
  }

  async function handleDeleteReply(replyId: string) {
    if (!currentUser) return false
    return runAction(async () => {
      await apiRequest(`/folio/replies/${encodeURIComponent(replyId)}`, { method: 'DELETE' }, token)
      await loadBootstrap()
    }, {
      success: 'Resposta apagada.',
      error: 'Nao foi possivel apagar a resposta.',
    })
  }

  async function handleToggleLike(postId: string) {
    if (!currentUser) return false
    const post = posts.find(item => item.id === postId)
    const liked = Boolean(post?.likes.includes(currentUser.id))
    return runAction(async () => {
      await apiRequest(`/folio/posts/${encodeURIComponent(postId)}/likes/toggle`, { method: 'POST' }, token)
      await loadBootstrap()
    }, {
      success: liked ? 'Curtida removida.' : 'Publicação curtida.',
      error: liked ? 'Nao foi possivel remover a curtida.' : 'Nao foi possivel curtir a publicação.',
    })
  }

  async function handleToggleReplyLike(replyId: string) {
    if (!currentUser) return false
    const reply = replies.find(item => item.id === replyId)
    const liked = Boolean(reply?.likes?.includes(currentUser.id))
    return runAction(async () => {
      await apiRequest('/folio/replies/likes/toggle', { method: 'POST', body: JSON.stringify({ replyId }) }, token)
      await loadBootstrap()
    }, {
      success: liked ? 'Curtida removida.' : 'Comentário curtido.',
      error: liked ? 'Nao foi possivel remover a curtida.' : 'Nao foi possivel curtir o comentário.',
    })
  }

  async function handleToggleFollow(userId: string) {
    if (!currentUser || userId === currentUser.id) return false
    const following = currentUser.following.includes(userId)
    return runAction(async () => {
      await apiRequest(`/folio/follows/${userId}/toggle`, { method: 'POST' }, token)
      await loadBootstrap()
    }, {
      success: following ? 'Você deixou de seguir este perfil.' : 'Perfil seguido com sucesso.',
      error: following ? 'Nao foi possivel deixar de seguir este perfil.' : 'Nao foi possivel seguir este perfil.',
    })
  }

  async function handleUpdateUser(changes: Partial<User>) {
    if (!currentUser) return false
    return runAction(async () => {
      await apiRequest('/folio/me', { method: 'PATCH', body: JSON.stringify(changes) }, token)
      await loadBootstrap()
    }, {
      success: 'Perfil atualizado com sucesso.',
      error: 'Nao foi possivel atualizar o perfil.',
    })
  }

  async function handleUploadAvatar(file: File) {
    beginActionLoading()
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_BASE_URL}/folio/me/avatar`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })
      if (!response.ok) throw new Error(await response.text())
      const data = await response.json() as { url: string }
      showToast('success', 'Imagem enviada com sucesso.')
      return data.url
    } catch (error) {
      showToast('error', errorMessage(error, 'Nao foi possivel enviar a imagem.'))
      throw error
    } finally {
      endActionLoading()
    }
  }

  async function handleSearchBooks(query: string, field: BookSearchField) {
    return apiRequest<Book[]>(`/folio/books/search?q=${encodeURIComponent(query)}&field=${encodeURIComponent(field)}`, {}, token)
  }

  async function handleCreatePost(post: Post) {
    return runAction(async () => {
      await apiRequest('/folio/posts', { method: 'POST', body: JSON.stringify(post) }, token)
      await loadBootstrap()
    }, {
      success: 'Publicação criada com sucesso.',
      error: 'Nao foi possivel criar a publicação.',
    })
  }

  async function handleUpdateReadingGoal(changes: { targetBooks?: number; targetDays?: number }) {
    return runAction(async () => {
      await apiRequest('/folio/reading-goal', { method: 'PATCH', body: JSON.stringify(changes) }, token)
      await loadBootstrap()
    }, {
      success: 'Meta atualizada com sucesso.',
      error: 'Nao foi possivel atualizar a meta.',
    })
  }

  async function handleToggleReadingCheckIn() {
    const checked = readingGoal.checkedInToday
    return runAction(async () => {
      await apiRequest('/folio/reading-goal/checkins/toggle', { method: 'POST', body: JSON.stringify({ date: localDateKey() }) }, token)
      await loadBootstrap()
    }, {
      success: checked ? 'Check-in desfeito.' : 'Check-in registrado com sucesso.',
      error: checked ? 'Nao foi possivel desfazer o check-in.' : 'Nao foi possivel registrar o check-in.',
    })
  }

  function handleLogout() {
    setCurrentUser(null)
    localStorage.removeItem('folio_token')
    setToken('')
    setPage('timeline')
    setSelectedBookId(null)
    setSelectedProfileUserId(null)
    setProfileListKind('following')
    localStorage.removeItem('folio_page')
    localStorage.removeItem('folio_selected_book_id')
    localStorage.removeItem('folio_selected_profile_user_id')
  }

  if (!currentUser) {
    if (loadingApp) return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-stone-950 text-sm text-stone-400">
        <BrandMark />
        <span>Carregando {BRAND_NAME}...</span>
      </div>
    )
    return <LoginPage onLogin={handleLogin} />
  }

  const selectedBook = selectedBookId ? books.find(book => book.id === selectedBookId) : null
  const selectedProfileUser = users.find(user => user.id === (selectedProfileUserId || currentUser.id)) || currentUser
  const notificationCount = notifications.filter(notification => !notification.read).length

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <Navigation
        currentUser={currentUser}
        page={page}
        notificationCount={notificationCount}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onNavigate={handleNavigate}
        onCreatePost={() => setShowPostModal(true)}
        onLogout={handleLogout}
      />
      <ActionLoadingIndicator active={actionLoadingCount > 0} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      {datePromptDialog}

      <div className="flex md:ml-60">
        <main className="min-h-screen min-w-0 flex-1 border-x border-stone-800 pb-24 md:pb-0">
          {page === 'timeline' && <TimelinePage currentUser={currentUser} users={users} books={books} shelf={shelf} posts={posts} replies={replies} timeline={timeline} onBookClick={handleBookClick} onUserClick={handleUserClick} onAddReply={handleAddReply} onToggleLike={handleToggleLike} onToggleReplyLike={handleToggleReplyLike} onDeletePost={handleDeletePost} onDeleteReply={handleDeleteReply} onToggleFollow={handleToggleFollow} />}
          {page === 'shelf' && <ShelfPage currentUser={currentUser} shelf={shelf} books={books} onBookClick={handleBookClick} onUpdateShelfEntry={handleUpdateShelfEntry} onRemoveShelfEntry={handleRemoveShelfEntry} onAddBook={handleAddBook} onSaveBook={handleSaveBook} onSearchBooks={handleSearchBooks} />}
          {page === 'library' && <LibraryPage currentUser={currentUser} shelf={shelf} books={books} onBookClick={handleBookClick} onAddBook={handleAddBook} onSaveBook={handleSaveBook} onSetBookActive={handleSetBookActive} onDeleteBook={handleDeleteBook} onSearchBooks={handleSearchBooks} onUploadCover={handleUploadBookCover} />}
          {page === 'book' && selectedBook && <BookPage book={selectedBook} shelf={shelf} posts={posts} replies={replies} users={users} currentUser={currentUser} onBack={() => setPage('timeline')} onUserClick={handleUserClick} onAddReply={handleAddReply} onToggleLike={handleToggleLike} onToggleReplyLike={handleToggleReplyLike} onDeletePost={handleDeletePost} onDeleteReply={handleDeleteReply} onUpdateShelfEntry={handleUpdateShelfEntry} onAddBook={handleAddBook} />}
          {page === 'profile' && <ProfilePage currentUser={currentUser} profileUser={selectedProfileUser} users={users} shelf={shelf} posts={posts} books={books} onBookClick={handleBookClick} onUpdateUser={handleUpdateUser} onUserClick={handleUserClick} onToggleFollow={handleToggleFollow} onDeletePost={handleDeletePost} onOpenProfileList={handleOpenProfileList} onLogout={handleLogout} onUploadAvatar={handleUploadAvatar} />}
          {page === 'profile-list' && <ProfileListPage kind={profileListKind} currentUser={currentUser} profileUser={selectedProfileUser} users={users} books={books} shelf={shelf} posts={posts} replies={replies} onBack={() => setPage('profile')} onBookClick={handleBookClick} onUserClick={handleUserClick} onToggleFollow={handleToggleFollow} onAddReply={handleAddReply} onToggleLike={handleToggleLike} onToggleReplyLike={handleToggleReplyLike} onDeletePost={handleDeletePost} onDeleteReply={handleDeleteReply} />}
          {page === 'goals' && <GoalsPage currentUser={currentUser} shelf={shelf} books={books} readingGoal={readingGoal} onUpdateReadingGoal={handleUpdateReadingGoal} onToggleReadingCheckIn={handleToggleReadingCheckIn} />}
          {page === 'notifications' && <NotificationsPage notifications={notifications} users={users} books={books} showDeviceNotificationControls={canUseDeviceNotifications} deviceNotificationStatus={deviceNotifications} remotePushRegistered={remotePushRegistered} onEnableDeviceNotifications={handleEnableDeviceNotifications} onTestDeviceNotification={handleTestDeviceNotification} onBookClick={handleBookClick} onUserClick={handleUserClick} />}
        </main>

        <div className="hidden w-88 shrink-0 p-3 xl:block 2xl:w-96">
          <RightPanel currentUser={currentUser} users={users} shelf={shelf} books={books} onBookClick={handleBookClick} onUserClick={handleUserClick} onToggleFollow={handleToggleFollow} />
        </div>
      </div>

      {showPostModal && (
        <CreatePostModal
          currentUser={currentUser}
          shelf={shelf}
          books={books}
          onClose={() => setShowPostModal(false)}
          onPost={handleCreatePost}
          onUploadImage={handleUploadPostImage}
        />
      )}
    </div>
  )
}

