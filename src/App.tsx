import { useEffect, useMemo, useRef, useState } from 'react'

import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import type { ImgHTMLAttributes } from 'react'

type BookStatus = 'reading' | 'want' | 'read' | 'favorite' | 'rereading' | 'abandoned'
type PostType = 'comment' | 'reaction' | 'theory'
type Page = 'timeline' | 'shelf' | 'library' | 'book' | 'profile' | 'profile-list' | 'goals' | 'notifications' | 'superadmin' | 'store' | 'ai-lab'
type ProfileListKind = 'following' | 'followers' | 'posts'
type BookSearchField = 'all' | 'title' | 'author' | 'series' | 'genre' | 'trope' | 'tag'
type ColorTheme = 'light' | 'dark'
type BookFeedVisibility = 'all' | 'available'
type BookTab = 'feed' | 'theories' | 'rooms' | 'replay' | 'about'

type ViewState = {
  page: Page
  selectedBookId: string | null
  selectedPostId: string | null
  selectedProfileUserId: string | null
  profileListKind: ProfileListKind
}

const BRAND_NAME = ''
const BRAND_LOGO_URL = '/assets/image/logo/logo.jpeg'
// IA Lab pausado no frontend. Mude para true quando quiser reativar a tela.
const AI_LAB_FRONTEND_ENABLED = false

interface User {
  id: string
  name: string
  email: string
  password: string
  role?: 'admin' | 'superadmin' | 'reader'
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
  audience?: 'all' | 'tea'
  timestamp: string
  editedAt?: string | null
  likes: string[]
  reactions?: { userId: string; type: ReactionType }[]
  comments: number
  views?: string[]
  viewCount?: number
  mentionedUserIds?: string[]
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
  editedAt?: string | null
  likes: string[]
  reactions?: { userId: string; type: ReactionType }[]
  comments: number
  mentionedUserIds?: string[]
}

type ReactionType = 'love' | 'laugh' | 'wow' | 'sad' | 'angry'
type ReplyReactionType = ReactionType

type AddReplyHandler = (postId: string, text: string, parentReplyId?: string, mentionedUserIds?: string[]) => Promise<boolean | void> | boolean | void

interface FolioNotification {
  id: string
  type: 'follow' | 'like' | 'reply' | 'reply_like' | 'reply_reply' | 'book_comment' | 'mention'
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
  targetBooksMonth?: number
  targetBooksWeek?: number
  targetDays: number
  checkIns: string[]
  currentStreak: number
  bestStreak: number
  checkedInToday: boolean
  year?: number
  month?: number
  weekStart?: string
  booksReadThisYear?: number
  booksReadThisMonth?: number
  booksReadThisWeek?: number
}

type ReminderFrequency = 'off' | 'low' | 'normal' | 'intense'

interface NotificationPreferences {
  checkInReminders: boolean
  readingGoalReminders: boolean
  reactionReminders: boolean
  clubReminders: boolean
  returnReminders: boolean
  reminderFrequency: ReminderFrequency
  quietStartHour?: number
  quietEndHour?: number
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  checkInReminders: true,
  readingGoalReminders: true,
  reactionReminders: true,
  clubReminders: true,
  returnReminders: true,
  reminderFrequency: 'normal',
  quietStartHour: 21,
  quietEndHour: 8,
}

interface StoreUserSummary {
  id: string
  name: string
  handle: string
}

interface StoreProduct {
  id: string
  name: string
  description?: string | null
  imageUrl?: string | null
  price: number
  stock: number
  category?: string | null
  bookId?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface StoreProductSuggestion {
  id: string
  user: StoreUserSummary
  name: string
  description?: string | null
  referenceUrl?: string | null
  status: string
  adminNote?: string | null
  createdAt: string
  updatedAt: string
}

interface StoreOrderItem {
  id: string
  productId: string
  productName: string
  productImageUrl?: string | null
  unitPrice: number
  quantity: number
  total: number
}

interface StoreOrder {
  id: string
  user: StoreUserSummary
  status: string
  customerName: string
  email?: string | null
  phone?: string | null
  shippingAddress?: string | null
  total: number
  createdAt: string
  updatedAt: string
  items: StoreOrderItem[]
}

interface StoreBootstrap {
  products: StoreProduct[]
  requests: StoreProductSuggestion[]
  orders: StoreOrder[]
}

type StoreCartItem = {
  productId: string
  quantity: number
}

interface AiLabResponse {
  generatedAt: string
  access: string
  characterProfileId?: string | null
  character: string
  conversationMode?: string
  book?: {
    id: string
    title: string
    author: string
  } | null
  spoilerBoundary: {
    chapter: number
    percent: number
  }
  promptPreview: string
  reply: string
  guardrails: string[]
  learningTrace: {
    label: string
    title: string
    detail: string
  }[]
}

type AiChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  response?: AiLabResponse
}

type AiConversationMode = 'chapter-guide' | 'character' | 'literary-analysis' | 'spoiler-free-theory'

interface AiCharacterMemory {
  id?: string | null
  chapter: number
  percent: number
  kind: string
  text: string
}

interface AiCharacterProfile {
  id: string
  bookId?: string | null
  name: string
  persona: string
  traits: string[]
  forbiddenFacts: string[]
  memories: AiCharacterMemory[]
  sourceChunks: AiCharacterSourceChunk[]
  updatedAt: string
}

interface AiCharacterSourceChunk {
  id?: string | null
  chapter: number
  percent: number
  title?: string | null
  text: string
}

interface AiSourceImportResponse {
  sourceId: string
  bookId?: string | null
  fileName: string
  storedFileName: string
  size: number
  chunkCount: number
  importedAt: string
  chunks: AiCharacterSourceChunk[]
  skipped?: string | null
}

interface AiSourceSummary {
  id: string
  bookId?: string | null
  fileName: string
  storedFileName: string
  size: number
  chunkCount: number
  importedAt: string
}

interface DashboardUser {
  id: string
  name: string
  email: string
  handle: string
  avatar: string
}

interface DashboardBookRef {
  id: string
  title: string
  author: string
  cover: string
}

interface DashboardPostReportRow {
  id: string
  user: DashboardUser
  book: DashboardBookRef
  type: PostType
  chapter: number
  percent: number
  text: string
  createdAt: string
  likes: number
  views: number
  replies: number
}

interface DashboardUserReportRow {
  user: DashboardUser
  role: 'admin' | 'superadmin' | 'reader' | string
  hasProfile: boolean
  createdAt?: string | null
  updatedAt?: string | null
  booksRead: number
  pagesRead: number
  posts: number
  replies: number
  shelfEntries: number
  followers: number
  following: number
  loginsToday: number
  lastActivityAt?: string | null
}

interface DashboardInteractionReportRow {
  id: string
  user: DashboardUser
  type: 'like' | 'reply_like' | 'view' | 'reply' | 'mention' | string
  createdAt: string
  postId?: string | null
  book: DashboardBookRef
  text: string
}

interface DashboardBookReportRow extends DashboardBookRef {
  posts: number
  readers: number
  reading: number
  completed: number
  inactive: boolean
  createdAt: string
}

interface DashboardLoginReportRow {
  user: DashboardUser
  loggedAt: string
}

interface DashboardActiveNowRow {
  user: DashboardUser
  lastSeenAt: string
  actions: number
  source: string
}

interface DashboardPushReportRow {
  id: string
  user: DashboardUser
  endpoint: string
  userAgent?: string | null
  createdAt: string
  updatedAt: string
}

type DashboardReportKey = 'users' | 'postsToday' | 'activeNow' | 'interactionsToday' | 'books' | 'postsThisYear' | 'loginsToday' | 'pushSubscriptions'

interface SuperAdminDashboard {
  generatedAt: string
  overview: {
    totalUsers: number
    totalProfiles: number
    totalBooks: number
    totalShelfEntries: number
    totalPosts: number
    postsToday: number
    postsThisMonth: number
    postsThisYear: number
    repliesToday: number
    mentionsToday?: number
    likesToday: number
    viewsToday: number
    loginsToday: number
    activeNow: number
    checkInsToday: number
    remindersToday?: number
    reminderUsersToday?: number
    pushUsers?: number
    pushSubscriptions: number
  }
  postsByDay: { label: string; date: string; count: number }[]
  postsByMonth: { label: string; date: string; count: number }[]
  postsByYear: { label: string; year: number; count: number }[]
  engagementByDay: {
    label: string
    posts: number
    replies: number
    likes: number
    views: number
    follows: number
    checkIns: number
  }[]
  topUsersToday: {
    user: DashboardUser
    actions: number
    posts: number
    replies: number
    likes: number
    views: number
    lastSeenAt: string
  }[]
  topLoginsToday: {
    user: DashboardUser
    logins: number
    lastLoginAt: string
  }[]
  activeNow: DashboardActiveNowRow[]
  topBooks: {
    id: string
    title: string
    author: string
    cover: string
    posts: number
    readers: number
  }[]
  statusBreakdown: { label: string; count: number }[]
  postTypeBreakdown: { label: string; count: number }[]
  reports: {
    users: DashboardUserReportRow[]
    postsToday: DashboardPostReportRow[]
    postsThisMonth: DashboardPostReportRow[]
    postsThisYear: DashboardPostReportRow[]
    activeNow: DashboardActiveNowRow[]
    interactionsToday: DashboardInteractionReportRow[]
    books: DashboardBookReportRow[]
    loginsToday: DashboardLoginReportRow[]
    pushSubscriptions: DashboardPushReportRow[]
  }
}

type ActionFeedback = {
  success?: string
  error: string
  silentSuccess?: boolean
}

type UpdateShelfOptions = {
  offerReadingCheckIn?: boolean
}

interface ToastMessage {
  id: number
  type: 'success' | 'error'
  text: string
}

interface ServiceNotice {
  eyebrow: string
  title: string
  paragraphs: string[]
  deadlineLabel: string
  deadlineIso: string
  deadlineDisplay: string
  retryLabel: string
  logoutLabel: string
}

interface MaintenanceMode {
  enabled: boolean
  message: string
  updatedAt?: string | null
}

interface CommunityFeature {
  enabled: boolean
  previewEnabled?: boolean
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'https://localhost:7198' : 'https://entrelinhas.sgpf.com.br')
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || 'https://entrelinhas.sgpf.com.br'
const FOLIO_HUB_URL = `${API_BASE_URL}/hubs/folio`
const DEVICE_NOTIFICATION_SW_URL = '/folio-service-worker.js'
const DEVICE_NOTIFICATION_STORAGE_PREFIX = 'folio_device_notified_ids_'
const POST_PAGE_SIZE = 5
const LIBRARY_PAGE_SIZE = 30
const POST_IMAGE_MARKER = '__folio_post_image__:'
const POST_IMAGE_MAX_DIMENSION = 1600
const POST_IMAGE_COMPRESS_ABOVE_BYTES = 1400 * 1024
const POST_IMAGE_JPEG_QUALITY = 0.82
const BOOK_COVER_MAX_DIMENSION = 1200
const BOOK_COVER_COMPRESS_ABOVE_BYTES = 450 * 1024
const BOOK_COVER_JPEG_QUALITY = 0.84
const BOOK_COVER_CACHE_VERSION = import.meta.env.VITE_BOOK_COVER_CACHE_VERSION || '2026-08-14-cover-recovery-1'
const DIRECT_UPLOAD_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const IMAGE_UPLOAD_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const BOOK_COVER_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)(?:[?#].*)?$/i
const MAINTENANCE_STORAGE_KEY = 'folio_maintenance_mode'
const DEFAULT_MAINTENANCE_MESSAGE = 'A plataforma está em manutenção para aplicação de melhorias. Estamos preparando ajustes importantes e voltaremos em breve com uma experiência melhor para todos.'
// Personalize este comunicado quando o motivo da indisponibilidade mudar.
const SERVICE_UNAVAILABLE_NOTICE: ServiceNotice = {
  eyebrow: 'Comunicado Oficial - Grupo Entrelinhas',
  title: 'Instabilidade na região',
  paragraphs: [
    'Olá! Passando para informar que, neste momento, nossos serviços estão temporariamente indisponíveis devido a uma instabilidade de rede identificada na região.',
    'Nossa equipe técnica já detectou a ocorrência e está trabalhando com prioridade máxima para restabelecer o serviço o mais rápido possível.',
    'Pedimos desculpas pelos transtornos e agradecemos a compreensão e a paciência de todos. Assim que a situação for normalizada, os serviços voltarão a funcionar normalmente.',
    'Agradecemos pela confiança no Grupo Entrelinhas e manteremos vocês informados caso haja novas atualizações.',
  ],
  deadlineLabel: 'Previsão máxima para normalização',
  deadlineIso: '2026-07-24T01:00:00-03:00',
  deadlineDisplay: '24/07/2026 às 01:00',
  retryLabel: 'Tentar novamente',
  logoutLabel: 'Sair',
}

class ApiRequestError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

function isAuthExpiredError(error: unknown) {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403)
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    const message = await response.text()
    throw new ApiRequestError(response.status, message || `Erro ${response.status}`)
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

function isImageUpload(file: File) {
  return DIRECT_UPLOAD_IMAGE_TYPES.has(file.type.toLowerCase()) && /\.(jpe?g|png|webp|gif)$/i.test(file.name)
}

type WeeklySpotlight = {
  key: string
  label: string
  title: string
  detail: string
  bookId?: string
  userId?: string
}

type SmartNudge = {
  key: string
  title: string
  detail: string
  bookId?: string
  action?: 'checkin' | 'post'
}

function postImageFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '').trim() || 'imagem'
  return `${baseName}.jpg`
}

function loadImageFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Formato de imagem nao suportado. Tente JPG, PNG ou WEBP.'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Nao foi possivel preparar esta imagem para envio.'))
    }, type, quality)
  })
}

async function preparePostImageFile(file: File) {
  if (!isImageUpload(file)) throw new Error('Selecione um arquivo de imagem.')

  const fileType = file.type.toLowerCase()
  if (fileType === 'image/svg+xml') {
    throw new Error('Envie uma imagem em JPG, PNG, WEBP ou GIF.')
  }

  if (file.size <= POST_IMAGE_COMPRESS_ABOVE_BYTES && DIRECT_UPLOAD_IMAGE_TYPES.has(fileType)) {
    return file
  }

  if (fileType === 'image/gif') return file

  const image = await loadImageFile(file)
  const largestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
  const scale = largestSide > POST_IMAGE_MAX_DIMENSION ? POST_IMAGE_MAX_DIMENSION / largestSide : 1
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale))
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Nao foi possivel preparar esta imagem para envio.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, 'image/jpeg', POST_IMAGE_JPEG_QUALITY)
  if (blob.size >= file.size && DIRECT_UPLOAD_IMAGE_TYPES.has(fileType)) return file

  return new File([blob], postImageFileName(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}

function resolveFolioPostUploadUrl(url: string) {
  try {
    const parsedUrl = new URL(url, window.location.origin)
    const uploadPrefix = '/uploads/folio-posts/'
    if (!parsedUrl.pathname.toLowerCase().startsWith(uploadPrefix)) return ''

    const fileName = parsedUrl.pathname.slice(uploadPrefix.length).split('/')[0]
    if (!fileName) return ''

    return encodeURI(`${MEDIA_BASE_URL.replace(/\/$/, '')}/folio/media/${fileName}${parsedUrl.search}${parsedUrl.hash}`)
  } catch {
    return ''
  }
}

function resolveFolioPostMediaUploadUrl(url: string) {
  try {
    const parsedUrl = new URL(url, window.location.origin)
    const mediaPrefix = '/folio/media/'
    if (!parsedUrl.pathname.toLowerCase().startsWith(mediaPrefix)) return ''

    const fileName = parsedUrl.pathname.slice(mediaPrefix.length).split('/')[0]
    if (!fileName) return ''

    return encodeURI(`${MEDIA_BASE_URL.replace(/\/$/, '')}/uploads/folio-posts/${fileName}${parsedUrl.search}${parsedUrl.hash}`)
  } catch {
    return ''
  }
}

function mediaBaseUrl() {
  return MEDIA_BASE_URL.replace(/\/$/, '')
}

function mediaFileNameFromUrl(value: string) {
  try {
    const parsedUrl = new URL(value, window.location.origin)
    const fileName = decodeURIComponent(parsedUrl.pathname.split('/').filter(Boolean).pop() || '')
    return BOOK_COVER_IMAGE_EXTENSIONS.test(fileName) ? fileName : ''
  } catch {
    const cleanValue = value.split(/[?#]/)[0].trim()
    const fileName = cleanValue.split(/[\\/]/).filter(Boolean).pop() || ''
    return BOOK_COVER_IMAGE_EXTENSIONS.test(fileName) ? fileName : ''
  }
}

function normalizeUploadedBookCoverUrl(value?: string | null) {
  const url = (value || '').trim()
  if (!url) return ''
  if (/^(data:|blob:)/i.test(url)) return url

  const fileName = mediaFileNameFromUrl(url)
  return fileName ? `/uploads/folio-covers/${encodeURIComponent(fileName)}` : url
}

async function prepareBookCoverImageFile(file: File) {
  if (!isImageUpload(file)) throw new Error('Envie uma imagem em JPG, PNG, WEBP ou GIF.')

  const fileType = file.type.toLowerCase()
  if (fileType === 'image/gif') return file

  const image = await loadImageFile(file)
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  const largestSide = Math.max(naturalWidth, naturalHeight)

  if (file.size <= BOOK_COVER_COMPRESS_ABOVE_BYTES && largestSide <= BOOK_COVER_MAX_DIMENSION) {
    return file
  }

  const scale = largestSide > BOOK_COVER_MAX_DIMENSION ? BOOK_COVER_MAX_DIMENSION / largestSide : 1
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('Nao foi possivel preparar esta capa para envio.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  const blob = await canvasToBlob(canvas, 'image/jpeg', BOOK_COVER_JPEG_QUALITY)
  if (blob.size >= file.size && largestSide <= BOOK_COVER_MAX_DIMENSION) return file

  return new File([blob], postImageFileName(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}

function resolveBookCoverUrlCandidates(value?: string | null) {
  const url = (value || '').trim()
  if (!url) return []

  const fileName = mediaFileNameFromUrl(url)
  if (!fileName) return []

  let pathname = ''
  try {
    pathname = new URL(url, window.location.origin).pathname
  } catch {
    pathname = url.split(/[?#]/)[0]
  }

  const isBareFileName = !/[\\/]/.test(url.split(/[?#]/)[0])
  const isKnownBookCoverPath = /^\/?(?:uploads\/(?:folio-covers|folio-book-covers|folio-books|book-covers|books)|folio\/books\/cover)\//i.test(pathname)
  if (!isBareFileName && !isKnownBookCoverPath) return []

  const encodedFileName = encodeURIComponent(fileName)
  const baseUrl = mediaBaseUrl()
  return [`${baseUrl}/uploads/folio-covers/${encodedFileName}`]
}

function resolveMediaUrl(value?: string | null) {
  const url = (value || '').trim()
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsedUrl = new URL(url)
      const isUploadUrl = parsedUrl.pathname.startsWith('/uploads/')
      const isLegacyFolioPostUpload =
        parsedUrl.hostname.toLowerCase() === 'api.sgpf.com.br' &&
        parsedUrl.pathname.toLowerCase().startsWith('/uploads/folio-posts/')
      const isPrivateIpUploadHost = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(parsedUrl.hostname)
      const isLocalUploadHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsedUrl.hostname)
      const isSameHostUpload = parsedUrl.hostname === window.location.hostname
      if (isLegacyFolioPostUpload || (isUploadUrl && (isLocalUploadHost || isPrivateIpUploadHost || isSameHostUpload))) {
        return encodeURI(`${MEDIA_BASE_URL.replace(/\/$/, '')}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`)
      }
    } catch {
      // Keep the original URL handling below when URL parsing fails.
    }
  }
  if (/^http:\/\//i.test(url) && window.location.protocol === 'https:') {
    return url.replace(/^http:\/\//i, 'https://')
  }
  if (/^https?:\/\//i.test(url)) return encodeURI(url)
  if (url.startsWith('/assets/') || url.startsWith('/icons/')) return url
  if (url.startsWith('/')) return `${mediaBaseUrl()}${url}`
  if (/^(uploads|media|files)\//i.test(url)) return `${mediaBaseUrl()}/${url}`
  if (BOOK_COVER_IMAGE_EXTENSIONS.test(url)) return `${mediaBaseUrl()}/uploads/folio-covers/${encodeURIComponent(url)}`
  return url
}

function versionUploadedBookCoverUrl(url: string) {
  if (!url) return ''

  try {
    const parsedUrl = new URL(url, window.location.href)
    if (!/^\/uploads\/folio-covers\//i.test(parsedUrl.pathname)) return url
    parsedUrl.searchParams.set('folio_cover_v', BOOK_COVER_CACHE_VERSION)
    return parsedUrl.href
  } catch {
    return url
  }
}

function resolveMediaUrlCandidates(value?: string | null) {
  const primary = versionUploadedBookCoverUrl(resolveMediaUrl(value))
  const candidates = [primary]
  const postMediaUrl = value ? resolveFolioPostUploadUrl(value) : ''
  const postUploadUrl = value ? resolveFolioPostMediaUploadUrl(value) : ''
  const bookCoverUrls = resolveBookCoverUrlCandidates(value)

  for (const candidate of [postMediaUrl, postUploadUrl, ...bookCoverUrls]) {
    const versionedCandidate = versionUploadedBookCoverUrl(candidate)
    if (versionedCandidate && !candidates.includes(versionedCandidate)) candidates.push(versionedCandidate)
  }

  return candidates.filter(Boolean)
}

function isMediaUrl(value?: string | null) {
  const url = (value || '').trim()
  return /^(https?:|\/\/|\/|uploads\/|media\/|files\/)/i.test(url)
}

const IMAGE_RETRY_PARAM = 'folio_img_retry'
const MAX_IMAGE_RETRY_ATTEMPTS = 1
const IMAGE_LOAD_TIMEOUT_MS = 8000
const preloadedMediaImages = new Map<string, HTMLImageElement>()

function canRetryImageUrl(url: string) {
  if (!url || /^(data:|blob:)/i.test(url)) return false

  try {
    const parsedUrl = new URL(url, window.location.href)
    const mediaHost = new URL(mediaBaseUrl(), window.location.href).host
    const isOwnedMedia = parsedUrl.host === mediaHost || parsedUrl.host === window.location.host
    return isOwnedMedia && /^\/(?:uploads\/|folio\/media\/)/i.test(parsedUrl.pathname)
  } catch {
    return false
  }
}

function imageRetryUrl(url: string) {
  try {
    const retryUrl = new URL(url, window.location.href)
    retryUrl.searchParams.set(IMAGE_RETRY_PARAM, String(Date.now()))
    return retryUrl.href
  } catch {
    const hashIndex = url.indexOf('#')
    const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
    return `${base}${base.includes('?') ? '&' : '?'}${IMAGE_RETRY_PARAM}=${Date.now()}${hash}`
  }
}

function retryImageElement(image: HTMLImageElement, delayMs = 0) {
  const currentUrl = image.currentSrc || image.src
  if (!canRetryImageUrl(currentUrl)) return

  const attempts = Number(image.dataset.folioImageRetryAttempts || '0')
  if (attempts >= MAX_IMAGE_RETRY_ATTEMPTS) return

  image.dataset.folioImageRetryAttempts = String(attempts + 1)
  window.setTimeout(() => {
    if (!image.isConnected) return
    image.src = imageRetryUrl(currentUrl)
  }, delayMs)
}

type FolioImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null
  skeletonClassName?: string
}

function FolioImage({ src, alt = '', className = '', skeletonClassName = '', loading = 'lazy', decoding = 'async', onLoad, onError, ...props }: FolioImageProps) {
  const imageCandidates = useMemo(() => resolveMediaUrlCandidates(src), [src])
  const resolvedSrc = imageCandidates[0] || ''
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [imageSrc, setImageSrc] = useState(resolvedSrc)
  const [imageIndex, setImageIndex] = useState(0)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setImageSrc(resolvedSrc)
    setImageIndex(0)
    setRetryAttempt(0)
    setLoaded(false)
    setFailed(!resolvedSrc)
  }, [imageCandidates, resolvedSrc])

  useEffect(() => {
    const image = imageRef.current
    if (!image || !image.complete) return

    if (image.naturalWidth > 0) {
      setLoaded(true)
      setFailed(false)
      return
    }

    if (imageSrc) setFailed(true)
  }, [imageSrc])

  function tryNextImageUrl(url?: string | null) {
    const retrySource = url || imageSrc || imageCandidates[imageIndex] || resolvedSrc
    if (!retrySource || !canRetryImageUrl(retrySource)) {
      setFailed(true)
      return
    }

    if (retryAttempt >= MAX_IMAGE_RETRY_ATTEMPTS) {
      const nextIndex = imageIndex + 1
      const nextSrc = imageCandidates[nextIndex]
      if (nextSrc) {
        setImageIndex(nextIndex)
        setRetryAttempt(0)
        setLoaded(false)
        setFailed(false)
        setImageSrc(nextSrc)
        return
      }

      setFailed(true)
      return
    }

    setRetryAttempt(retryAttempt + 1)
    setLoaded(false)
    setFailed(false)
    setImageSrc(imageRetryUrl(retrySource))
  }

  useEffect(() => {
    if (!resolvedSrc || loaded || failed) return

    const timeoutId = window.setTimeout(() => {
      tryNextImageUrl(imageSrc)
    }, IMAGE_LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [failed, imageCandidates, imageIndex, imageSrc, loaded, resolvedSrc, retryAttempt])

  return (
    <span className={`folio-image-frame ${loaded ? 'folio-image-loaded' : ''} ${failed ? 'folio-image-failed' : ''} ${className}`}>
      <span className={`folio-skeleton folio-image-placeholder ${skeletonClassName}`} aria-hidden="true" />
      {imageSrc && (
        <img
          {...props}
          ref={imageRef}
          src={imageSrc}
          alt={alt}
          loading={loading}
          decoding={decoding}
          data-folio-image-managed="true"
          className="folio-image-node"
          onLoad={event => {
            setLoaded(true)
            setFailed(false)
            onLoad?.(event)
          }}
          onError={event => {
            tryNextImageUrl(event.currentTarget.currentSrc || event.currentTarget.src)
            onError?.(event)
          }}
        />
      )}
    </span>
  )
}

function PostImageLightbox({ src, alt, onClose }: {
  src: string
  alt: string
  onClose: () => void
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Imagem da publicação"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6"
      onClick={event => event.currentTarget === event.target && onClose()}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 rounded-full border border-white/15 bg-stone-950/85 px-3 py-2 text-sm font-bold text-stone-100 shadow-2xl shadow-black/40 transition hover:bg-stone-800 sm:right-5 sm:top-5"
      >
        Fechar
      </button>
      <div className="flex h-full max-h-[calc(100vh-5.5rem)] w-full max-w-6xl items-center justify-center sm:max-h-[calc(100vh-6rem)]">
        <FolioImage
          src={src}
          alt={alt}
          loading="eager"
          className="folio-image-contain h-full w-full rounded-lg bg-black/20"
        />
      </div>
    </div>
  )
}

function PostTextWithMentions({ text, users, onUserClick, className = 'mb-3 whitespace-pre-line text-sm leading-relaxed text-stone-300' }: {
  text: string
  users: User[]
  onUserClick: (id: string) => void
  className?: string
}) {
  const usersByHandle = new Map(users.map(user => [normalizeSearch(user.handle), user]))
  const parts: React.ReactNode[] = []
  let lastIndex = 0

  for (const match of text.matchAll(/@([\p{L}\p{N}_.-]+)/gu)) {
    const index = match.index ?? 0
    const rawMention = match[0]
    const user = usersByHandle.get(normalizeSearch(match[1]))

    if (index > lastIndex) parts.push(text.slice(lastIndex, index))
    parts.push(user ? (
      <button
        key={`${user.id}-${index}`}
        type="button"
        onClick={() => onUserClick(user.id)}
        className="font-bold text-amber-300 hover:text-amber-200"
      >
        {rawMention}
      </button>
    ) : rawMention)
    lastIndex = index + rawMention.length
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex))

  return <p className={className}>{parts}</p>
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

const warmedMediaUrls = new Set<string>()

function warmMediaImages(values: (string | null | undefined)[], priorityCount = 2, maxCount = 6) {
  values
    .map(resolveMediaUrl)
    .filter(url => url && !/^(data:|blob:)/i.test(url))
    .filter((url, index, urls) => urls.indexOf(url) === index)
    .slice(0, maxCount)
    .forEach((url, index) => {
      if (warmedMediaUrls.has(url)) return
      warmedMediaUrls.add(url)

      const image = new Image()
      image.decoding = 'async'
        ; (image as HTMLImageElement & { fetchPriority?: 'high' | 'auto' }).fetchPriority = index < priorityCount ? 'high' : 'auto'
      preloadedMediaImages.set(url, image)
      image.onerror = () => preloadedMediaImages.delete(url)
      image.src = url

      if (preloadedMediaImages.size > 12) {
        const oldestUrl = preloadedMediaImages.keys().next().value
        if (oldestUrl) preloadedMediaImages.delete(oldestUrl)
      }
    })
}

function warmBootstrapImages(data: { users: User[]; books: Book[]; shelf: ShelfEntry[]; posts: Post[]; currentUserId: string }) {
  const currentUser = data.users.find(user => user.id === data.currentUserId) || data.users[0]
  if (!currentUser) return

  const booksById = new Map(data.books.map(book => [book.id, book]))
  const usersById = new Map(data.users.map(user => [user.id, user]))
  const allowedUserIds = new Set([...currentUser.following, currentUser.id])
  const firstFeedPosts = data.posts
    .filter(post => allowedUserIds.has(post.userId))
    .sort(newestFirst)
    .slice(0, POST_PAGE_SIZE)
  warmMediaImages([
    BRAND_LOGO_URL,
    currentUser.avatar,
    ...firstFeedPosts.flatMap(post => [
      usersById.get(post.userId)?.avatar,
      booksById.get(post.bookId)?.cover,
      postTextParts(post.text).imageUrl,
    ]),
  ], 2, 6)
}

const STATUS_LABELS: Record<BookStatus, string> = {
  reading: 'Lendo',
  want: 'TBR',
  read: 'Lido',
  favorite: 'Favoritado',
  rereading: 'Relendo',
  abandoned: 'Abandonei',
}
const SHELF_STATUSES: BookStatus[] = ['reading', 'want', 'read', 'favorite', 'rereading', 'abandoned']

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

function normalizeChoiceValue(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function choiceKey(value: string) {
  return normalizeSearch(normalizeChoiceValue(value))
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

function mentionableUsers(currentUser: User, users: User[]) {
  const following = new Set(currentUser.following)
  return users
    .filter(user => user.id !== currentUser.id && following.has(user.id) && user.handle)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

function activeMentionQuery(value: string, caretIndex: number) {
  const beforeCaret = value.slice(0, caretIndex)
  const match = /(^|[^\p{L}\p{N}_.-])@([\p{L}\p{N}_.-]*)$/u.exec(beforeCaret)
  if (!match) return null

  const start = beforeCaret.lastIndexOf('@')
  if (start < 0) return null
  return { start, end: caretIndex, query: match[2] || '' }
}

function usersMatchingMentionQuery(currentUser: User, users: User[], query: string) {
  const needle = query.replace(/^@+/, '')
  return mentionableUsers(currentUser, users)
    .filter(user => readerMatchesSearch(user, needle))
    .slice(0, 6)
}

function mentionedUsersFromText(value: string, currentUser: User, users: User[]) {
  const usersByHandle = new Map(mentionableUsers(currentUser, users).map(user => [normalizeSearch(user.handle), user]))
  const found: User[] = []
  const seen = new Set<string>()

  for (const match of value.matchAll(/@([\p{L}\p{N}_.-]+)/gu)) {
    const user = usersByHandle.get(normalizeSearch(match[1]))
    if (!user || seen.has(user.id)) continue
    seen.add(user.id)
    found.push(user)
  }

  return found
}

function isSuperAdminUser(user?: { role?: string | null } | null) {
  return user?.role === 'superadmin'
}

function isAdminUser(user?: { role?: string | null } | null) {
  return user?.role === 'admin' || user?.role === 'superadmin'
}

function uniqueUsersById(users: User[]) {
  const seen = new Set<string>()
  return users.filter(user => {
    if (seen.has(user.id)) return false
    seen.add(user.id)
    return true
  })
}

function MentionTextarea({ value, onChange, currentUser, users, rows, placeholder, disabled, className }: {
  value: string
  onChange: (value: string) => void
  currentUser: User
  users: User[]
  rows: number
  placeholder: string
  disabled?: boolean
  className: string
}) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
  const [activeMention, setActiveMention] = useState<ReturnType<typeof activeMentionQuery>>(null)
  const mentionSuggestions = activeMention ? usersMatchingMentionQuery(currentUser, users, activeMention.query) : []

  useEffect(() => {
    if (disabled) setActiveMention(null)
  }, [disabled])

  function updateMentionState(element: HTMLTextAreaElement, nextValue = element.value) {
    if (disabled) {
      setActiveMention(null)
      return
    }
    const caretIndex = element.selectionStart ?? nextValue.length
    setActiveMention(activeMentionQuery(nextValue, caretIndex))
  }

  function selectMention(user: User) {
    if (!activeMention || disabled) return
    const mentionText = `@${user.handle} `
    const nextValue = `${value.slice(0, activeMention.start)}${mentionText}${value.slice(activeMention.end)}`
    const nextCaret = activeMention.start + mentionText.length

    onChange(nextValue)
    setActiveMention(null)
    window.requestAnimationFrame(() => {
      textAreaRef.current?.focus()
      textAreaRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  return (
    <>
      <textarea
        ref={textAreaRef}
        value={value}
        onChange={e => {
          onChange(e.target.value)
          updateMentionState(e.currentTarget, e.target.value)
        }}
        onInput={e => updateMentionState(e.currentTarget)}
        onClick={e => updateMentionState(e.currentTarget)}
        onFocus={e => updateMentionState(e.currentTarget)}
        onKeyUp={e => updateMentionState(e.currentTarget)}
        onSelect={e => updateMentionState(e.currentTarget)}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className={className}
      />
      {activeMention && (
        <div className="mt-2 overflow-hidden rounded-lg border border-stone-800 bg-stone-950">
          {mentionSuggestions.length ? mentionSuggestions.map(user => (
            <button
              key={user.id}
              type="button"
              onMouseDown={event => event.preventDefault()}
              onClick={() => selectMention(user)}
              className="flex w-full items-center gap-3 border-b border-stone-800 px-3 py-2 text-left last:border-b-0 hover:bg-stone-900"
            >
              <Avatar user={user} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-stone-100">{user.name}</span>
                <span className="block truncate text-xs text-stone-500">@{user.handle}</span>
              </span>
            </button>
          )) : (
            <p className="px-3 py-3 text-xs font-semibold text-stone-500">
              Nenhuma pessoa seguida encontrada.
            </p>
          )}
        </div>
      )}
    </>
  )
}

function mergeBooksById(...groups: Book[][]) {
  const merged = new Map<string, Book>()
  groups.flat().forEach(book => {
    if (!merged.has(book.id)) merged.set(book.id, book)
  })
  return Array.from(merged.values())
}

const RATING_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const REPLY_REACTIONS: { type: ReplyReactionType; emoji: string; label: string }[] = [
  { type: 'love', emoji: '❤️', label: 'Amei' },
  { type: 'laugh', emoji: '😂', label: 'Risada' },
  { type: 'wow', emoji: '😮', label: 'Surpresa' },
  { type: 'sad', emoji: '😢', label: 'Tristeza' },
  { type: 'angry', emoji: '😡', label: 'Raiva' },
]
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

function isDateInMonth(value: string | null | undefined, year: number, month: number) {
  if (!value) return false
  return Number(value.slice(0, 4)) === year && Number(value.slice(5, 7)) === month
}

function weekStartDateKey(date = new Date()) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)
  return localDateKey(start)
}

function isDateInWeek(value: string | null | undefined, weekStart: string) {
  if (!value) return false
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  const start = new Date(`${weekStart}T00:00:00`)
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(start.getTime())) return false
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return date >= start && date < end
}

function shelfCompletionTime(entry: ShelfEntry) {
  const date = dateInputValue(entry.endDate)
  if (!date) return Number.NEGATIVE_INFINITY
  const time = new Date(`${date}T00:00:00`).getTime()
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY
}

function readShelfNewestFirst(a: { entry: ShelfEntry; book: Book }, b: { entry: ShelfEntry; book: Book }) {
  return shelfCompletionTime(b.entry) - shelfCompletionTime(a.entry) || a.book.title.localeCompare(b.book.title, 'pt-BR')
}

type ShelfBookItem = { entry: ShelfEntry; book: Book }

const READ_MONTH_LABELS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

function shelfCompletionDateParts(entry: ShelfEntry) {
  const date = dateInputValue(entry.endDate)
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  if (!date || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

function pluralBooks(count: number) {
  return `${count} ${count === 1 ? 'livro' : 'livros'}`
}

function groupShelfByCompletionMonth(items: ShelfBookItem[]) {
  const yearGroups = new Map<string, {
    key: string
    year: number | null
    count: number
    months: Map<string, { key: string; month: number | null; items: ShelfBookItem[] }>
  }>()

  items.forEach(item => {
    const parts = shelfCompletionDateParts(item.entry)
    const yearKey = parts ? String(parts.year) : 'undated'
    const monthKey = parts ? `${parts.year}-${String(parts.month).padStart(2, '0')}` : 'undated'
    const yearGroup = yearGroups.get(yearKey) || {
      key: yearKey,
      year: parts?.year ?? null,
      count: 0,
      months: new Map<string, { key: string; month: number | null; items: ShelfBookItem[] }>(),
    }
    const monthGroup = yearGroup.months.get(monthKey) || {
      key: monthKey,
      month: parts?.month ?? null,
      items: [],
    }

    monthGroup.items.push(item)
    yearGroup.months.set(monthKey, monthGroup)
    yearGroup.count += 1
    yearGroups.set(yearKey, yearGroup)
  })

  return Array.from(yearGroups.values())
    .sort((a, b) => {
      if (a.year === null) return 1
      if (b.year === null) return -1
      return b.year - a.year
    })
    .map(group => ({
      ...group,
      months: Array.from(group.months.values()).sort((a, b) => {
        if (a.month === null) return 1
        if (b.month === null) return -1
        return b.month - a.month
      }),
    }))
}

function postViewCount(post: Post) {
  return Math.max(post.views?.length || 0, post.viewCount || 0)
}

function isCompletedStatus(status?: BookStatus) {
  return status === 'read' || status === 'favorite'
}

function hasFullBookAccessStatus(status?: BookStatus) {
  return isCompletedStatus(status) || status === 'rereading'
}

function isInProgressStatus(status?: BookStatus) {
  return status === 'reading' || status === 'rereading'
}

function startOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function daysAgo(days: number) {
  const date = startOfToday()
  date.setDate(date.getDate() - days)
  return date
}

function isTodayIso(value: string) {
  return new Date(value).getTime() >= startOfToday().getTime()
}

function isSinceIso(value: string, date: Date) {
  return new Date(value).getTime() >= date.getTime()
}

function visibleChapterForEntry(book: Book, entry?: ShelfEntry) {
  if (!entry) return 1
  if (hasFullBookAccessStatus(entry.status)) return book.totalChapters
  return chapterFromPercent(book, entry.progress)
}

function unlockedPostCountForRange(posts: Post[], bookId: string, fromChapter: number, toChapter: number) {
  if (toChapter < fromChapter) return 0
  return posts.filter(post => post.bookId === bookId && post.chapter >= fromChapter && post.chapter <= toChapter).length
}

function buildWeeklySpotlights(users: User[], books: Book[], posts: Post[], shelf: ShelfEntry[]): WeeklySpotlight[] {
  const weekStart = daysAgo(6)
  const weeklyPosts = posts.filter(post => isSinceIso(post.timestamp, weekStart))
  const byBook = new Map<string, number>()
  const byUser = new Map<string, number>()
  const byReaction = new Map<string, number>()

  weeklyPosts.forEach(post => {
    byBook.set(post.bookId, (byBook.get(post.bookId) || 0) + 1)
    byUser.set(post.userId, (byUser.get(post.userId) || 0) + 1)
    if (post.reactionEmoji) byReaction.set(post.reactionEmoji, (byReaction.get(post.reactionEmoji) || 0) + 1)
  })

  const bestBook = [...byBook.entries()].sort((a, b) => b[1] - a[1])[0]
  const bestUser = [...byUser.entries()].sort((a, b) => b[1] - a[1])[0]
  const bestReaction = [...byReaction.entries()].sort((a, b) => b[1] - a[1])[0]
  const bestTheory = weeklyPosts
    .filter(post => post.type === 'theory')
    .sort((a, b) => b.likes.length - a.likes.length || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
  const mostReadBook = books
    .map(book => ({
      book,
      readers: shelf.filter(entry => entry.bookId === book.id && isInProgressStatus(entry.status)).length,
    }))
    .sort((a, b) => b.readers - a.readers || a.book.title.localeCompare(b.book.title, 'pt-BR'))[0]

  const rows: WeeklySpotlight[] = []
  if (bestBook) {
    const book = books.find(book => book.id === bestBook[0])
    if (book) rows.push({ key: 'book', label: 'Livro da semana', title: book.title, detail: `${bestBook[1]} posts nos últimos 7 dias`, bookId: book.id })
  }
  if (bestTheory) {
    const book = books.find(book => book.id === bestTheory.bookId)
    rows.push({ key: 'theory', label: 'Teoria em alta', title: book?.title || 'Teoria da comunidade', detail: `${bestTheory.likes.length} curtidas · cap. ${bestTheory.chapter}`, bookId: bestTheory.bookId, userId: bestTheory.userId })
  }
  if (bestReaction) rows.push({ key: 'reaction', label: 'Reação da semana', title: bestReaction[0], detail: `${bestReaction[1]} usos nos feeds literários` })
  if (bestUser) {
    const user = users.find(user => user.id === bestUser[0])
    if (user) rows.push({ key: 'reader', label: 'Leitor em destaque', title: user.name, detail: `${bestUser[1]} posts esta semana`, userId: user.id })
  }
  if (mostReadBook?.readers) rows.push({ key: 'club', label: 'Clube mais vivo', title: mostReadBook.book.title, detail: `${mostReadBook.readers} lendo agora`, bookId: mostReadBook.book.id })

  return rows.slice(0, 5)
}

function buildSmartNudges(currentUser: User, books: Book[], shelf: ShelfEntry[], posts: Post[], readingGoal?: ReadingGoal): SmartNudge[] {
  const myShelf = shelf.filter(entry => entry.userId === currentUser.id)
  const readingNow = myShelf
    .filter(entry => isInProgressStatus(entry.status))
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId) }))
    .filter((item): item is { entry: ShelfEntry; book: Book } => Boolean(item.book))
  const myPostsToday = posts.filter(post => post.userId === currentUser.id && isTodayIso(post.timestamp))
  const nudges: SmartNudge[] = []

  if (readingGoal && !readingGoal.checkedInToday) {
    nudges.push({
      key: 'checkin',
      title: 'Sua sequência precisa de hoje',
      detail: `${readingGoal.currentStreak} dias seguidos. Faça check-in depois de ler qualquer trecho.`,
      action: 'checkin',
    })
  }

  if (!myPostsToday.length && readingNow.length) {
    const next = readingNow[0]
    nudges.push({
      key: 'post-today',
      title: 'Registre a reação de hoje',
      detail: `${next.book.title} está no cap. ${chapterFromPercent(next.book, next.entry.progress)}.`,
      bookId: next.book.id,
      action: 'post',
    })
  }

  const unlockCandidate = readingNow
    .map(({ entry, book }) => {
      const chapter = chapterFromPercent(book, entry.progress)
      return {
        book,
        count: posts.filter(post => post.bookId === book.id && post.userId !== currentUser.id && post.chapter <= chapter).length,
        chapter,
      }
    })
    .sort((a, b) => b.count - a.count)[0]
  if (unlockCandidate && unlockCandidate.count > 0) {
    nudges.push({
      key: 'unlocked',
      title: 'Comentários liberados esperando por você',
      detail: `${unlockCandidate.count} posts já visíveis até o cap. ${unlockCandidate.chapter}.`,
      bookId: unlockCandidate.book.id,
    })
  }

  return nudges.slice(0, 3)
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

type ConfirmPromptOptions = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

type ConfirmPromptState = ConfirmPromptOptions & {
  resolve: (confirmed: boolean) => void
}

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
      <form onSubmit={submit} className="w-full max-w-sm min-w-0 overflow-hidden rounded-lg border border-stone-800 bg-stone-900 p-4 shadow-2xl shadow-black/40">
        <div className="mb-4">
          <h2 className="font-serif text-xl text-stone-50">{prompt.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-400">{prompt.description}</p>
        </div>
        <label className="block min-w-0 text-sm font-semibold text-stone-300">
          Data
          <input
            autoFocus
            type="date"
            value={value}
            onChange={e => {
              setValue(e.target.value)
              setError('')
            }}
            className="folio-date-input folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
          />
        </label>
        {error && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</p>}
        <div className="mt-5 flex min-w-0 flex-wrap justify-end gap-2">
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

function ConfirmPromptDialog({ prompt, onConfirm, onCancel }: {
  prompt: ConfirmPromptState
  onConfirm: () => void
  onCancel: () => void
}) {
  const isDanger = prompt.tone === 'danger'
  const confirmClass = isDanger
    ? 'bg-red-400 text-stone-950 hover:bg-red-300'
    : 'bg-amber-300 text-stone-950 hover:bg-amber-200'

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center" onClick={e => e.currentTarget === e.target && onCancel()}>
      <section className="w-full max-w-sm rounded-lg border border-stone-800 bg-stone-900 p-4 shadow-2xl shadow-black/40">
        <div className="mb-5">
          <h2 className="font-serif text-xl text-stone-50">{prompt.title}</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-400">{prompt.description}</p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-bold text-stone-400 hover:bg-stone-800">
            {prompt.cancelLabel || 'Cancelar'}
          </button>
          <button type="button" autoFocus onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${confirmClass}`}>
            {prompt.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </section>
    </div>
  )
}

function useConfirmPrompt() {
  const [prompt, setPrompt] = useState<ConfirmPromptState | null>(null)

  function askConfirm(options: ConfirmPromptOptions) {
    return new Promise<boolean>(resolve => {
      setPrompt({ ...options, resolve })
    })
  }

  const confirmPromptDialog = prompt ? (
    <ConfirmPromptDialog
      prompt={prompt}
      onCancel={() => {
        prompt.resolve(false)
        setPrompt(null)
      }}
      onConfirm={() => {
        prompt.resolve(true)
        setPrompt(null)
      }}
    />
  ) : null

  return { askConfirm, confirmPromptDialog }
}

async function datesForShelfStatus(status: BookStatus, entry: ShelfEntry | undefined, askDate: AskShelfDate) {
  const changes: Partial<ShelfEntry> = {}
  if (isInProgressStatus(status) && !dateInputValue(entry?.startDate)) {
    const startDate = await askDate({
      title: 'Início da leitura',
      description: 'Essa data ajuda a organizar sua estante e deixa o histórico de leitura mais fiel.',
      fallback: localDateKey(),
    })
    if (!startDate) return null
    changes.startDate = startDate
  }
  if (isCompletedStatus(status)) {
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
  return isCompletedStatus(status) || status === 'rereading' || status === 'abandoned'
}

function canPostWithStatus(status?: BookStatus) {
  return isInProgressStatus(status) || isCompletedStatus(status) || status === 'abandoned'
}

function newestFirst<T extends { timestamp: string }>(a: T, b: T) {
  return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
}

function topReadTerms(userId: string, shelf: ShelfEntry[], books: Book[], field: 'genres' | 'tropes') {
  const counts = new Map<string, number>()
  shelf
    .filter(entry => entry.userId === userId && (isCompletedStatus(entry.status) || entry.status === 'rereading'))
    .forEach(entry => {
      const book = books.find(item => item.id === entry.bookId)
      const terms = field === 'genres' ? book?.genres : book?.tropes
        ; (terms || []).forEach(term => counts.set(term, (counts.get(term) || 0) + 1))
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

function formatDateTime(ts: string) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return 'agora'
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
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

function equalUint8Array(a?: ArrayBuffer | null, b?: Uint8Array | null) {
  if (!a || !b) return false
  const left = new Uint8Array(a)
  if (left.length !== b.length) return false
  return left.every((value, index) => value === b[index])
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
  if (!keyResponse.publicKey || keyResponse.publicKey.trim().toLowerCase().startsWith('sua_')) return 'missing-key' as const

  const applicationServerKey = urlBase64ToUint8Array(keyResponse.publicKey)
  const existingSubscription = await registration.pushManager.getSubscription()
  if (existingSubscription && !equalUint8Array(existingSubscription.options.applicationServerKey, applicationServerKey)) {
    await existingSubscription.unsubscribe()
  }

  const currentSubscription = await registration.pushManager.getSubscription()
  const subscription = currentSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  })

  await apiRequest('/folio/notifications/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  }, token)

  return 'saved' as const
}

function notificationBookCommentText(status?: BookStatus) {
  if (status === 'reading' || status === 'rereading') return 'comentou no livro que você está lendo'
  if (status === 'read' || status === 'favorite') return 'comentou em um livro que você já leu'
  if (status === 'abandoned') return 'comentou em um livro que você abandonou'
  if (status === 'want') return 'comentou em um livro da sua estante'
  return 'comentou em um livro'
}

function notificationTypeText(type: FolioNotification['type'], status?: BookStatus) {
  const textByType: Record<FolioNotification['type'], string> = {
    follow: 'começou a seguir você',
    like: 'curtiu sua publicação',
    reply: 'comentou na sua publicação',
    reply_like: 'curtiu seu comentário',
    reply_reply: 'respondeu seu comentário',
    book_comment: notificationBookCommentText(status),
    mention: 'mencionou você',
  }
  return textByType[type]
}

function notificationShelfStatus(notification: FolioNotification, currentUser: User | null | undefined, shelf: ShelfEntry[]) {
  if (!currentUser || !notification.bookId) return undefined
  return shelf.find(item => item.userId === currentUser.id && item.bookId === notification.bookId)?.status
}

function notificationBody(notification: FolioNotification, users: User[], books: Book[], currentUser?: User | null, shelf: ShelfEntry[] = []) {
  const user = users.find(item => item.id === notification.userId)
  const book = notification.bookId ? books.find(item => item.id === notification.bookId) : null
  const actor = user?.name || 'Alguém'
  const bookText = book ? ` em ${book.title}` : ''
  const chapterText = notification.chapter ? ` · cap. ${notification.chapter}` : ''
  return `${actor} ${notificationTypeText(notification.type, notificationShelfStatus(notification, currentUser, shelf))}${bookText}${chapterText}`
}

function notificationTargetUrl(notification: FolioNotification) {
  if (!notification.bookId) return '/?page=notifications'

  const params = new URLSearchParams({ page: 'book', bookId: notification.bookId })
  if (notification.postId) params.set('postId', notification.postId)
  return `/?${params.toString()}`
}

function canDisplayNotification(notification: FolioNotification, currentUser: User, shelf: ShelfEntry[], books: Book[]) {
  if (notification.type !== 'book_comment') return true
  if (!notification.bookId) return true

  const entry = shelf.find(item => item.userId === currentUser.id && item.bookId === notification.bookId)
  const book = books.find(item => item.id === notification.bookId)
  if (!entry || !book) return false

  if (hasFullBookAccessStatus(entry.status)) {
    return true
  }

  if (entry.status === 'reading') {
    return !notification.chapter || notification.chapter <= chapterFromPercent(book, entry.progress)
  }

  if (entry.status === 'abandoned') {
    return !notification.chapter || notification.chapter <= chapterFromPercent(book, entry.progress)
  }

  return false
}

async function showDeviceNotification(notification: FolioNotification, users: User[], books: Book[], currentUser: User, shelf: ShelfEntry[]) {
  if (deviceNotificationStatus() !== 'granted') return
  const registration = await registerDeviceNotificationWorker()
  const targetUrl = notificationTargetUrl(notification)
  const options: NotificationOptions = {
    body: notificationBody(notification, users, books, currentUser, shelf),
    icon: '/icons/icon-192.png',
    badge: '/icons/notification-badge.png',
    tag: `folio-${notification.id}`,
    data: { url: targetUrl },
  }

  if (registration) {
    await registration.showNotification('Entrelinhas', options)
    return
  }

  const fallback = new Notification('Entrelinhas', options)
  fallback.onclick = () => {
    window.focus()
    window.location.href = targetUrl
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
    <FolioImage src={user.avatar} alt={user.name} className={`${sizes[size]} shrink-0 select-none rounded-full object-cover`} />
  ) : (
    <div className={`${sizes[size]} flex shrink-0 select-none items-center justify-center rounded-full bg-amber-700 font-semibold text-amber-50`}>
      {user.avatar}
    </div>
  )
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <FolioImage src={BRAND_LOGO_URL} alt={BRAND_NAME || 'Entrelinhas'} loading="eager" className={`${compact ? 'h-12 w-12' : 'h-56 w-56 sm:h-72 sm:w-72'} rounded-lg object-cover`} />
      <span className={`${compact ? 'text-xl' : 'text-7xl sm:text-8xl'} font-serif text-amber-300`}>{BRAND_NAME}</span>
    </div>
  )
}

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`folio-skeleton ${className}`} aria-hidden="true" />
}

function FeedCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <article className="border-b border-stone-800 px-4 py-4 md:px-5" aria-label="Carregando publicação">
      <div className="flex gap-3">
        <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <SkeletonBlock className="h-3 w-28 rounded" />
            <SkeletonBlock className="h-3 w-16 rounded" />
          </div>
          <SkeletonBlock className="mb-3 h-3 w-10/12 rounded" />
          <SkeletonBlock className="mb-3 h-3 w-7/12 rounded" />
          {!compact && <SkeletonBlock className="mb-3 aspect-square max-h-[520px] w-full rounded-lg border border-stone-800" />}
          <div className="mb-3 flex gap-4">
            <SkeletonBlock className="h-6 w-6 rounded-md" />
            <SkeletonBlock className="h-6 w-6 rounded-md" />
            <SkeletonBlock className="h-6 w-6 rounded-md" />
          </div>
          <SkeletonBlock className="h-3 w-5/12 rounded" />
        </div>
      </div>
    </article>
  )
}

function AppLoadingScreen() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center">
        <div className="flex items-center gap-3 border-b border-stone-800 px-4 py-4">
          <FolioImage src={BRAND_LOGO_URL} alt={BRAND_NAME || 'Entrelinhas'} loading="eager" className="h-12 w-12 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <SkeletonBlock className="h-4 w-36 rounded" />
            <SkeletonBlock className="mt-2 h-3 w-24 rounded" />
          </div>
        </div>
        <FeedCardSkeleton />
        <FeedCardSkeleton compact />
      </div>
    </div>
  )
}

function ServiceUnavailableNotice({ notice, onRetry, onLogout }: { notice: ServiceNotice; onRetry: () => void; onLogout: () => void }) {
  return (
    <main className="min-h-screen bg-stone-950 px-4 py-6 text-stone-100 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col items-center justify-center gap-5 text-center sm:min-h-[calc(100vh-5rem)]">
        <FolioImage src={BRAND_LOGO_URL} alt={BRAND_NAME || 'Entrelinhas'} loading="eager" className="h-32 w-32 rounded-lg object-cover sm:h-40 sm:w-40" />
        <article className="w-full rounded-lg border border-stone-800 bg-stone-900/70 p-5 text-left shadow-2xl shadow-stone-800/20 sm:p-7">
          <p className="text-center text-xs font-bold uppercase text-amber-300 sm:text-sm">{notice.eyebrow}</p>
          <h1 className="mt-3 text-center font-serif text-2xl font-semibold leading-tight text-stone-50 sm:text-4xl">{notice.title}</h1>
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-stone-400 sm:text-base">
            {notice.paragraphs.map(paragraph => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>
        <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row sm:justify-center">
          <button onClick={onRetry} className="rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-200">
            {notice.retryLabel}
          </button>
          <button onClick={onLogout} className="rounded-lg border border-stone-700 px-4 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-stone-500">
            {notice.logoutLabel}
          </button>
        </div>
      </section>
    </main>
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
        <h1 className="pr-14 font-serif text-lg text-stone-100">{title}</h1>
        {children && <div className="pt-2">{children}</div>}
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

type NavIconName = 'home' | 'library' | 'goals' | 'notifications' | 'shelf' | 'profile' | 'dashboard' | 'store' | 'ai'

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
    dashboard: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-7" /><path d="M19 7l-3-3-4 4-3-2-4 5" /></>,
    store: <><path d="M5 10h14l-1 10H6z" /><path d="M8 10a4 4 0 0 1 8 0" /><path d="M9 14h.01" /><path d="M15 14h.01" /></>,
    ai: <><path d="M12 3v3" /><path d="M12 18v3" /><path d="M4.8 7.2 7 9.4" /><path d="m17 14.6 2.2 2.2" /><path d="M3 12h3" /><path d="M18 12h3" /><rect x="7" y="7" width="10" height="10" rx="2.5" /><path d="M10 11h.01" /><path d="M14 11h.01" /><path d="M10 14.5h4" /></>,
  }

  return <svg {...common}>{paths[name]}</svg>
}

function QuickActionIcon({ name, className = 'h-5 w-5' }: { name: 'plus' | 'close'; className?: string }) {
  const paths = {
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  }

  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={3}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
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

function MobileQuickActions({ theme, onToggleTheme, onCreatePost, onOpenStore }: {
  theme: ColorTheme
  onToggleTheme: () => void
  onCreatePost: () => void
  onOpenStore?: () => void
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
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-stone-950/10">
              <QuickActionIcon name="plus" className="h-4 w-4" />
            </span>
            Publicar
          </button>
          {onOpenStore && (
            <button
              type="button"
              onClick={() => runAction(onOpenStore)}
              className="flex items-center gap-2 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-left text-sm font-bold text-stone-200 transition hover:bg-stone-800 hover:text-stone-100"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-800"><NavIcon name="store" /></span>
              Loja
            </button>
          )}
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
        <QuickActionIcon name={open ? 'close' : 'plus'} className="h-7 w-7" />
      </button>
    </div>
  )
}

function Navigation({ currentUser, page, theme, onToggleTheme, onNavigate, onCreatePost, onLogout }: {
  currentUser: User
  page: Page
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
    { id: 'shelf', icon: 'shelf', label: 'Estante' },
    { id: 'profile', icon: 'profile', label: 'Perfil' },
  ]
  if (isSuperAdminUser(currentUser)) {
    navItems.splice(3, 0, { id: 'superadmin', icon: 'dashboard', label: 'Painel' })
    navItems.splice(4, 0, { id: 'store', icon: 'store', label: 'Loja' })
    if (AI_LAB_FRONTEND_ENABLED) {
      navItems.splice(5, 0, { id: 'ai-lab', icon: 'ai', label: 'IA' })
    }
  }
  const mobileNavItems = navItems.filter(item => item.id !== 'store')

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
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${page === item.id || (item.id === 'profile' && page === 'profile-list') ? 'bg-amber-300/10 text-amber-300' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
                }`}
            >
              <span className="flex w-5 items-center justify-center"><NavIcon name={item.icon} /></span>
              {item.label}
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

      <MobileQuickActions theme={theme} onToggleTheme={onToggleTheme} onCreatePost={onCreatePost} onOpenStore={isSuperAdminUser(currentUser) ? () => onNavigate('store') : undefined} />

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-800 bg-stone-950/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md items-center gap-1" style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))` }}>
          {mobileNavItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex min-h-12 flex-col items-center justify-center rounded-lg px-0.5 text-[10px] font-semibold sm:text-[11px] ${page === item.id || (item.id === 'profile' && page === 'profile-list') ? 'bg-amber-300/10 text-amber-300' : 'text-stone-500'
                }`}
            >
              <span className="mb-0.5 flex items-center justify-center"><NavIcon name={item.icon} /></span>
              <span className="max-w-full truncate">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}

function EngagementListDialog({ title, users, emptyText, onClose, onUserClick }: {
  title: string
  users: User[]
  emptyText: string
  onClose: () => void
  onUserClick: (id: string) => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center" onClick={e => e.currentTarget === e.target && onClose()}>
      <section className="w-full max-w-sm overflow-hidden rounded-lg border border-stone-800 bg-stone-900 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
          <h2 className="font-serif text-lg text-stone-100">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl leading-none text-stone-500 hover:bg-stone-800 hover:text-stone-100">×</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {users.length ? users.map(user => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                onClose()
                onUserClick(user.id)
              }}
              className="flex w-full items-center gap-3 border-b border-stone-800 px-4 py-3 text-left transition hover:bg-stone-800"
            >
              <Avatar user={user} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-stone-100">{user.name}</span>
                <span className="block truncate text-xs text-stone-500">@{user.handle}</span>
              </span>
            </button>
          )) : (
            <p className="px-4 py-8 text-center text-sm text-stone-500">{emptyText}</p>
          )}
        </div>
      </section>
    </div>
  )
}

function ReactionTrigger({ selectedType, total, disabled = false, label, onDefault, onSelect }: { selectedType?: ReactionType; total: number; disabled?: boolean; label: string; onDefault: () => void; onSelect: (type: ReactionType) => void }) {
  const [open, setOpen] = useState(false)
  const [burst, setBurst] = useState<{ key: number; type: ReactionType } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const pressTimerRef = useRef<number | null>(null)
  const longPressRef = useRef(false)

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const clearPress = () => {
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current)
    pressTimerRef.current = null
  }
  const startPress = () => {
    if (disabled) return
    longPressRef.current = false
    clearPress()
    pressTimerRef.current = window.setTimeout(() => {
      longPressRef.current = true
      setOpen(true)
    }, 420)
  }
  const triggerBurst = (type: ReactionType) => setBurst({ key: Date.now(), type })

  return (
    <div ref={rootRef} className="relative flex items-center gap-1" aria-label={label}>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={startPress}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onPointerCancel={clearPress}
        onSelectStart={event => event.preventDefault()}
        onContextMenu={event => event.preventDefault()}
        onClick={() => {
          if (longPressRef.current) {
            longPressRef.current = false
            return
          }
          if (!selectedType) triggerBurst('love')
          onDefault()
        }}
        aria-label={selectedType ? `Remover reação ${REPLY_REACTIONS.find(reaction => reaction.type === selectedType)?.label || ''}` : `Reagir. Mantenha pressionado para mais opções`}
        title="Toque para curtir · mantenha pressionado para reagir"
        className={`relative z-10 select-none leading-none transition active:scale-90 disabled:cursor-not-allowed disabled:opacity-50 ${selectedType ? 'text-[27px] drop-shadow-[0_0_7px_rgba(252,211,77,0.45)]' : 'text-stone-300 hover:text-red-300'}`}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      >
        {selectedType ? REPLY_REACTIONS.find(reaction => reaction.type === selectedType)?.emoji : (
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current stroke-[1.8]" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.8 8.6c0 5.4-8.8 10.1-8.8 10.1S3.2 14 3.2 8.6A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.8 1.9Z" />
          </svg>
        )}
        {burst && (
          <span key={burst.key} aria-hidden="true" className="folio-reaction-burst">
            {Array.from({ length: 5 }, (_, index) => <span key={index}>{REPLY_REACTIONS.find(reaction => reaction.type === burst.type)?.emoji}</span>)}
          </span>
        )}
      </button>
      {total > 0 && <span className="text-xs font-semibold text-stone-400">{total}</span>}
      {open && (
        <div role="menu" aria-label="Escolher reação" className="absolute bottom-[calc(100%+10px)] left-0 z-30 flex items-center gap-1 rounded-full border border-stone-700 bg-stone-900 px-2 py-1.5 shadow-xl shadow-black/50">
          {REPLY_REACTIONS.map(reaction => (
            <button
              key={reaction.type}
              type="button"
              role="menuitem"
              title={reaction.label}
              aria-label={reaction.label}
              onClick={() => {
                triggerBurst(reaction.type)
                onSelect(reaction.type)
                setOpen(false)
              }}
              className={`rounded-full px-1 text-2xl transition hover:-translate-y-1 hover:scale-125 ${selectedType === reaction.type ? 'bg-amber-300/20' : ''}`}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReplyReactionPicker({ reply, currentUserId, onToggle, onToggleLike, onShowLikes }: { reply: Reply; currentUserId: string; onToggle: (replyId: string, type: ReplyReactionType) => Promise<boolean | void> | boolean | void; onToggleLike: (replyId: string) => Promise<boolean | void> | boolean | void; onShowLikes?: () => void }) {
  const reactions = reply.reactions || []
  const legacyLiked = (reply.likes || []).includes(currentUserId)
  const selectedType = reactions.find(reaction => reaction.userId === currentUserId)?.type || (legacyLiked ? 'love' : undefined)
  const total = reactions.length + (reply.likes || []).length
  const select = (type: ReactionType) => type === 'love' && legacyLiked ? onToggleLike(reply.id) : onToggle(reply.id, type)
  return <ReactionTrigger selectedType={selectedType} total={total} label="Reações ao comentário" onDefault={() => selectedType ? (legacyLiked ? onToggleLike(reply.id) : onToggle(reply.id, selectedType)) : select('love')} onSelect={select} />
}

function PostCard({ post, users, books, currentUser, replies, shelf = [], onBookClick, onUserClick, onAddReply, onToggleLike, onToggleReaction, onToggleReplyLike, onToggleReplyReaction, onDeletePost, onDeleteReply, onEditPost, onEditReply, onViewPost, compactBook = false, protectSpoilers = false, spoilerChapterLimit, allowChapterLimitWithoutShelf = false, imageLoading = 'lazy' }: {
  post: Post
  users: User[]
  books: Book[]
  currentUser: User
  replies: Reply[]
  shelf?: ShelfEntry[]
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
  onAddReply: AddReplyHandler
  onToggleLike: (postId: string) => Promise<boolean | void> | boolean | void
  onToggleReaction: (postId: string, type: ReactionType) => Promise<boolean | void> | boolean | void
  onToggleReplyLike: (replyId: string) => Promise<boolean | void> | boolean | void
  onToggleReplyReaction: (replyId: string, type: ReplyReactionType) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onDeleteReply: (replyId: string) => Promise<boolean | void> | boolean | void
  onEditPost?: (post: Post) => void
  onEditReply?: (reply: Reply, text: string) => Promise<boolean | void> | boolean | void
  onViewPost?: (postId: string) => void
  compactBook?: boolean
  protectSpoilers?: boolean
  spoilerChapterLimit?: number
  allowChapterLimitWithoutShelf?: boolean
  imageLoading?: 'eager' | 'lazy'
}) {
  const articleRef = useRef<HTMLElement | null>(null)
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const [engagementDialog, setEngagementDialog] = useState<'likes' | 'views' | null>(null)
  const [replyEngagementDialog, setReplyEngagementDialog] = useState<{ title: string; users: User[]; emptyText: string } | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyingToReplyId, setReplyingToReplyId] = useState<string | null>(null)
  const [nestedReplyText, setNestedReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [submittingNestedReplyId, setSubmittingNestedReplyId] = useState<string | null>(null)
  const submittingReplyRef = useRef(false)
  const submittingNestedReplyRef = useRef<string | null>(null)
  const [spoilerAccepted, setSpoilerAccepted] = useState(false)
  const [expandedPostImage, setExpandedPostImage] = useState<string | null>(null)
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editingReplyText, setEditingReplyText] = useState('')
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null)
  const author = users.find(u => u.id === post.userId)!
  const book = books.find(b => b.id === post.bookId)
  const myEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === post.bookId)
  const myChapter = book && myEntry ? chapterFromPercent(book, myEntry.progress) : 0
  const safeChapterLimit = spoilerChapterLimit ?? myChapter
  const contentLabel = post.type === 'theory' ? 'Teoria' : 'Comentário'
  const isOwnPost = post.userId === currentUser.id
  const spoilerState =
    !protectSpoilers || isOwnPost || spoilerAccepted ? 'visible' :
      !myEntry && !allowChapterLimitWithoutShelf ? 'not-reading' :
        hasFullBookAccessStatus(myEntry?.status) ? 'visible' :
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
  const postReactions = post.reactions || []
  const selectedPostReaction = postReactions.find(reaction => reaction.userId === currentUser.id)?.type || (liked ? 'love' : undefined)
  const postReactionTotal = postReactions.length + post.likes.length
  const postContent = postTextParts(post.text)
  const likeUsers = uniqueUsersById(post.likes.map(id => users.find(user => user.id === id)).filter((user): user is User => Boolean(user)))
  const viewUsers = uniqueUsersById((post.views || []).map(id => users.find(user => user.id === id)).filter((user): user is User => Boolean(user)))
  const views = postViewCount(post)
  const engagementDialogs = {
    likes: { title: 'Curtidas', users: likeUsers, emptyText: 'Ninguém curtiu ainda.' },
    views: { title: 'Visualizações', users: viewUsers, emptyText: views ? 'A contagem existe, mas a lista de usuários ainda não veio da API.' : 'Ninguém visualizou ainda.' },
  }

  useEffect(() => {
    if (!onViewPost) return
    const element = articleRef.current
    if (!element) return

    if (!('IntersectionObserver' in window)) {
      onViewPost(post.id)
      return
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) {
        onViewPost(post.id)
        observer.disconnect()
      }
    }, { threshold: [0.5] })

    observer.observe(element)
    return () => observer.disconnect()
  }, [onViewPost, post.id])

  async function submitReply() {
    const trimmed = replyText.trim()
    if (!trimmed || submittingReplyRef.current) return
    submittingReplyRef.current = true
    setSubmittingReply(true)
    try {
      const mentionedUserIds = mentionedUsersFromText(trimmed, currentUser, users).map(user => user.id)
      const saved = await onAddReply(post.id, trimmed, undefined, mentionedUserIds)
      if (saved === false) return
      setReplyText('')
      setShowReplyBox(false)
    } finally {
      submittingReplyRef.current = false
      setSubmittingReply(false)
    }
  }

  async function submitNestedReply(parentReplyId: string) {
    const trimmed = nestedReplyText.trim()
    if (!trimmed || submittingNestedReplyRef.current) return
    submittingNestedReplyRef.current = parentReplyId
    setSubmittingNestedReplyId(parentReplyId)
    try {
      const mentionedUserIds = mentionedUsersFromText(trimmed, currentUser, users).map(user => user.id)
      const saved = await onAddReply(post.id, trimmed, parentReplyId, mentionedUserIds)
      if (saved === false) return
      setNestedReplyText('')
      setReplyingToReplyId(null)
    } finally {
      submittingNestedReplyRef.current = null
      setSubmittingNestedReplyId(null)
    }
  }

  async function saveReplyEdit(reply: Reply) {
    const text = editingReplyText.trim()
    if (!text || !onEditReply) return
    setSavingReplyId(reply.id)
    try {
      const saved = await onEditReply(reply, text)
      if (saved === false) return
      setEditingReplyId(null)
      setEditingReplyText('')
    } finally {
      setSavingReplyId(null)
    }
  }

  return (
    <article ref={articleRef} className="border-b border-stone-800 px-4 py-4 transition hover:bg-stone-900/35 md:px-5">
      <div className="flex gap-3">
        <Avatar user={author} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <button onClick={() => onUserClick(author.id)} className="text-sm font-bold text-stone-100 hover:text-amber-300">{author.name}</button>
            <button onClick={() => onUserClick(author.id)} className="text-sm text-stone-500 hover:text-stone-300">@{author.handle}</button>
            <span className="text-xs text-stone-600">{formatTime(post.timestamp)}</span>
            {post.editedAt && <span className="rounded-full border border-stone-600 bg-stone-800 px-2 py-0.5 text-[11px] font-semibold text-stone-400">Editado</span>}
            {post.type === 'theory' && <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-xs font-semibold text-violet-300">teoria</span>}
            {post.audience === 'tea' && <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-xs font-semibold text-amber-200">Comunidade do Chá</span>}
            {post.userId === currentUser.id && (
              <div className="ml-auto flex items-center gap-1">
                {onEditPost && <button onClick={() => onEditPost(post)} className="rounded px-2 py-0.5 text-xs font-bold text-amber-300 hover:bg-amber-300/10">Editar</button>}
                <button onClick={() => onDeletePost(post.id)} className="rounded px-2 py-0.5 text-xs font-bold text-red-300 hover:bg-red-400/10">Apagar</button>
              </div>
            )}
          </div>
          {book && !compactBook && (
            <button onClick={() => onBookClick(book.id)} className="mb-2 flex max-w-full items-center gap-2 text-left">
              <FolioImage src={book.cover} alt={book.title} className="h-8 w-6 shrink-0 rounded object-cover" />
              <span className="truncate text-xs font-semibold text-amber-300">{book.title}</span>
              <ChapterBadge chapter={post.chapter} />
            </button>
          )}
          {book && compactBook && <div className="mb-2"><ChapterBadge chapter={post.chapter} /></div>}
          {canInteractWithContent ? (
            <>
              {post.reactionEmoji && <div className="mb-2 text-3xl leading-none">{post.reactionEmoji}</div>}
              {postContent.text && <PostTextWithMentions text={postContent.text} users={users} onUserClick={onUserClick} />}
              {postContent.imageUrl && (
                <button
                  type="button"
                  onClick={() => setExpandedPostImage(postContent.imageUrl)}
                  className="group relative mb-3 block w-full cursor-zoom-in overflow-hidden rounded-lg border border-stone-800 bg-stone-950 text-left transition hover:border-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300/70"
                  aria-label="Abrir imagem da publicação"
                >
                  <FolioImage
                    src={postContent.imageUrl}
                    alt="Imagem da publicação"
                    loading={imageLoading}
                    className="folio-image-contain folio-post-image aspect-[4/3] max-h-[520px] w-full"
                  />
                  <span className="pointer-events-none absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-stone-950/80 text-base font-black leading-none text-stone-100 opacity-80 shadow-lg shadow-black/30 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    ↗
                  </span>
                </button>
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-stone-400">
            <div className="flex items-center gap-1">
              <ReactionTrigger
                selectedType={selectedPostReaction}
                total={postReactionTotal}
                disabled={!canInteractWithContent}
                label="Reações à publicação"
                onDefault={() => selectedPostReaction && !liked ? onToggleReaction(post.id, selectedPostReaction) : onToggleLike(post.id)}
                onSelect={type => {
                  if (type === 'love' && liked) return onToggleLike(post.id)
                  if (liked) void onToggleLike(post.id)
                  return onToggleReaction(post.id, type)
                }}
              />
              {isOwnPost && post.likes.length > 0 && <button onClick={() => setEngagementDialog('likes')} aria-label="Ver quem curtiu" className="sr-only">Ver quem curtiu</button>}
            </div>
            <button onClick={() => canInteractWithContent && setShowReplyBox(value => !value)} disabled={!canInteractWithContent} aria-label="Comentar" className="flex items-center gap-1 rounded-full p-1 text-stone-300 transition hover:bg-stone-800 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current stroke-[1.8]" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.3 8.3 0 0 1-8.8 8.2 9 9 0 0 1-4.1-1L3 20l1.5-4.1A7.8 7.8 0 0 1 3 11.5 8.3 8.3 0 0 1 11.8 3 8.3 8.3 0 0 1 21 11.5Z" /></svg>
              <span>{displayedComments}</span>
            </button>
            <div className="flex items-center gap-1 rounded-full p-1">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current stroke-[1.8]" strokeLinecap="round" strokeLinejoin="round"><path d="M2.8 12s3.3-6.2 9.2-6.2 9.2 6.2 9.2 6.2-3.3 6.2-9.2 6.2S2.8 12 2.8 12Z" /><circle cx="12" cy="12" r="2.7" /></svg>
              {isOwnPost ? <button onClick={() => setEngagementDialog('views')} aria-label="Ver visualizações" className="hover:text-amber-300">{views}</button> : <span>{views}</span>}
            </div>
          </div>
          {showReplyBox && canInteractWithContent && (
            <div className="mt-3 rounded-lg border border-stone-800 bg-stone-950 p-3">
              <MentionTextarea
                value={replyText}
                onChange={setReplyText}
                currentUser={currentUser}
                users={users}
                disabled={submittingReply}
                rows={2}
                placeholder="Responder a publicação..."
                className="w-full resize-none rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300 disabled:opacity-60"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button onClick={() => setShowReplyBox(false)} disabled={submittingReply} className="rounded-lg px-3 py-1.5 text-xs font-bold text-stone-500 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">Cancelar</button>
                <button onClick={submitReply} disabled={!replyText.trim() || submittingReply} className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">{submittingReply ? 'Enviando...' : 'Responder'}</button>
              </div>
            </div>
          )}
          {topLevelReplies.length > 0 && canInteractWithContent && (
            <div className="mt-3 space-y-2">
              {visibleReplies.map(reply => {
                const replyUser = users.find(user => user.id === reply.userId) || currentUser
                const replyLikes = reply.likes || []
                const replyHeartUserIds = [...replyLikes, ...(reply.reactions || []).filter(reaction => reaction.type === 'love').map(reaction => reaction.userId)]
                const replyLikeUsers = uniqueUsersById(replyHeartUserIds.map(id => users.find(user => user.id === id)).filter((user): user is User => Boolean(user)))
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
                          {reply.editedAt && <span className="text-[11px] font-semibold text-stone-500">Editado</span>}
                          {reply.userId === currentUser.id && (
                            <div className="flex gap-2"><button onClick={() => { setEditingReplyId(reply.id); setEditingReplyText(reply.text) }} className="text-xs font-bold text-amber-300 hover:text-amber-200">editar</button><button onClick={() => onDeleteReply(reply.id)} className="text-xs font-bold text-red-300 hover:text-red-200">apagar</button></div>
                          )}
                        </div>
                        {editingReplyId === reply.id ? <div className="mt-2"><MentionTextarea value={editingReplyText} onChange={setEditingReplyText} currentUser={currentUser} users={users} rows={3} disabled={savingReplyId === reply.id} className="w-full resize-none rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /><div className="mt-2 flex justify-end gap-2"><button onClick={() => setEditingReplyId(null)} className="rounded px-2 py-1 text-xs font-bold text-stone-400 hover:bg-stone-800">Cancelar</button><button onClick={() => saveReplyEdit(reply)} disabled={!editingReplyText.trim() || savingReplyId === reply.id} className="rounded bg-amber-300 px-2 py-1 text-xs font-bold text-stone-950 disabled:opacity-60">{savingReplyId === reply.id ? 'Salvando...' : 'Salvar'}</button></div></div> : <PostTextWithMentions text={reply.text} users={users} onUserClick={onUserClick} className="whitespace-pre-line text-sm leading-relaxed text-stone-400" />}
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          <ReplyReactionPicker reply={reply} currentUserId={currentUser.id} onToggle={onToggleReplyReaction} onToggleLike={onToggleReplyLike} onShowLikes={reply.userId === currentUser.id ? () => setReplyEngagementDialog({ title: 'Curtidas no comentário', users: replyLikeUsers, emptyText: 'Ninguém curtiu este comentário ainda.' }) : undefined} />
                          <button onClick={() => {
                            setReplyingToReplyId(value => value === reply.id ? null : reply.id)
                            setNestedReplyText('')
                          }} className="font-semibold text-stone-500 hover:text-amber-300">
                            responder {reply.comments || childReplies.length}
                          </button>
                        </div>
                        {replyingToReplyId === reply.id && (
                          <div className="mt-2 rounded-lg border border-stone-800 bg-stone-900 p-2">
                            <MentionTextarea
                              value={nestedReplyText}
                              onChange={setNestedReplyText}
                              currentUser={currentUser}
                              users={users}
                              disabled={submittingNestedReplyId === reply.id}
                              rows={2}
                              placeholder={`Responder @${replyUser.handle}...`}
                              className="w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300 disabled:opacity-60"
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <button onClick={() => {
                                setReplyingToReplyId(null)
                                setNestedReplyText('')
                              }} disabled={submittingNestedReplyId === reply.id} className="rounded-lg px-3 py-1.5 text-xs font-bold text-stone-500 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">Cancelar</button>
                              <button onClick={() => submitNestedReply(reply.id)} disabled={!nestedReplyText.trim() || Boolean(submittingNestedReplyId)} className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">{submittingNestedReplyId === reply.id ? 'Enviando...' : 'Responder'}</button>
                            </div>
                          </div>
                        )}
                        {visibleChildReplies.length > 0 && (
                          <div className="mt-2 space-y-2 border-l border-stone-800 pl-3">
                            {visibleChildReplies.map(child => {
                              const childUser = users.find(user => user.id === child.userId) || currentUser
                              const childLikes = child.likes || []
                              const childHeartUserIds = [...childLikes, ...(child.reactions || []).filter(reaction => reaction.type === 'love').map(reaction => reaction.userId)]
                              const childLikeUsers = uniqueUsersById(childHeartUserIds.map(id => users.find(user => user.id === id)).filter((user): user is User => Boolean(user)))
                              return (
                                <div key={child.id} className="flex gap-2">
                                  <button onClick={() => onUserClick(childUser.id)}><Avatar user={childUser} size="sm" /></button>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => onUserClick(childUser.id)} className="text-xs font-bold text-stone-200 hover:text-amber-300">@{childUser.handle}</button>
                                      {child.editedAt && <span className="text-[11px] font-semibold text-stone-500">Editado</span>}
                                      {child.userId === currentUser.id && (
                                        <div className="flex gap-2"><button onClick={() => { setEditingReplyId(child.id); setEditingReplyText(child.text) }} className="text-xs font-bold text-amber-300 hover:text-amber-200">editar</button><button onClick={() => onDeleteReply(child.id)} className="text-xs font-bold text-red-300 hover:text-red-200">apagar</button></div>
                                      )}
                                    </div>
                                    {editingReplyId === child.id ? <div className="mt-2"><MentionTextarea value={editingReplyText} onChange={setEditingReplyText} currentUser={currentUser} users={users} rows={3} disabled={savingReplyId === child.id} className="w-full resize-none rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" /><div className="mt-2 flex justify-end gap-2"><button onClick={() => setEditingReplyId(null)} className="rounded px-2 py-1 text-xs font-bold text-stone-400 hover:bg-stone-800">Cancelar</button><button onClick={() => saveReplyEdit(child)} disabled={!editingReplyText.trim() || savingReplyId === child.id} className="rounded bg-amber-300 px-2 py-1 text-xs font-bold text-stone-950 disabled:opacity-60">{savingReplyId === child.id ? 'Salvando...' : 'Salvar'}</button></div></div> : <PostTextWithMentions text={child.text} users={users} onUserClick={onUserClick} className="whitespace-pre-line text-sm leading-relaxed text-stone-400" />}
                                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                                      <ReplyReactionPicker reply={child} currentUserId={currentUser.id} onToggle={onToggleReplyReaction} onToggleLike={onToggleReplyLike} onShowLikes={child.userId === currentUser.id ? () => setReplyEngagementDialog({ title: 'Curtidas na resposta', users: childLikeUsers, emptyText: 'Ninguém curtiu esta resposta ainda.' }) : undefined} />
                                    </div>
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
      {engagementDialog && (
        <EngagementListDialog
          title={engagementDialogs[engagementDialog].title}
          users={engagementDialogs[engagementDialog].users}
          emptyText={engagementDialogs[engagementDialog].emptyText}
          onClose={() => setEngagementDialog(null)}
          onUserClick={onUserClick}
        />
      )}
      {replyEngagementDialog && (
        <EngagementListDialog
          title={replyEngagementDialog.title}
          users={replyEngagementDialog.users}
          emptyText={replyEngagementDialog.emptyText}
          onClose={() => setReplyEngagementDialog(null)}
          onUserClick={onUserClick}
        />
      )}
      {expandedPostImage && (
        <PostImageLightbox
          src={expandedPostImage}
          alt="Imagem ampliada da publicação"
          onClose={() => setExpandedPostImage(null)}
        />
      )}
    </article>
  )
}

function NotificationTopButton({ count, active, onClick }: { count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `${count} notificações não lidas` : 'Notificações'}
      className={`fixed right-3 top-2 z-[65] flex h-9 w-9 items-center justify-center rounded-full border bg-stone-950/95 backdrop-blur transition xl:right-[calc(22rem+0.75rem)] 2xl:right-[calc(24rem+0.75rem)] ${active ? 'border-amber-300 text-amber-300' : 'border-stone-700 text-stone-200 hover:border-amber-300/60 hover:text-amber-200'}`}
    >
      <NavIcon name="notifications" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-400 px-1 py-0.5 text-[9px] font-black leading-none text-stone-950">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

function PaginatedPostList({ posts, emptyText, resetKey, renderPost, initialVisibleCount = POST_PAGE_SIZE }: {
  posts: Post[]
  emptyText?: string
  resetKey: string
  renderPost: (post: Post, index: number) => React.ReactNode
  initialVisibleCount?: number
}) {
  const firstVisibleCount = Math.max(POST_PAGE_SIZE, initialVisibleCount)
  const [visibleCount, setVisibleCount] = useState(firstVisibleCount)
  const visiblePosts = posts.slice(0, visibleCount)
  const hiddenCount = Math.max(0, posts.length - visibleCount)

  useEffect(() => {
    setVisibleCount(firstVisibleCount)
  }, [resetKey, firstVisibleCount])

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

function DailyMissionPanel({ currentUser, books, shelf, posts, readingGoal, onCreatePost, onBookClick, onToggleReadingCheckIn }: {
  currentUser: User
  books: Book[]
  shelf: ShelfEntry[]
  posts: Post[]
  readingGoal: ReadingGoal
  onCreatePost: (bookId?: string) => void
  onBookClick: (id: string) => void
  onToggleReadingCheckIn: () => Promise<boolean | void> | boolean | void
}) {
  const myReading = shelf
    .filter(entry => entry.userId === currentUser.id && isInProgressStatus(entry.status))
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId) }))
    .filter((item): item is { entry: ShelfEntry; book: Book } => Boolean(item.book))
  const focus = myReading[0]
  const todayPosts = posts.filter(post => post.userId === currentUser.id && isTodayIso(post.timestamp))
  const completedCount = Number(readingGoal.checkedInToday) + Number(todayPosts.length > 0)
  const prompt = focus
    ? `Você está no cap. ${chapterFromPercent(focus.book, focus.entry.progress)} de ${focus.book.title}.`
    : 'Adicione um livro como Lendo para receber missões mais certeiras.'

  return (
    <section className="border-b border-stone-800 bg-stone-950 p-4 md:p-5">
      <div className="rounded-lg border border-amber-300/25 bg-stone-900 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Missão diária</p>
            <h2 className="mt-1 font-serif text-xl text-stone-50">Dê sinal de vida literário hoje</h2>
            <p className="mt-1 text-sm text-stone-400">{prompt}</p>
          </div>
          <span className="rounded-full border border-stone-700 px-3 py-1 text-xs font-black text-stone-300">{completedCount}/2 feito</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onToggleReadingCheckIn()}
            className={`rounded-lg border p-3 text-left transition ${readingGoal.checkedInToday ? 'border-emerald-300/40 bg-emerald-300/10' : 'border-stone-800 bg-stone-950 hover:border-amber-300/50'}`}
          >
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Check-in</span>
            <span className="mt-1 block text-sm font-bold text-stone-100">{readingGoal.checkedInToday ? 'Leitura marcada hoje' : 'Marcar leitura de hoje'}</span>
            <span className="mt-1 block text-xs text-stone-500">{readingGoal.currentStreak} dias seguidos</span>
          </button>
          <button
            type="button"
            onClick={() => focus ? onCreatePost(focus.book.id) : onCreatePost()}
            className={`rounded-lg border p-3 text-left transition ${todayPosts.length ? 'border-cyan-300/40 bg-cyan-300/10' : 'border-stone-800 bg-stone-950 hover:border-amber-300/50'}`}
          >
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Reação</span>
            <span className="mt-1 block text-sm font-bold text-stone-100">{todayPosts.length ? `${todayPosts.length} post hoje` : 'Postar uma reação rápida'}</span>
            <span className="mt-1 block text-xs text-stone-500">{focus ? 'O capítulo já vem sugerido.' : 'Escolha um livro da sua estante.'}</span>
          </button>
        </div>
        {focus && (
          <button onClick={() => onBookClick(focus.book.id)} className="mt-3 text-xs font-bold text-amber-300 hover:text-amber-200">
            Abrir feed anti-spoiler de {focus.book.title}
          </button>
        )}
      </div>
    </section>
  )
}

function SmartNudgesPanel({ nudges, onBookClick, onCreatePost, onToggleReadingCheckIn }: {
  nudges: SmartNudge[]
  onBookClick: (id: string) => void
  onCreatePost: (bookId?: string) => void
  onToggleReadingCheckIn: () => Promise<boolean | void> | boolean | void
}) {
  if (!nudges.length) return null

  return (
    <section className="border-b border-stone-800 p-4 md:p-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {nudges.map(nudge => (
          <button
            key={nudge.key}
            type="button"
            onClick={() => {
              if (nudge.action === 'checkin') void onToggleReadingCheckIn()
              else if (nudge.action === 'post') onCreatePost(nudge.bookId)
              else if (nudge.bookId) onBookClick(nudge.bookId)
            }}
            className="rounded-lg border border-stone-800 bg-stone-900 p-3 text-left transition hover:border-amber-300/50 hover:bg-stone-800"
          >
            <span className="block text-sm font-bold text-stone-100">{nudge.title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-stone-500">{nudge.detail}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function WeeklySpotlightsPanel({ rows, onBookClick, onUserClick }: {
  rows: WeeklySpotlight[]
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
}) {
  if (!rows.length) return null

  return (
    <section className="border-b border-stone-800 p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg text-stone-100">Destaques da semana</h2>
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">ranking vivo</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(row => (
          <button
            key={row.key}
            type="button"
            onClick={() => row.bookId ? onBookClick(row.bookId) : row.userId ? onUserClick(row.userId) : undefined}
            className="rounded-lg border border-stone-800 bg-stone-900 p-3 text-left transition hover:border-amber-300/50 hover:bg-stone-800"
          >
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">{row.label}</span>
            <span className="mt-1 block truncate text-base font-bold text-stone-100">{row.title}</span>
            <span className="mt-1 block text-xs text-stone-500">{row.detail}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

function TimelinePage({ currentUser, users, books, shelf, posts, replies, timeline, communityFeatureEnabled, communityPreviewEnabled = false, onBookClick, onUserClick, onAddReply, onToggleLike, onToggleReaction, onToggleReplyLike, onToggleReplyReaction, onDeletePost, onDeleteReply, onEditPost, onEditReply, onViewPost, onToggleFollow }: {
  currentUser: User
  users: User[]
  books: Book[]
  shelf: ShelfEntry[]
  posts: Post[]
  replies: Reply[]
  timeline: TimelineEvent[]
  communityFeatureEnabled: boolean
  communityPreviewEnabled?: boolean
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
  onAddReply: AddReplyHandler
  onToggleLike: (postId: string) => Promise<boolean | void> | boolean | void
  onToggleReaction: (postId: string, type: ReactionType) => Promise<boolean | void> | boolean | void
  onToggleReplyLike: (replyId: string) => Promise<boolean | void> | boolean | void
  onToggleReplyReaction: (replyId: string, type: ReplyReactionType) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onDeleteReply: (replyId: string) => Promise<boolean | void> | boolean | void
  onEditPost: (post: Post) => void
  onEditReply: (reply: Reply, text: string) => Promise<boolean | void> | boolean | void
  onViewPost: (postId: string) => void
  onToggleFollow: (userId: string) => Promise<boolean | void> | boolean | void
}) {
  const [tab, setTab] = useState<'posts' | 'activity'>('posts')
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'tea'>('all')
  const [readerQuery, setReaderQuery] = useState('')
  const feedPosts = useMemo(() => {
    const allowed = [...currentUser.following, currentUser.id]
    return posts
      .filter(post => allowed.includes(post.userId))
      .filter(post => !communityFeatureEnabled || audienceFilter === 'all' || post.audience === 'tea')
      .sort(newestFirst)
  }, [posts, currentUser.following, currentUser.id, audienceFilter, communityFeatureEnabled])
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
        <div className={`grid w-full ${communityFeatureEnabled ? 'grid-cols-3' : 'grid-cols-2'} rounded-lg bg-stone-900 p-1`}>
          <button onClick={() => { setTab('posts'); setAudienceFilter('all') }} className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-bold transition ${tab === 'posts' && audienceFilter === 'all' ? 'bg-amber-300 text-stone-950' : 'text-stone-400 hover:text-stone-200'}`}>
            Publicações
          </button>
          {communityFeatureEnabled && (
            <button onClick={() => { setTab('posts'); setAudienceFilter('tea') }} className={`min-h-9 rounded-md px-2 py-1.5 text-sm font-bold transition ${tab === 'posts' && audienceFilter === 'tea' ? 'bg-amber-300 text-stone-950 shadow-sm' : 'text-stone-400 hover:text-amber-200'}`}>
              Comunidade do Chá
            </button>
          )}
          <button onClick={() => setTab('activity')} className={`min-h-9 rounded-md px-3 py-1.5 text-sm font-bold transition ${tab === 'activity' ? 'bg-amber-300 text-stone-950' : 'text-stone-400 hover:text-stone-200'}`}>
            Atividade
          </button>
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
        <>
          {communityPreviewEnabled && audienceFilter === 'tea' && (
            <div className="space-y-3 px-4 pt-4">
              {[
                ['Marina', '@marinapagina', 'Acabei esse capítulo e preciso conversar sobre aquela pista!', 'A Hipótese do Amor', 12, 8, 7, 6, false],
                ['Clube do Chá', '@clubedochá', 'Qual foi a frase que vocês sublinharam hoje? A minha ainda está na cabeça.', 'A Biblioteca da Meia-Noite', 5, 3, 7, 14, false],
                ['Lia', '@liadeleituras', 'Leitura da noite garantida com chá de camomila e mais dois capítulos.', 'Os Sete Maridos de Evelyn Hugo', 19, 11, 3, 22, true],
              ].map(([name, handle, text, bookName, chapter, likes, comments, views, spoilerBlocked]) => (
                <article key={handle} className="border-b border-stone-800 px-4 py-4 transition hover:bg-stone-900/35">
                  <div className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-300 font-serif font-bold text-stone-950">{name[0]}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1"><span className="text-sm font-bold text-stone-100">{name}</span><span className="text-sm text-stone-500">{handle}</span><span className="text-xs text-stone-600">agora</span><span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-xs font-semibold text-amber-200">Comunidade do Chá</span></div>
                      <div className="mb-2 flex max-w-full items-center gap-2"><span className="h-8 w-6 shrink-0 rounded bg-stone-700" /><span className="truncate text-xs font-semibold text-amber-300">{bookName}</span><span className="rounded-full bg-stone-800 px-2 py-0.5 text-xs font-semibold text-stone-300">Cap. {chapter}</span></div>
                      {spoilerBlocked ? (
                        <div className="mb-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
                          <p className="text-sm font-bold text-amber-200">Comentário pode conter spoiler deste livro.</p>
                          <p className="mt-1 text-xs text-stone-400">Você ainda não adicionou este livro à estante, então o progresso não foi identificado.</p>
                          <button type="button" className="mt-3 rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-stone-950">Ver mesmo assim</button>
                        </div>
                      ) : <p className="text-sm text-stone-300">“{text}”</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"><span className="font-semibold text-stone-500">♡ {likes}</span><span className="font-semibold text-stone-500">comentar {comments}</span><span className="font-semibold text-stone-500">visualizações {views}</span></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <PaginatedPostList
            posts={feedPosts}
            emptyText={audienceFilter === 'tea' ? 'Ainda não há publicações na Comunidade do Chá.' : 'Nenhuma publicação de quem você segue ainda.'}
            resetKey={`timeline-${currentUser.id}-${audienceFilter}`}
            renderPost={(post, index) => <PostCard key={post.id} post={post} users={users} books={books} shelf={shelf} currentUser={currentUser} replies={replies} onBookClick={onBookClick} onUserClick={onUserClick} onAddReply={onAddReply} onToggleLike={onToggleLike} onToggleReaction={onToggleReaction} onToggleReplyLike={onToggleReplyLike} onToggleReplyReaction={onToggleReplyReaction} onDeletePost={onDeletePost} onDeleteReply={onDeleteReply} onEditPost={onEditPost} onEditReply={onEditReply} onViewPost={onViewPost} protectSpoilers imageLoading={index < 2 ? 'eager' : 'lazy'} />}
          />
        </>
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

function BookSearchRow({ book, actionLabel, onAction, secondaryLabel, onSecondaryAction, inactiveLabel, onInactiveAction, dangerLabel, onDangerAction, metaLabel, onOpen }: {
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
  onOpen?: () => void
}) {
  const summary = (
    <>
      {book.cover ? (
        <FolioImage src={book.cover} alt={book.title} loading="eager" className="h-12 w-8 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-stone-800 text-[10px] text-stone-500">Sem capa</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
          {metaLabel && <span className="rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">{metaLabel}</span>}
        </div>
        <p className="truncate text-xs text-stone-500">{book.author}</p>
        <p className="text-xs text-stone-600">{book.totalPages} págs. · {book.totalChapters} caps.{book.chaptersEstimated ? '' : ''}</p>
      </div>
    </>
  )

  return (
    <div className="flex items-center gap-3 rounded-lg bg-stone-950 p-2">
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left transition hover:bg-stone-900/60 focus:outline-none focus:ring-2 focus:ring-amber-300/50">
          {summary}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {summary}
        </div>
      )}
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

function BookSearchRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-stone-950 p-2" aria-label="Carregando livro">
      <SkeletonBlock className="h-12 w-8 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="h-3 w-8/12 rounded" />
        <SkeletonBlock className="mt-2 h-3 w-5/12 rounded" />
        <SkeletonBlock className="mt-2 h-3 w-4/12 rounded" />
      </div>
      <div className="hidden shrink-0 gap-2 sm:flex">
        <SkeletonBlock className="h-8 w-20 rounded-lg" />
        <SkeletonBlock className="h-8 w-24 rounded-lg" />
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
    rating: shelfEntry?.rating !== undefined ? String(shelfEntry.rating) : '',
    spiceRating: shelfEntry?.spiceRating !== undefined ? String(shelfEntry.spiceRating) : '',
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
  const customSelected = selected.filter(value => !options.some(option => choiceKey(option) === choiceKey(value)))
  const availableOptions = [...customSelected, ...options]
  const searchKey = choiceKey(query)
  const customValue = normalizeChoiceValue(query)
  const canAddCustom = Boolean(searchKey) &&
    !options.some(option => choiceKey(option) === searchKey) &&
    !selected.some(value => choiceKey(value) === searchKey)
  const filtered = availableOptions.filter(option => !searchKey || choiceKey(option).includes(searchKey))

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-stone-200">{title}</h4>
        <span className="text-xs text-stone-500">{selected.length} {countLabel}</span>
      </div>
      <input value={query} onChange={e => onQueryChange(e.target.value)} placeholder={searchLabel} className="mb-3 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" />
      <div className="grid max-h-60 gap-2 overflow-y-auto rounded-lg border border-stone-800 bg-stone-950 p-2 sm:grid-cols-2">
        {canAddCustom && (
          <button
            type="button"
            onClick={() => {
              onToggle(customValue)
              onQueryChange('')
            }}
            className="rounded-lg border border-amber-300 bg-amber-300/10 px-3 py-2 text-left text-xs font-bold text-amber-200 transition hover:bg-amber-300/20"
          >
            Adicionar "{customValue}"
          </button>
        )}
        {filtered.map(option => {
          const active = selected.some(value => choiceKey(value) === choiceKey(option))
          return (
            <button type="button" key={option} onClick={() => onToggle(option)} className={`rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${active ? 'border-amber-300 bg-amber-300/10 text-amber-200' : 'border-stone-800 bg-stone-900 text-stone-300 hover:border-stone-700'}`}>
              {option}
            </button>
          )
        })}
        {!filtered.length && !canAddCustom && (
          <p className="px-3 py-4 text-center text-xs text-stone-500 sm:col-span-2">Nenhuma opcao encontrada.</p>
        )}
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
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [error, setError] = useState('')
  const update = <K extends keyof BookFormDraft,>(key: K, value: BookFormDraft[K]) => setDraft(prev => ({ ...prev, [key]: value }))
  const toggleListValue = (key: 'genres' | 'tropes', value: string) => {
    const normalizedValue = normalizeChoiceValue(value)
    if (!normalizedValue) return
    setDraft(prev => ({
      ...prev,
      [key]: prev[key].some(item => choiceKey(item) === choiceKey(normalizedValue))
        ? prev[key].filter(item => choiceKey(item) !== choiceKey(normalizedValue))
        : [...prev[key], normalizedValue],
    }))
  }
  const totalPagesValue = Math.round(numberFromText(draft.totalPages))
  const totalChaptersValue = Math.round(numberFromText(draft.totalChapters, 1))
  const canSave = draft.title.trim().length > 0 && draft.author.trim().length > 0 && Boolean(coverFile || draft.cover.trim()) && totalPagesValue > 0 && totalChaptersValue > 0
  const coverPreviewSrc = coverPreviewUrl || draft.cover

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl)
    }
  }, [coverPreviewUrl])

  function replaceCoverPreviewUrl(url: string) {
    setCoverPreviewUrl(previous => {
      if (previous) URL.revokeObjectURL(previous)
      return url
    })
  }

  function removeCover() {
    replaceCoverPreviewUrl('')
    setCoverFile(null)
    setDraft(previous => ({
      ...previous,
      cover: '',
      coverFileName: '',
    }))
  }

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
    if (includeShelfFields && isInProgressStatus(status) && !draft.startDate) {
      setError('Informe a data de início da leitura.')
      setSaving(false)
      return
    }
    if (includeShelfFields && isCompletedStatus(status) && !draft.endDate) {
      setError('Informe a data de conclusão da leitura.')
      setSaving(false)
      return
    }
    const progress = isCompletedStatus(status) ? 100 : clamp(progressFromPage, 0, 100)
    const shelfData: Partial<ShelfEntry> = {
      status,
      progress,
      currentPage: isCompletedStatus(status) ? totalPages : currentPage,
      startDate: draft.startDate || undefined,
      endDate: draft.endDate || undefined,
      format: draft.format.trim() || undefined,
    }

    try {
      let cover = draft.cover.trim()
      if (coverFile) {
        setUploadingCover(true)
        cover = normalizeUploadedBookCoverUrl(await onUploadCover(coverFile))
        if (!cover) throw new Error('O servidor nao retornou a URL da capa.')
      }

      const book: Book = {
        id: initialBook?.id || `custom-${Date.now()}`,
        title: draft.title.trim(),
        author: draft.author.trim(),
        cover,
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

      const saved = await onSave(book, shelfData)
      if (saved === false) return
      onClose()
    } catch {
      setError('Nao foi possivel salvar este livro agora.')
    } finally {
      setUploadingCover(false)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center" onClick={e => e.currentTarget === e.target && onClose()}>
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
                  <input type="file" accept={IMAGE_UPLOAD_ACCEPT} className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (!isImageUpload(file)) {
                      setError('Envie uma imagem em JPG, PNG, WEBP ou GIF.')
                      e.currentTarget.value = ''
                      return
                    }
                    const localPreviewUrl = URL.createObjectURL(file)
                    replaceCoverPreviewUrl(localPreviewUrl)
                    setCoverFile(file)
                    update('coverFileName', file.name)
                    setError('')
                    e.currentTarget.value = ''
                  }} />
                </label>
                <p className="text-xs text-stone-500">{draft.coverFileName || 'Nenhum ficheiro selecionado'}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Previa da capa</p>
                {coverPreviewSrc ? <FolioImage src={coverPreviewSrc} alt="Previa da capa" loading="eager" className="h-40 w-28 rounded-lg object-cover" /> : <div className="flex h-40 w-28 items-center justify-center rounded-lg border border-stone-800 bg-stone-950 text-xs text-stone-600">Sem capa</div>}
                <button type="button" onClick={removeCover} className="mt-2 text-xs font-bold text-red-300 hover:text-red-200">Remover capa</button>
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
              {includeShelfFields && <label className="text-sm font-semibold text-stone-300">Status<select value={draft.status} onChange={e => update('status', e.target.value as BookStatus)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300">{SHELF_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>}
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
          <button onClick={() => save()} disabled={!canSave || saving || uploadingCover} className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">{uploadingCover ? 'Enviando capa...' : saving ? 'Salvando...' : 'Salvar livro'}</button>
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
  onUpdateShelfEntry: (bookId: string, changes: Partial<ShelfEntry>, feedback?: ActionFeedback, options?: UpdateShelfOptions) => Promise<boolean | void> | boolean | void
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
  const [collapsedDateGroups, setCollapsedDateGroups] = useState<Set<string>>(() => new Set())
  const { askDate, datePromptDialog } = useDatePrompt()
  const statuses = SHELF_STATUSES
  const myShelf = shelf.filter(s => s.userId === currentUser.id)
  const statusCounts = statuses.reduce((acc, status) => ({ ...acc, [status]: myShelf.filter(entry => entry.status === status).length }), {} as Record<BookStatus, number>)
  const filtered = myShelf
    .filter(entry => entry.status === activeStatus)
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)
    .sort(isCompletedStatus(activeStatus) ? readShelfNewestFirst : () => 0)
  const groupedByCompletionMonth = isCompletedStatus(activeStatus) ? groupShelfByCompletionMonth(filtered) : []

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
    const status = nextProgress >= 100 ? 'read' : isCompletedStatus(activeStatus) ? 'reading' : activeStatus
    const dateChanges = await datesForShelfStatus(status, filtered.find(item => item.book.id === book.id)?.entry, askDate)
    if (!dateChanges) return
    const saved = await onUpdateShelfEntry(book.id, {
      progress: nextProgress,
      status,
      ...dateChanges,
    }, {
      success: 'Progresso atualizado com sucesso.',
      error: 'Nao foi possivel atualizar o progresso.',
    }, {
      offerReadingCheckIn: true,
    })
    if (saved === false) return
    setEditingId(null)
  }

  function dateGroupKey(kind: 'year' | 'month', key: string) {
    return `${activeStatus}:${kind}:${key}`
  }

  function toggleDateGroup(key: string) {
    setCollapsedDateGroups(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function renderShelfCard({ entry, book }: ShelfBookItem) {
    return (
      <article key={book.id} className="overflow-hidden rounded-lg border border-stone-800 bg-stone-900">
        <button onClick={() => onBookClick(book.id)} className="grid w-full grid-cols-[92px_1fr] text-left sm:block">
          {book.cover ? (
            <FolioImage src={book.cover} alt={book.title} className="h-full min-h-36 w-full object-cover sm:h-48" />
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
                  progress: isCompletedStatus(status) ? 100 : entry.progress >= 100 ? 0 : entry.progress,
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
            ) : editingId === book.id && isInProgressStatus(entry.status) ? (
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
          {isInProgressStatus(entry.status) ? (
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
                {entry.rating !== undefined && <span className="text-amber-300">{ratingText(entry.rating)}</span>}
                {entry.spiceRating !== undefined && <span className="text-red-300">{ratingText(entry.spiceRating, 'pimentas')}</span>}
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
    )
  }

  return (
    <section>
      <Header title="Minha estante">
        <div className="folio-scrollbar-hidden flex gap-1 overflow-x-auto pb-1">
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
              {catalogLoading && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Resultados de busca</p>
                  {[0, 1, 2].map(item => <BookSearchRowSkeleton key={item} />)}
                </div>
              )}
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

      {isCompletedStatus(activeStatus) && filtered.length ? (
        <div className="space-y-8 p-4">
          {groupedByCompletionMonth.map(yearGroup => {
            const yearKey = dateGroupKey('year', yearGroup.key)
            const yearCollapsed = collapsedDateGroups.has(yearKey)
            return (
              <section key={yearGroup.key}>
                <button
                  type="button"
                  onClick={() => toggleDateGroup(yearKey)}
                  aria-expanded={!yearCollapsed}
                  className="mb-4 flex w-full items-end justify-between gap-3 border-b border-stone-800 pb-2 text-left transition hover:border-stone-700"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-sm text-stone-500">{yearCollapsed ? '▸' : '▾'}</span>
                    <span className="truncate font-serif text-2xl leading-none text-stone-100">{yearGroup.year ?? 'Sem data'}</span>
                  </span>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">{pluralBooks(yearGroup.count)}</span>
                </button>
                {!yearCollapsed && (
                  <div className="space-y-5">
                    {yearGroup.months.map(monthGroup => {
                      const monthKey = dateGroupKey('month', monthGroup.key)
                      const monthCollapsed = collapsedDateGroups.has(monthKey)
                      return (
                        <section key={monthGroup.key}>
                          <button
                            type="button"
                            onClick={() => toggleDateGroup(monthKey)}
                            aria-expanded={!monthCollapsed}
                            className="mb-3 flex w-full items-center justify-between gap-3 text-left transition hover:text-stone-100"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="w-4 shrink-0 text-xs text-stone-500">{monthCollapsed ? '▸' : '▾'}</span>
                              <span className="truncate text-sm font-bold text-stone-300">{monthGroup.month ? READ_MONTH_LABELS[monthGroup.month - 1] : 'Sem data de conclusão'}</span>
                            </span>
                            <span className="shrink-0 text-xs text-stone-500">{pluralBooks(monthGroup.items.length)}</span>
                          </button>
                          {!monthCollapsed && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {monthGroup.items.map(renderShelfCard)}
                            </div>
                          )}
                        </section>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(renderShelfCard)}
          {!filtered.length && <div className="sm:col-span-2 xl:col-span-3"><EmptyState text="Nenhum livro nessa categoria ainda." /></div>}
        </div>
      )}
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
  const [visibleBookCount, setVisibleBookCount] = useState(LIBRARY_PAGE_SIZE)
  const isAdmin = isAdminUser(currentUser)
  const myShelf = shelf.filter(entry => entry.userId === currentUser.id)
  const normalizedQuery = query.trim()
  const allMatchingBooks = useMemo(() => {
    const local = normalizedQuery
      ? books.filter(book => bookMatchesSearch(book, normalizedQuery, searchField))
      : books

    return mergeBooksById(local, searchResults)
      .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
  }, [books, normalizedQuery, searchField, searchResults])
  const visibleBooks = allMatchingBooks.slice(0, visibleBookCount)
  const hiddenBookCount = Math.max(0, allMatchingBooks.length - visibleBookCount)

  useEffect(() => {
    setVisibleBookCount(LIBRARY_PAGE_SIZE)
  }, [normalizedQuery, searchField, searchResults])

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
              {SHELF_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
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
        {loading && [0, 1, 2, 3].map(item => <BookSearchRowSkeleton key={`loading-${item}`} />)}
        {visibleBooks.map(book => {
          const registeredBook = books.some(item => item.id === book.id)
          const shelfEntry = myShelf.find(entry => entry.bookId === book.id)
          return (
            <BookSearchRow
              key={book.id}
              book={book}
              metaLabel={book.isActive === false ? 'Inativo' : shelfEntry ? 'Na estante' : registeredBook ? 'Biblioteca' : 'API Google Books'}
              onOpen={registeredBook ? () => onBookClick(book.id) : undefined}
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
        {hiddenBookCount > 0 && (
          <div className="pt-2 text-center">
            <button
              onClick={() => setVisibleBookCount(count => count + LIBRARY_PAGE_SIZE)}
              className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold text-stone-300 hover:bg-stone-900"
            >
              Ver mais {Math.min(LIBRARY_PAGE_SIZE, hiddenBookCount)}
            </button>
          </div>
        )}
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

function BookPage({ book, shelf, posts, replies, users, currentUser, highlightedPostId, onBack, onUserClick, onCreatePost, onAddReply, onToggleLike, onToggleReaction, onToggleReplyLike, onToggleReplyReaction, onDeletePost, onDeleteReply, onEditPost, onEditReply, onViewPost, onUpdateShelfEntry, onAddBook }: {
  book: Book
  shelf: ShelfEntry[]
  posts: Post[]
  replies: Reply[]
  users: User[]
  currentUser: User
  highlightedPostId?: string | null
  onBack: () => void
  onUserClick: (id: string) => void
  onCreatePost: (bookId?: string) => void
  onAddReply: AddReplyHandler
  onToggleLike: (postId: string) => Promise<boolean | void> | boolean | void
  onToggleReaction: (postId: string, type: ReactionType) => Promise<boolean | void> | boolean | void
  onToggleReplyLike: (replyId: string) => Promise<boolean | void> | boolean | void
  onToggleReplyReaction: (replyId: string, type: ReplyReactionType) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onDeleteReply: (replyId: string) => Promise<boolean | void> | boolean | void
  onEditPost: (post: Post) => void
  onEditReply: (reply: Reply, text: string) => Promise<boolean | void> | boolean | void
  onViewPost: (postId: string) => void
  onUpdateShelfEntry: (bookId: string, changes: Partial<ShelfEntry>, feedback?: ActionFeedback, options?: UpdateShelfOptions) => Promise<boolean | void> | boolean | void
  onAddBook: (bookId: string, status: BookStatus) => Promise<boolean | void> | boolean | void
}) {
  const [tab, setTab] = useState<BookTab>('feed')
  const [newShelfStatus, setNewShelfStatus] = useState<BookStatus>('reading')
  const [readersModalOpen, setReadersModalOpen] = useState(false)
  const [feedVisibility, setFeedVisibility] = useState<BookFeedVisibility>('all')
  const [unlockedRange, setUnlockedRange] = useState<{ from: number; to: number; count: number } | null>(null)
  const highlightedScrollKeyRef = useRef<string | null>(null)
  const { askDate, datePromptDialog } = useDatePrompt()
  const myEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === book.id)
  const myProgress = myEntry?.progress ?? 0
  const hasFullBookAccess = hasFullBookAccessStatus(myEntry?.status)
  const defaultChapter = hasFullBookAccess ? book.totalChapters : chapterFromPercent(book, myProgress)
  const [chapterLimit, setChapterLimit] = useState(defaultChapter)
  const [chapterInput, setChapterInput] = useState(String(defaultChapter))
  const readerRows = shelf
    .filter(entry => entry.bookId === book.id)
    .map(entry => ({ entry, user: users.find(user => user.id === entry.userId) }))
    .filter((item): item is { entry: ShelfEntry; user: User } => Boolean(item.user))
    .sort((a, b) => a.user.name.localeCompare(b.user.name, 'pt-BR'))
  const readers = readerRows.length
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
  const myReplayPosts = postsInBook
    .filter(post => post.userId === currentUser.id)
    .sort((a, b) => a.chapter - b.chapter || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const clubRoomRows = [
    { label: 'Começo', fromPercent: 0, toPercent: 25 },
    { label: 'Entrando fundo', fromPercent: 25, toPercent: 50 },
    { label: 'Virada', fromPercent: 50, toPercent: 75 },
    { label: 'Reta final', fromPercent: 75, toPercent: 100 },
  ].map(room => {
    const fromChapter = room.fromPercent <= 0 ? 1 : Math.min(book.totalChapters, chapterFromPercent(book, room.fromPercent) + 1)
    const toChapter = chapterFromPercent(book, room.toPercent)
    return {
      ...room,
      fromChapter,
      toChapter,
      readers: readerRows.filter(({ entry }) => {
        const chapter = visibleChapterForEntry(book, entry)
        return chapter >= fromChapter && chapter <= toChapter
      }).length,
      posts: postsInBook.filter(post => post.chapter >= fromChapter && post.chapter <= toChapter).length,
    }
  })
  const highlightedPost = highlightedPostId ? postsInBook.find(post => post.id === highlightedPostId) : undefined
  const highlightedList = highlightedPost?.type === 'theory' ? theories : comments
  const highlightedPostIndex = highlightedPost ? highlightedList.findIndex(post => post.id === highlightedPost.id) : -1
  const initialPostVisibleCount = highlightedPostIndex >= 0 ? highlightedPostIndex + 1 : POST_PAGE_SIZE
  const visibleChapterLimit = hasFullBookAccess ? book.totalChapters : chapterLimit
  const activeList = tab === 'theories' ? theories : comments
  const visibleActiveList = feedVisibility === 'available'
    ? activeList.filter(post => post.chapter <= visibleChapterLimit)
    : activeList
  const hiddenFuturePostCount = Math.max(0, activeList.length - visibleActiveList.length)
  const detailRows = [
    ['Série', book.series || 'Não informado'],
    ['Volume', book.volume || 'Não informado'],
    ['Idioma', book.language || 'Não informado'],
    ['Origem', book.source === 'googlebooks' ? 'Google Books' : book.source === 'manual' ? 'Cadastro manual' : book.source || 'Não informado'],
  ]
  const tropeList = book.tropes || []

  useEffect(() => {
    if (!highlightedPostId) {
      highlightedScrollKeyRef.current = null
      return
    }
    const targetPost = posts.find(post => post.id === highlightedPostId && post.bookId === book.id)
    if (!targetPost) return
    const scrollKey = `${book.id}:${targetPost.id}`
    if (highlightedScrollKeyRef.current === scrollKey) return
    highlightedScrollKeyRef.current = scrollKey

    setTab(targetPost.type === 'theory' ? 'theories' : 'feed')
    setChapterLimit(limit => hasFullBookAccess ? limit : Math.max(limit, targetPost.chapter))

    const timeoutId = window.setTimeout(() => {
      document.getElementById(`folio-post-${targetPost.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 140)

    return () => window.clearTimeout(timeoutId)
  }, [book.id, highlightedPostId, hasFullBookAccess, posts])

  return (
    <section>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-800 bg-stone-950/90 px-4 py-3 pr-16 backdrop-blur-xl md:px-5 md:pr-16">
        <button onClick={onBack} className="rounded-lg px-2 py-1 text-xl leading-none text-stone-400 hover:bg-stone-900 hover:text-stone-100">
          ←
        </button>
        <h1 className="min-w-0 truncate font-serif text-base text-stone-100">{book.title}</h1>
      </header>

      <div className="border-b border-stone-800 p-3 md:p-5">
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 sm:grid-cols-[132px_1fr] sm:gap-4">
          <FolioImage src={book.cover} alt={book.title} className="h-32 w-[5.5rem] rounded-lg object-cover sm:h-52 sm:w-full" />
          <div className="contents min-w-0 sm:block">
            <div className="min-w-0">
              <h2 className="font-serif text-xl leading-tight text-stone-50 sm:text-2xl">{book.title}</h2>
              <p className="mt-0.5 text-sm text-stone-400 sm:mt-1">{book.author}</p>
              <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-stone-500 sm:mt-3 sm:text-xs">
                <span className="font-bold text-amber-300">{platformRating}</span>
                <span className="font-bold text-red-300">{platformSpiceRating}</span>
                <span>{book.totalPages} páginas</span>
                <span>{book.totalChapters} capítulos{book.chaptersEstimated ? '' : ''}</span>
                <button
                  type="button"
                  onClick={() => setReadersModalOpen(true)}
                  disabled={!readers}
                  className="font-bold text-stone-500 transition hover:text-amber-300 disabled:cursor-default disabled:font-normal disabled:hover:text-stone-500"
                >
                  {readers} {readers === 1 ? 'leitor' : 'leitores'}
                </button>
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
                <div className="mt-3 grid grid-cols-2 rounded-lg bg-stone-950/70 p-1">
                  {([
                    ['all', 'Tudo'],
                    ['available', 'Só liberados'],
                  ] as const).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFeedVisibility(id)}
                      className={`rounded-md px-2 py-1.5 text-xs font-bold transition ${feedVisibility === id ? 'bg-amber-300 text-stone-950' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {feedVisibility === 'available' && hiddenFuturePostCount > 0 && (
                  <p className="mt-2 text-xs font-semibold text-amber-200">{hiddenFuturePostCount} {hiddenFuturePostCount === 1 ? 'post futuro oculto' : 'posts futuros ocultos'}</p>
                )}
              </div>
              <div className="folio-book-progress mt-2 rounded-lg border border-stone-800 bg-stone-900 p-2 sm:mt-3 sm:p-3">
                {myEntry ? (
                  <>
                    {isInProgressStatus(myEntry.status) ? (
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
                                  progress: isCompletedStatus(status) ? 100 : myEntry.progress >= 100 ? 0 : myEntry.progress,
                                  ...dateChanges,
                                })
                                if (hasFullBookAccessStatus(status)) {
                                  setChapterInput(String(book.totalChapters))
                                  setChapterLimit(book.totalChapters)
                                }
                              }}
                              className="folio-field-control mt-1 w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs font-bold normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
                            >
                              {SHELF_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
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
                          const previousChapter = visibleChapterForEntry(book, myEntry)
                          const nextProgress = percentFromChapter(book, Number(chapterInput))
                          const nextChapter = chapterFromPercent(book, nextProgress)
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
                          }, {
                            offerReadingCheckIn: true,
                          })
                          if (saved === false) return
                          setChapterLimit(nextChapter)
                          const unlockedCount = unlockedPostCountForRange(postsInBook, book.id, previousChapter + 1, nextChapter)
                          setUnlockedRange(unlockedCount > 0 ? { from: previousChapter + 1, to: nextChapter, count: unlockedCount } : null)
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
                              progress: isCompletedStatus(status) ? 100 : myEntry.progress >= 100 ? 0 : myEntry.progress,
                              ...dateChanges,
                            })
                            if (hasFullBookAccessStatus(status)) {
                              setChapterInput(String(book.totalChapters))
                              setChapterLimit(book.totalChapters)
                            }
                          }}
                          className="folio-field-control w-full min-w-0 max-w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-stone-100 outline-none focus:border-amber-300"
                        >
                          {SHELF_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
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
                      {SHELF_STATUSES.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                    </select>
                    <button onClick={() => onAddBook(book.id, newShelfStatus)} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">Adicionar à estante</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {unlockedRange && (
        <div className="fixed inset-x-3 top-16 z-40 mx-auto w-auto max-w-md rounded-xl border border-emerald-300/40 bg-stone-900 p-4 shadow-xl shadow-black/35 sm:left-auto sm:right-5 sm:mx-0" role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-300 text-sm font-bold text-stone-950" aria-hidden="true">✓</div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Novo trecho liberado</p>
              <p className="mt-1 text-sm font-semibold leading-snug text-stone-50">
                {unlockedRange.count} {unlockedRange.count === 1 ? 'post foi liberado' : 'posts foram liberados'} entre os capítulos {unlockedRange.from} e {unlockedRange.to}.
              </p>
            </div>
            <button type="button" onClick={() => setUnlockedRange(null)} className="-mr-1 -mt-1 rounded-md p-1 text-stone-300 transition hover:bg-stone-800 hover:text-white" aria-label="Fechar aviso de trecho liberado">
              ×
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 pl-11">
            <button
              type="button"
              onClick={() => {
                setFeedVisibility('available')
                setTab('feed')
                setUnlockedRange(null)
              }}
              className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-bold text-stone-950 transition hover:bg-emerald-200"
            >
              Ver posts
            </button>
            <button
              type="button"
              onClick={() => {
                setUnlockedRange(null)
                onCreatePost(book.id)
              }}
              className="rounded-lg border border-stone-600 px-3 py-2 text-xs font-bold text-stone-100 transition hover:bg-stone-800"
            >
              Postar reação
            </button>
          </div>
        </div>
      )}

      <div className="sticky top-[53px] z-10 grid grid-cols-5 border-b border-stone-800 bg-stone-950">
        {([['feed', 'Feed'], ['theories', 'Teorias'], ['rooms', 'Salas'], ['replay', 'Replay'], ['about', 'Sobre']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`border-b-2 px-1 py-3 text-xs font-bold transition sm:px-3 sm:text-sm ${tab === id ? 'border-amber-300 text-amber-300' : 'border-transparent text-stone-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'about' ? (
        <div className="space-y-4 p-4 md:p-5">
          <div>
            <h3 className="mb-2 font-serif text-lg text-stone-100">Sinopse</h3>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-300">{book.synopsis}</p>
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
            <button
              type="button"
              onClick={() => setReadersModalOpen(true)}
              disabled={!readers}
              className="rounded-lg border border-stone-800 bg-stone-900 p-3 text-center transition hover:border-amber-300/50 hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-300/50 disabled:cursor-default disabled:hover:border-stone-800 disabled:hover:bg-stone-900"
            >
              <div className="font-serif text-xl text-amber-300">{readers}</div>
              <div className="text-xs text-stone-500">{readers === 1 ? 'Leitor' : 'Leitores'}</div>
            </button>
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
      ) : tab === 'rooms' ? (
        <div className="space-y-4 p-4 md:p-5">
          <section className="rounded-lg border border-stone-800 bg-stone-900 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-stone-50">Clube da leitura</h2>
                <p className="mt-1 text-sm text-stone-500">Veja onde a leitura está mais viva por trecho do livro.</p>
              </div>
              <button onClick={() => onCreatePost(book.id)} className="rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-stone-950">
                Criar tópico
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {clubRoomRows.map(row => (
                <div key={`${row.fromPercent}-${row.toPercent}`} className="rounded-lg border border-stone-800 bg-stone-950 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">{row.fromPercent}-{row.toPercent}%</span>
                      <h3 className="mt-1 text-sm font-bold text-stone-100">{row.label}</h3>
                      <p className="mt-1 text-xs text-stone-500">Caps. {row.fromChapter}-{row.toChapter}</p>
                    </div>
                    <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs font-bold text-amber-200">
                      {row.readers} {row.readers === 1 ? 'leitor' : 'leitores'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-stone-900 p-2">
                      <p className="font-serif text-lg text-amber-300">{row.readers}</p>
                      <p className="text-[11px] text-stone-500">no trecho</p>
                    </div>
                    <div className="rounded-lg bg-stone-900 p-2">
                      <p className="font-serif text-lg text-amber-300">{row.posts}</p>
                      <p className="text-[11px] text-stone-500">posts</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : tab === 'replay' ? (
        <div className="space-y-4 p-4 md:p-5">
          <section className="rounded-lg border border-stone-800 bg-stone-900 p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-stone-50">Replay da leitura</h2>
                <p className="mt-1 text-sm text-stone-500">Suas publicações aparecem na ordem em que a história avançou.</p>
              </div>
              {hasFullBookAccess && <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-bold text-amber-200">livro liberado</span>}
            </div>
            {myReplayPosts.length ? (
              <div className="space-y-3">
                {myReplayPosts.map((post, index) => {
                  const parts = postTextParts(post.text)
                  return (
                    <article key={post.id} className="grid grid-cols-[3rem_1fr] gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3">
                      <div className="text-center">
                        <div className="font-serif text-xl text-amber-300">{index + 1}</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-stone-600">cap. {post.chapter}</div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">{post.type === 'theory' ? 'Teoria' : post.type === 'reaction' ? 'Reação' : 'Comentário'} · {formatDateTime(post.timestamp)}</p>
                        {post.reactionEmoji && <p className="mt-1 text-3xl leading-none">{post.reactionEmoji}</p>}
                        {parts.text && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-200">{parts.text}</p>}
                        <p className="mt-2 text-xs text-stone-600">{post.likes.length} curtidas · {post.comments} respostas</p>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-stone-800 bg-stone-950 p-4">
                <p className="text-sm text-stone-400">Você ainda não registrou nenhuma reação neste livro.</p>
                <button onClick={() => onCreatePost(book.id)} className="mt-3 rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-stone-950">
                  Criar primeira reação
                </button>
              </div>
            )}
          </section>
        </div>
      ) : (
        <div>
          {!visibleActiveList.length && <EmptyState text={feedVisibility === 'available' && activeList.length ? (tab === 'theories' ? `Nenhuma teoria liberada até o capítulo ${visibleChapterLimit}.` : `Nenhum comentário liberado até o capítulo ${visibleChapterLimit}.`) : tab === 'theories' ? 'Nenhuma teoria publicada ainda.' : 'Nenhum comentário publicado ainda.'} />}
          <PaginatedPostList
            posts={visibleActiveList}
            resetKey={`book-${book.id}-${tab}-${feedVisibility}-${visibleChapterLimit}-${highlightedPostId || ''}`}
            initialVisibleCount={initialPostVisibleCount}
            renderPost={post => (
              <div
                key={post.id}
                id={`folio-post-${post.id}`}
                className={post.id === highlightedPostId ? 'scroll-mt-28 ring-2 ring-amber-300/70 ring-offset-2 ring-offset-stone-950' : 'scroll-mt-28'}
              >
                <PostCard post={post} users={users} books={[book]} shelf={shelf} currentUser={currentUser} replies={replies} onBookClick={() => { }} onUserClick={onUserClick} onAddReply={onAddReply} onToggleLike={onToggleLike} onToggleReaction={onToggleReaction} onToggleReplyLike={onToggleReplyLike} onToggleReplyReaction={onToggleReplyReaction} onDeletePost={onDeletePost} onDeleteReply={onDeleteReply} onEditPost={onEditPost} onEditReply={onEditReply} onViewPost={onViewPost} compactBook protectSpoilers spoilerChapterLimit={visibleChapterLimit} allowChapterLimitWithoutShelf />
              </div>
            )}
          />
        </div>
      )}
      {readersModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center" onClick={e => e.currentTarget === e.target && setReadersModalOpen(false)}>
          <div className="max-h-[82vh] w-full max-w-md overflow-hidden rounded-lg border border-stone-800 bg-stone-900 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3 border-b border-stone-800 px-4 py-3">
              <div className="min-w-0">
                <h2 className="font-serif text-xl text-stone-50">Leitores</h2>
                <p className="mt-1 truncate text-sm text-stone-500">{book.title}</p>
              </div>
              <button onClick={() => setReadersModalOpen(false)} className="rounded px-2 py-1 text-xl leading-none text-stone-400 hover:bg-stone-800 hover:text-stone-100" aria-label="Fechar leitores">
                ×
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {readerRows.length ? readerRows.map(({ entry, user }) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setReadersModalOpen(false)
                    onUserClick(user.id)
                  }}
                  className="flex w-full items-center gap-3 border-b border-stone-800 px-4 py-3 text-left transition hover:bg-stone-800"
                >
                  <Avatar user={user} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-stone-100">{user.name}</p>
                    <p className="truncate text-xs text-stone-500">@{user.handle} · {STATUS_LABELS[entry.status]}</p>
                  </div>
                  {isInProgressStatus(entry.status) && (
                    <ChapterBadge chapter={chapterFromPercent(book, entry.progress)} />
                  )}
                </button>
              )) : (
                <EmptyState text="Ninguém adicionou este livro ainda." />
              )}
            </div>
          </div>
        </div>
      )}
      {datePromptDialog}
    </section>
  )
}

function ProfilePage({ currentUser, profileUser, shelf, posts, books, notificationPreferences, onBookClick, onUpdateUser, onToggleFollow, onOpenProfileList, onLogout, onUploadAvatar, onUpdateNotificationPreferences }: {
  currentUser: User
  profileUser: User
  users: User[]
  shelf: ShelfEntry[]
  posts: Post[]
  books: Book[]
  notificationPreferences: NotificationPreferences
  onBookClick: (id: string) => void
  onUpdateUser: (changes: Partial<User>) => Promise<boolean | void> | boolean | void
  onUserClick: (userId: string) => void
  onToggleFollow: (userId: string) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onOpenProfileList: (kind: ProfileListKind) => void
  onLogout: () => void
  onUploadAvatar: (file: File) => Promise<string>
  onUpdateNotificationPreferences: (changes: Partial<NotificationPreferences>) => Promise<boolean | void> | boolean | void
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
  const [collapsedProfileDateGroups, setCollapsedProfileDateGroups] = useState<Set<string>>(() => new Set())
  const myShelf = shelf.filter(entry => entry.userId === profileUser.id)
  const myPosts = posts.filter(post => post.userId === profileUser.id)
  const visibleShelf = myShelf
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId) }))
    .filter((item): item is { entry: ShelfEntry; book: Book } => Boolean(item.book))
  const filteredShelf = visibleShelf
    .filter(({ entry }) => entry.status === shelfFilter)
    .sort(isCompletedStatus(shelfFilter) ? readShelfNewestFirst : () => 0)
  const profileCompletionGroups = isCompletedStatus(shelfFilter) ? groupShelfByCompletionMonth(filteredShelf) : []
  const shelfFilters = SHELF_STATUSES
  const topGenres = topReadTerms(profileUser.id, shelf, books, 'genres')
  const topTropes = topReadTerms(profileUser.id, shelf, books, 'tropes')

  function profileDateGroupKey(kind: 'year' | 'month', key: string) {
    return `${profileUser.id}:${shelfFilter}:${kind}:${key}`
  }

  function toggleProfileDateGroup(key: string) {
    setCollapsedProfileDateGroups(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function renderProfileShelfRow({ entry, book }: ShelfBookItem) {
    return (
      <button key={entry.bookId} onClick={() => onBookClick(book.id)} className="flex w-full gap-3 rounded-lg border border-stone-800 bg-stone-900 p-3 text-left">
        {book.cover ? (
          <FolioImage src={book.cover} alt={book.title} className="h-20 w-14 rounded object-cover" />
        ) : (
          <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-stone-800 text-[10px] text-stone-500">Sem capa</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
            {isInProgressStatus(entry.status) ? <ChapterBadge chapter={chapterFromPercent(book, entry.progress)} /> : null}
          </div>
          <p className="mb-2 text-xs text-stone-500">{book.author}{isInProgressStatus(entry.status) ? ` · Cap. ${chapterFromPercent(book, entry.progress)}` : ''}</p>
          {canRateStatus(entry.status) && (
            <p className="text-xs font-bold text-stone-300">
              <span className="text-amber-300">{ratingText(entry.rating)}</span>
              {' · '}
              <span className="text-red-300">{ratingText(entry.spiceRating, 'pimentas')}</span>
            </p>
          )}
        </div>
      </button>
    )
  }

  return (
    <section>
      <Header title={isOwnProfile ? 'Perfil' : `@${profileUser.handle}`} />
      <div className="border-b border-stone-800 px-4 pb-4 pt-6 md:px-5 md:pb-5 md:pt-7">
        <div className="flex gap-4">
          <Avatar user={profileUser} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl text-stone-50">{profileUser.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-stone-500">@{profileUser.handle}</p>
              <span className="rounded-full border border-stone-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-stone-500">
                {isAdminUser(profileUser) ? 'Administrador' : 'Leitor'}
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
                      accept={IMAGE_UPLOAD_ACCEPT}
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
        <div className="folio-scrollbar-hidden mb-4 flex gap-2 overflow-x-auto pb-1">
          {shelfFilters.map(status => {
            const count = myShelf.filter(entry => entry.status === status).length
            return (
              <button
                key={status}
                onClick={() => setShelfFilter(status)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-bold transition ${shelfFilter === status ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800'
                  }`}
              >
                {STATUS_LABELS[status]} {count ? `· ${count}` : ''}
              </button>
            )
          })}
        </div>

        {isCompletedStatus(shelfFilter) && filteredShelf.length ? (
          <div className="space-y-6">
            {profileCompletionGroups.map(yearGroup => {
              const yearKey = profileDateGroupKey('year', yearGroup.key)
              const yearCollapsed = collapsedProfileDateGroups.has(yearKey)
              return (
                <section key={yearGroup.key}>
                  <button
                    type="button"
                    onClick={() => toggleProfileDateGroup(yearKey)}
                    aria-expanded={!yearCollapsed}
                    className="mb-3 flex w-full items-end justify-between gap-3 border-b border-stone-800 pb-2 text-left transition hover:border-stone-700"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-4 shrink-0 text-sm text-stone-500">{yearCollapsed ? '▸' : '▾'}</span>
                      <span className="truncate font-serif text-xl leading-none text-stone-100">{yearGroup.year ?? 'Sem data'}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">{pluralBooks(yearGroup.count)}</span>
                  </button>
                  {!yearCollapsed && (
                    <div className="space-y-4">
                      {yearGroup.months.map(monthGroup => {
                        const monthKey = profileDateGroupKey('month', monthGroup.key)
                        const monthCollapsed = collapsedProfileDateGroups.has(monthKey)
                        return (
                          <section key={monthGroup.key}>
                            <button
                              type="button"
                              onClick={() => toggleProfileDateGroup(monthKey)}
                              aria-expanded={!monthCollapsed}
                              className="mb-2 flex w-full items-center justify-between gap-3 text-left transition hover:text-stone-100"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="w-4 shrink-0 text-xs text-stone-500">{monthCollapsed ? '▸' : '▾'}</span>
                                <span className="truncate text-sm font-bold text-stone-300">{monthGroup.month ? READ_MONTH_LABELS[monthGroup.month - 1] : 'Sem data de conclusão'}</span>
                              </span>
                              <span className="shrink-0 text-xs text-stone-500">{pluralBooks(monthGroup.items.length)}</span>
                            </button>
                            {!monthCollapsed && (
                              <div className="space-y-3">
                                {monthGroup.items.map(renderProfileShelfRow)}
                              </div>
                            )}
                          </section>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredShelf.length ? filteredShelf.map(renderProfileShelfRow) : <EmptyState text={`Nenhum livro em ${STATUS_LABELS[shelfFilter]}.`} />}
          </div>
        )}
        {isOwnProfile && (
          <div className="mt-5">
            <NotificationPreferencesPanel preferences={notificationPreferences} onUpdate={onUpdateNotificationPreferences} />
          </div>
        )}
      </div>
    </section>
  )
}
function ProfileListPage({ kind, currentUser, profileUser, users, books, shelf, posts, replies, onBack, onBookClick, onUserClick, onToggleFollow, onAddReply, onToggleLike, onToggleReaction, onToggleReplyLike, onToggleReplyReaction, onDeletePost, onDeleteReply, onEditPost, onEditReply, onViewPost }: {
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
  onAddReply: AddReplyHandler
  onToggleLike: (postId: string) => Promise<boolean | void> | boolean | void
  onToggleReaction: (postId: string, type: ReactionType) => Promise<boolean | void> | boolean | void
  onToggleReplyLike: (replyId: string) => Promise<boolean | void> | boolean | void
  onToggleReplyReaction: (replyId: string, type: ReplyReactionType) => Promise<boolean | void> | boolean | void
  onDeletePost: (postId: string) => Promise<boolean | void> | boolean | void
  onDeleteReply: (replyId: string) => Promise<boolean | void> | boolean | void
  onEditPost: (post: Post) => void
  onEditReply: (reply: Reply, text: string) => Promise<boolean | void> | boolean | void
  onViewPost: (postId: string) => void
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
                onToggleReaction={onToggleReaction}
                onToggleReplyLike={onToggleReplyLike}
                onToggleReplyReaction={onToggleReplyReaction}
                onDeletePost={onDeletePost}
                onDeleteReply={onDeleteReply}
                onEditPost={onEditPost}
                onEditReply={onEditReply}
                onViewPost={onViewPost}
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

function NotificationsPage({ notifications, currentUser, users, books, shelf, posts, readingGoal, showDeviceNotificationControls, deviceNotificationStatus, onEnableDeviceNotifications, onNotificationClick, onUserClick, onBookClick, onCreatePost, onToggleReadingCheckIn }: {
  notifications: FolioNotification[]
  currentUser: User
  users: User[]
  books: Book[]
  shelf: ShelfEntry[]
  posts: Post[]
  readingGoal: ReadingGoal
  showDeviceNotificationControls: boolean
  deviceNotificationStatus: DeviceNotificationStatus
  onEnableDeviceNotifications: () => void
  onNotificationClick: (notification: FolioNotification) => void
  onUserClick: (id: string) => void
  onBookClick: (id: string) => void
  onCreatePost: (bookId?: string) => void
  onToggleReadingCheckIn: () => Promise<boolean | void> | boolean | void
}) {
  const nudges = buildSmartNudges(currentUser, books, shelf, posts, readingGoal)

  return (
    <section>
      <Header title="Notificações">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-500">Novos seguidores, curtidas, respostas, menções e comentários liberados pela sua estante aparecem aqui.</p>
          {showDeviceNotificationControls && deviceNotificationStatus === 'default' && (
            <button
              type="button"
              onClick={onEnableDeviceNotifications}
              className="w-full shrink-0 rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950 transition hover:bg-amber-200 sm:w-auto"
            >
              Ativar notificações
            </button>
          )}
          {showDeviceNotificationControls && deviceNotificationStatus === 'granted' && (
            <span className="w-full shrink-0 rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-center text-sm font-bold text-emerald-700 sm:w-auto">
              Ativadas
            </span>
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
      <SmartNudgesPanel nudges={nudges} onBookClick={onBookClick} onCreatePost={onCreatePost} onToggleReadingCheckIn={onToggleReadingCheckIn} />
      {notifications.length ? (
        <div>
          {notifications.map(notification => {
            const user = users.find(item => item.id === notification.userId)
            const book = notification.bookId ? books.find(item => item.id === notification.bookId) : null
            if (!user) return null
            const text = notificationTypeText(notification.type, notificationShelfStatus(notification, currentUser, shelf))
            return (
              <article
                key={notification.id}
                role="button"
                tabIndex={0}
                onClick={() => onNotificationClick(notification)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onNotificationClick(notification)
                  }
                }}
                className={`cursor-pointer border-b border-stone-800 px-4 py-4 transition hover:bg-stone-900/35 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-300/50 md:px-5 ${notification.read ? 'opacity-70' : ''}`}
              >
                <div className="flex gap-3">
                  <button onClick={e => {
                    e.stopPropagation()
                    onUserClick(user.id)
                  }}><Avatar user={user} size="sm" /></button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-300">
                      <button onClick={e => {
                        e.stopPropagation()
                        onUserClick(user.id)
                      }} className="font-bold text-stone-100 hover:text-amber-300">{user.name}</button>{' '}
                      {text}
                      {book && (
                        <>
                          {' em '}
                          <button onClick={e => {
                            e.stopPropagation()
                            onNotificationClick(notification)
                          }} className="font-bold text-amber-300">{book.title}</button>
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
function GoalsPage({ currentUser, shelf, books, readingGoal, onUpdateReadingGoal, onToggleReadingCheckIn, onResetReadingCheckIns }: {
  currentUser: User
  shelf: ShelfEntry[]
  books: Book[]
  readingGoal: ReadingGoal
  onUpdateReadingGoal: (changes: { targetBooks?: number; targetBooksMonth?: number; targetBooksWeek?: number; targetDays?: number }) => Promise<boolean | void> | boolean | void
  onToggleReadingCheckIn: () => Promise<boolean | void> | boolean | void
  onResetReadingCheckIns: () => Promise<boolean | void> | boolean | void
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState(String(readingGoal.targetBooks || 40))
  const [editingMonth, setEditingMonth] = useState(false)
  const [monthInputVal, setMonthInputVal] = useState(String(readingGoal.targetBooksMonth || 4))
  const [editingWeek, setEditingWeek] = useState(false)
  const [weekInputVal, setWeekInputVal] = useState(String(readingGoal.targetBooksWeek || 1))
  const [editingDays, setEditingDays] = useState(false)
  const [dayInputVal, setDayInputVal] = useState(String(readingGoal.targetDays || 120))
  const myShelf = shelf.filter(entry => entry.userId === currentUser.id)
  const goalYear = readingGoal.year || new Date().getFullYear()
  const goalMonth = readingGoal.month || new Date().getMonth() + 1
  const goalWeekStart = readingGoal.weekStart || weekStartDateKey()
  const targetBooksMonth = readingGoal.targetBooksMonth || 4
  const targetBooksWeek = readingGoal.targetBooksWeek || 1
  const readThisYear = readingGoal.booksReadThisYear ?? myShelf.filter(entry => isCompletedStatus(entry.status) && isDateInYear(entry.endDate, goalYear)).length
  const readThisMonth = readingGoal.booksReadThisMonth ?? myShelf.filter(entry => isCompletedStatus(entry.status) && isDateInMonth(entry.endDate, goalYear, goalMonth)).length
  const readThisWeek = readingGoal.booksReadThisWeek ?? myShelf.filter(entry => isCompletedStatus(entry.status) && isDateInWeek(entry.endDate, goalWeekStart)).length
  const progress = Math.min(100, Math.round((readThisYear / Math.max(1, readingGoal.targetBooks)) * 100))
  const remaining = Math.max(0, readingGoal.targetBooks - readThisYear)
  const monthProgress = Math.min(100, Math.round((readThisMonth / Math.max(1, targetBooksMonth)) * 100))
  const monthRemaining = Math.max(0, targetBooksMonth - readThisMonth)
  const weekProgress = Math.min(100, Math.round((readThisWeek / Math.max(1, targetBooksWeek)) * 100))
  const weekRemaining = Math.max(0, targetBooksWeek - readThisWeek)
  const dayProgress = Math.min(100, Math.round((readingGoal.checkIns.length / Math.max(1, readingGoal.targetDays)) * 100))
  const remainingDays = Math.max(0, readingGoal.targetDays - readingGoal.checkIns.length)
  const dayGoalCompleted = readingGoal.checkIns.length >= readingGoal.targetDays
  const currentlyReading = myShelf
    .filter(entry => isInProgressStatus(entry.status))
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
  const weeklyCheckIns = recentDays.slice(-7).filter(day => day.checked).length
  const badgeRows = [
    { label: 'Sequência acesa', value: readingGoal.currentStreak >= 3 ? 'Conquistado' : `${Math.max(0, 3 - readingGoal.currentStreak)} dias faltando`, active: readingGoal.currentStreak >= 3 },
    { label: 'Semana leitora', value: weeklyCheckIns >= 5 ? 'Conquistado' : `${weeklyCheckIns}/5 dias`, active: weeklyCheckIns >= 5 },
    { label: 'Estante viva', value: currentlyReading.length >= 2 ? 'Conquistado' : `${currentlyReading.length}/2 lendo`, active: currentlyReading.length >= 2 },
  ]

  return (
    <section>
      <Header title="Metas de leitura" />
      <div className="space-y-4 px-4 pb-4 pt-6 md:px-5 md:pb-5 md:pt-7">
        <div className="rounded-lg border border-amber-300/25 bg-stone-900 p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Desafio da semana</p>
              <h2 className="mt-1 font-serif text-xl text-stone-100">Leia em 5 dias diferentes</h2>
              <p className="mt-1 text-sm text-stone-500">O desafio usa seus check-ins dos últimos 7 dias.</p>
            </div>
            <span className="rounded-full border border-stone-700 px-3 py-1 text-xs font-black text-stone-300">{weeklyCheckIns}/5</span>
          </div>
          <ProgressBar value={Math.min(100, Math.round((weeklyCheckIns / 5) * 100))} />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {badgeRows.map(badge => (
              <div key={badge.label} className={`rounded-lg border p-3 ${badge.active ? 'border-amber-300/40 bg-amber-300/10' : 'border-stone-800 bg-stone-950'}`}>
                <p className="text-sm font-bold text-stone-100">{badge.label}</p>
                <p className={`mt-1 text-xs font-semibold ${badge.active ? 'text-amber-200' : 'text-stone-500'}`}>{badge.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-stone-800 bg-stone-900 p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl text-stone-100">Meta semanal</h2>
                <p className="text-sm text-stone-500">Conta livros concluídos desde {goalWeekStart.slice(8, 10)}/{goalWeekStart.slice(5, 7)}.</p>
              </div>
              {editingWeek ? (
                <div className="flex gap-2">
                  <input value={weekInputVal} onChange={e => setWeekInputVal(e.target.value)} type="number" className="w-20 rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-center text-sm text-stone-100 outline-none focus:border-amber-300" />
                  <button onClick={async () => {
                    const targetBooksWeek = clamp(Number(weekInputVal), 1, 30)
                    const saved = await onUpdateReadingGoal({ targetBooksWeek })
                    if (saved === false) return
                    setWeekInputVal(String(targetBooksWeek))
                    setEditingWeek(false)
                  }} className="rounded-lg bg-amber-300 px-3 text-sm font-bold text-stone-950">
                    OK
                  </button>
                </div>
              ) : (
                <button onClick={() => {
                  setWeekInputVal(String(targetBooksWeek))
                  setEditingWeek(true)
                }} className="text-sm font-bold text-amber-300">Editar</button>
              )}
            </div>
            <div className="mb-4 flex items-end gap-3">
              <span className="font-serif text-6xl leading-none text-amber-300">{readThisWeek}</span>
              <span className="pb-2 text-sm text-stone-400">de {targetBooksWeek} livros</span>
            </div>
            <ProgressBar value={weekProgress} />
            <div className="mt-2 flex justify-between text-xs text-stone-500">
              <span>{weekProgress}% concluído</span>
              <span>{weekRemaining} restantes</span>
            </div>
          </div>

          <div className="rounded-lg border border-stone-800 bg-stone-900 p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-xl text-stone-100">Meta mensal</h2>
                <p className="text-sm text-stone-500">Conta livros concluídos em {READ_MONTH_LABELS[goalMonth - 1]}.</p>
              </div>
              {editingMonth ? (
                <div className="flex gap-2">
                  <input value={monthInputVal} onChange={e => setMonthInputVal(e.target.value)} type="number" className="w-20 rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-center text-sm text-stone-100 outline-none focus:border-amber-300" />
                  <button onClick={async () => {
                    const targetBooksMonth = clamp(Number(monthInputVal), 1, 99)
                    const saved = await onUpdateReadingGoal({ targetBooksMonth })
                    if (saved === false) return
                    setMonthInputVal(String(targetBooksMonth))
                    setEditingMonth(false)
                  }} className="rounded-lg bg-amber-300 px-3 text-sm font-bold text-stone-950">
                    OK
                  </button>
                </div>
              ) : (
                <button onClick={() => {
                  setMonthInputVal(String(targetBooksMonth))
                  setEditingMonth(true)
                }} className="text-sm font-bold text-amber-300">Editar</button>
              )}
            </div>
            <div className="mb-4 flex items-end gap-3">
              <span className="font-serif text-6xl leading-none text-amber-300">{readThisMonth}</span>
              <span className="pb-2 text-sm text-stone-400">de {targetBooksMonth} livros</span>
            </div>
            <ProgressBar value={monthProgress} />
            <div className="mt-2 flex justify-between text-xs text-stone-500">
              <span>{monthProgress}% concluído</span>
              <span>{monthRemaining} restantes</span>
            </div>
          </div>
        </div>

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
              <div className="flex shrink-0 gap-3">
                {dayGoalCompleted && (
                  <button onClick={() => onResetReadingCheckIns()} className="text-sm font-bold text-amber-300">
                    Recomeçar
                  </button>
                )}
                <button onClick={() => {
                  setDayInputVal(String(readingGoal.targetDays))
                  setEditingDays(true)
                }} className="text-sm font-bold text-amber-300">Editar</button>
              </div>
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
                <FolioImage src={book.cover} alt={book.title} className="h-16 w-11 rounded object-cover" />
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

function CreatePostModal({ currentUser, users, shelf, books, initialBookId, editingPost, communityFeatureEnabled, onClose, onPost, onUploadImage }: {
  currentUser: User
  users: User[]
  shelf: ShelfEntry[]
  books: Book[]
  initialBookId?: string | null
  editingPost?: Post | null
  communityFeatureEnabled: boolean
  onClose: () => void
  onPost: (post: Post) => Promise<boolean | void> | boolean | void
  onUploadImage: (file: File) => Promise<string>
}) {
  function postBookSortPriority(entry: ShelfEntry, book: Book) {
    if (initialBookId && book.id === initialBookId) return -1
    return isInProgressStatus(entry.status) ? 0 : 1
  }

  const myBooks = shelf
    .filter(entry => entry.userId === currentUser.id && canPostWithStatus(entry.status))
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)
    .sort((a, b) => postBookSortPriority(a.entry, a.book) - postBookSortPriority(b.entry, b.book) || a.book.title.localeCompare(b.book.title, 'pt-BR'))
  const initialBook = myBooks.find(({ book }) => book.id === initialBookId)
  const [selectedBookId, setSelectedBookId] = useState(editingPost?.bookId || initialBook?.book.id || myBooks[0]?.book.id || '')
  const [bookQuery, setBookQuery] = useState('')
  const selectedBook = books.find(book => book.id === selectedBookId) || myBooks[0]?.book
  const selectedEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === selectedBookId)
  const defaultPercent = isCompletedStatus(selectedEntry?.status) ? 100 : selectedEntry?.progress ?? 0
  const [postType, setPostType] = useState<PostType>(editingPost?.type || 'comment')
  const [audience, setAudience] = useState<'all' | 'tea'>(editingPost?.audience || 'all')
  const [text, setText] = useState(editingPost?.text || '')
  const [reactionEmoji, setReactionEmoji] = useState(editingPost?.reactionEmoji || '🤯')
  const [chapter, setChapter] = useState(editingPost ? String(editingPost.chapter) : selectedBook ? String(chapterFromPercent(selectedBook, defaultPercent)) : '1')
  const [postImageUrl, setPostImageUrl] = useState('')
  const [postImageFileName, setPostImageFileName] = useState('')
  const [postImageError, setPostImageError] = useState('')
  const [uploadingPostImage, setUploadingPostImage] = useState(false)
  const [posting, setPosting] = useState(false)
  const postingRef = useRef(false)
  const emojis = ['😭', '🤯', '♥', '😂', '😡', '🔥', '💔', '😱', '🥹', '👏']
  const canPost = selectedBook && chapter !== '' && !uploadingPostImage && !posting && (postType === 'reaction' ? Boolean(reactionEmoji) : text.trim().length > 0 || Boolean(postImageUrl))
  const filteredBooks = myBooks
    .filter(({ book }) => !bookQuery.trim() || bookMatchesSearch(book, bookQuery, 'title') || bookMatchesSearch(book, bookQuery, 'author'))
    .slice(0, 8)

  function handleBookChange(bookId: string) {
    const nextBook = books.find(book => book.id === bookId)
    const nextEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === bookId)
    const nextPercent = isCompletedStatus(nextEntry?.status) ? 100 : nextEntry?.progress ?? 0
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
    if (!canPost || !selectedBook || postingRef.current) return
    postingRef.current = true
    setPosting(true)
    const selectedChapter = clamp(Number(chapter), 1, selectedBook.totalChapters)
    const percent = percentFromChapter(selectedBook, selectedChapter)
    const postText = textWithPostImage(postType === 'reaction' ? '' : text, postImageUrl)
    const mentionedUserIds = postType === 'reaction' ? [] : mentionedUsersFromText(text, currentUser, users).map(user => user.id)
    try {
      const posted = await onPost({
        id: editingPost?.id || `p${Date.now()}`,
        userId: currentUser.id,
        bookId: selectedBook.id,
        chapter: selectedChapter,
        percent,
        text: postText || undefined,
        reactionEmoji: postType === 'reaction' ? reactionEmoji : undefined,
        type: postType,
        audience,
        timestamp: editingPost?.timestamp || new Date().toISOString(),
        likes: editingPost?.likes || [],
        comments: editingPost?.comments || 0,
        views: editingPost?.views || [],
        viewCount: editingPost?.viewCount || 0,
        ...(mentionedUserIds.length ? { mentionedUserIds } : {}),
      })
      if (posted === false) return
      onClose()
    } finally {
      postingRef.current = false
      setPosting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center" onClick={e => e.currentTarget === e.target && onClose()}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-lg border border-stone-800 bg-stone-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-800 bg-stone-900 px-4 py-3">
          <h2 className="font-serif text-lg text-stone-100">{editingPost ? 'Editar publicação' : 'Nova publicação'}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-stone-500 hover:bg-stone-800 hover:text-stone-100">×</button>
        </div>

        <div className="space-y-4 p-4">
          {!myBooks.length ? (
            <p className="rounded-lg border border-stone-800 bg-stone-950 p-4 text-sm text-stone-400">Adicione um livro como Lendo, Relendo, Lido, Favoritado ou Abandonei para publicar no feed da obra.</p>
          ) : (
            <>
              <label className="block text-sm font-semibold text-stone-300">
                Livro
                <input
                  value={bookQuery}
                  onChange={e => setBookQuery(e.target.value)}
                  placeholder="Buscar por título ou autor"
                  className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-base text-stone-100 outline-none focus:border-amber-300 sm:text-sm"
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
                      <FolioImage src={book.cover} alt={book.title} className="h-10 w-7 shrink-0 rounded object-cover" />
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
                    <input type="number" min="1" max={selectedBook.totalChapters} value={chapter} onChange={e => handleChapterChange(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-base text-stone-100 outline-none focus:border-amber-300 sm:text-sm" />
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

              {communityFeatureEnabled && (
                <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-3">
                  <p className="text-sm font-semibold text-stone-200">Onde você quer conversar?</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAudience('all')} className={`rounded-md px-3 py-2 text-xs font-bold ${audience === 'all' ? 'bg-amber-300 text-stone-950' : 'bg-stone-800 text-stone-300'}`}>Todos</button>
                    <button type="button" onClick={() => setAudience('tea')} className={`rounded-md px-3 py-2 text-xs font-bold ${audience === 'tea' ? 'bg-amber-300 text-stone-950' : 'bg-stone-800 text-stone-300'}`}>Comunidade do Chá</button>
                  </div>
                </div>
              )}

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
                <div className="text-sm font-semibold text-stone-300">
                  <p>{postType === 'theory' ? 'Sua teoria' : 'Comentário'}</p>
                  <MentionTextarea
                    value={text}
                    onChange={setText}
                    currentUser={currentUser}
                    users={users}
                    rows={4}
                    placeholder={postType === 'theory' ? 'Ex.: acho que essa personagem ainda sabe mais do que contou...' : 'Escreva livremente. Quem estiver atrás desse ponto não verá agora.'}
                    className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-base text-stone-100 outline-none focus:border-amber-300 sm:text-sm"
                  />
                </div>
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
                        accept={IMAGE_UPLOAD_ACCEPT}
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
                          } catch (error) {
                            setPostImageError(errorMessage(error, 'Nao foi possivel enviar a imagem agora.'))
                          } finally {
                            setUploadingPostImage(false)
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
                {postImageUrl && (
                  <FolioImage src={postImageUrl} alt="Prévia da imagem" loading="eager" className="mt-3 aspect-[4/3] max-h-72 w-full rounded-lg object-cover" />
                )}
                {postImageError && <p className="mt-2 text-xs font-semibold text-red-300">{postImageError}</p>}
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-800 px-4 py-3">
          <button onClick={onClose} disabled={posting} className="rounded-lg px-4 py-2 text-sm font-bold text-stone-400 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">Cancelar</button>
          <button onClick={handlePost} disabled={!canPost} className="rounded-lg bg-amber-300 px-5 py-2 text-sm font-bold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-500">
            {uploadingPostImage ? 'Enviando...' : posting ? 'Salvando...' : editingPost ? 'Salvar alterações' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function dashboardInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'L'
}

function DashboardAvatar({ user }: { user: DashboardUser }) {
  if (isMediaUrl(user.avatar)) {
    return <FolioImage src={user.avatar} alt={user.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-300 text-sm font-black text-stone-950">
      {user.avatar || dashboardInitials(user.name)}
    </div>
  )
}

function isDashboardMobilePushDevice(device: DashboardPushReportRow) {
  return /android|iphone|ipad|ipod|mobile/i.test(device.userAgent || '')
}

function dashboardPushDeviceLabel(device: DashboardPushReportRow) {
  const userAgent = device.userAgent || ''
  if (/iphone|ipod/i.test(userAgent)) return 'iPhone'
  if (/ipad/i.test(userAgent)) return 'iPad'
  if (/android/i.test(userAgent)) return 'Android'
  if (/windows/i.test(userAgent)) return 'Desktop Windows'
  if (/macintosh|mac os x/i.test(userAgent)) return 'Desktop Mac'
  return isDashboardMobilePushDevice(device) ? 'Mobile' : 'Desktop'
}

function DashboardStat({ label, value, detail, tone = 'amber', active = false, onClick }: {
  label: string
  value: number | string
  detail?: string
  tone?: 'amber' | 'emerald' | 'cyan' | 'rose'
  active?: boolean
  onClick?: () => void
}) {
  const className = `folio-dashboard-stat folio-dashboard-stat-${tone} ${active ? 'ring-2 ring-amber-300/70' : ''}`
  const content = (
    <>
      <p className="folio-dashboard-stat-label">{label}</p>
      <p className="folio-dashboard-stat-value">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</p>
      {detail && <p className="folio-dashboard-stat-detail">{detail}</p>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} text-left transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-stone-800/10 focus:outline-none focus:ring-2 focus:ring-amber-300`}>
        {content}
      </button>
    )
  }

  return <article className={className}>{content}</article>
}

function DashboardBarChart({ title, points }: { title: string; points: { label: string; count: number }[] }) {
  const max = Math.max(1, ...points.map(point => point.count))

  return (
    <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-serif text-lg text-stone-50 sm:text-xl">{title}</h2>
        <span className="rounded-full border border-stone-700 px-2 py-1 text-xs font-bold text-stone-400">{points.reduce((sum, point) => sum + point.count, 0).toLocaleString('pt-BR')}</span>
      </div>

      <div className="space-y-2 sm:hidden">
        {points.map(point => (
          <div key={point.label} className="grid grid-cols-[3.5rem_1fr_2.25rem] items-center gap-2">
            <span className="truncate text-xs font-bold text-stone-500">{point.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-stone-950">
              <div
                className="h-full rounded-full bg-amber-300"
                style={{ width: `${Math.max(point.count ? 8 : 0, (point.count / max) * 100)}%` }}
              />
            </div>
            <span className="text-right text-xs font-black text-stone-200">{point.count}</span>
          </div>
        ))}
      </div>

      <div className="hidden sm:block">
        <div className="flex h-48 items-end gap-1">
          {points.map(point => (
            <div key={point.label} className="group flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="relative flex h-36 w-full items-end rounded-md bg-stone-950">
                <div
                  className="w-full rounded-md bg-amber-300 transition group-hover:bg-amber-200"
                  style={{ height: `${Math.max(5, (point.count / max) * 100)}%` }}
                />
                <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded bg-stone-800 px-2 py-1 text-xs font-bold text-stone-100 shadow-xl group-hover:block">
                  {point.count}
                </span>
              </div>
              <span className="max-w-full truncate text-[10px] font-semibold text-stone-500">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function DashboardEngagementChart({ rows }: { rows: SuperAdminDashboard['engagementByDay'] }) {
  const max = Math.max(1, ...rows.map(row => row.posts + row.replies + row.likes + row.views + row.follows + row.checkIns))
  const segments: { key: keyof SuperAdminDashboard['engagementByDay'][number]; label: string; className: string }[] = [
    { key: 'posts', label: 'Posts', className: 'bg-amber-300' },
    { key: 'replies', label: 'Respostas', className: 'bg-cyan-300' },
    { key: 'likes', label: 'Curtidas', className: 'bg-rose-300' },
    { key: 'views', label: 'Views', className: 'bg-emerald-300' },
    { key: 'follows', label: 'Follows', className: 'bg-violet-300' },
    { key: 'checkIns', label: 'Check-ins', className: 'bg-lime-300' },
  ]

  return (
    <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg text-stone-50 sm:text-xl">Engajamento da semana</h2>
        <div className="flex flex-wrap gap-2">
          {segments.map(segment => (
            <span key={String(segment.key)} className="flex items-center gap-1 text-xs font-semibold text-stone-400">
              <span className={`h-2 w-2 rounded-full ${segment.className}`} />
              {segment.label}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {rows.map(row => {
          const total = row.posts + row.replies + row.likes + row.views + row.follows + row.checkIns
          return (
            <div key={row.label} className="grid grid-cols-[2.75rem_1fr_2.5rem] items-center gap-2 sm:grid-cols-[3rem_1fr_3rem] sm:gap-3">
              <span className="text-xs font-bold text-stone-500">{row.label}</span>
              <div className="flex h-4 overflow-hidden rounded-full bg-stone-950">
                {segments.map(segment => {
                  const value = Number(row[segment.key]) || 0
                  if (!value) return null
                  return <div key={String(segment.key)} className={segment.className} style={{ width: `${(value / max) * 100}%` }} />
                })}
              </div>
              <span className="text-right text-xs font-bold text-stone-300">{total}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DashboardListMetric({ rows, emptyText }: { rows: { label: string; count: number }[]; emptyText: string }) {
  const max = Math.max(1, ...rows.map(row => row.count))

  if (!rows.length) return <EmptyState text={emptyText} />

  return (
    <div className="space-y-3">
      {rows.map(row => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <span className="truncate text-sm font-bold text-stone-200">{row.label}</span>
            <span className="text-sm font-bold text-amber-300">{row.count.toLocaleString('pt-BR')}</span>
          </div>
          <div className="h-2 rounded-full bg-stone-950">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.max(6, (row.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const DASHBOARD_REPORT_TITLES: Record<DashboardReportKey, string> = {
  users: 'Relatório de usuários',
  postsToday: 'Postagens de hoje',
  activeNow: 'Usuários ativos agora',
  interactionsToday: 'Interações de hoje',
  books: 'Relatório de livros',
  postsThisYear: 'Postagens do ano',
  loginsToday: 'Logins de hoje',
  pushSubscriptions: 'Notificações mobile por usuário',
}

function dashboardPostTypeLabel(type: string) {
  return type === 'comment' ? 'Comentário' : type === 'reaction' ? 'Reação' : type === 'theory' ? 'Teoria' : type
}

function dashboardInteractionLabel(type: string) {
  return {
    like: 'curtiu uma postagem',
    reply_like: 'curtiu uma resposta',
    view: 'visualizou uma postagem',
    reply: 'respondeu uma postagem',
    mention: 'mencionou uma pessoa',
  }[type] || type
}

function DashboardReportShell({ title, count, onClose, children }: {
  title: string
  count: number
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <section id="folio-dashboard-report" className="min-w-0 max-w-full overflow-hidden rounded-lg border border-amber-300/30 bg-stone-900 p-3 shadow-lg shadow-stone-800/10 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-lg text-stone-50 sm:text-xl">{title}</h2>
          <p className="mt-1 text-xs font-semibold text-stone-500">{count.toLocaleString('pt-BR')} registros encontrados</p>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-lg border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-300 hover:bg-stone-800">
          Fechar
        </button>
      </div>
      {children}
    </section>
  )
}

function DashboardUserLine({ user }: { user: DashboardUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <DashboardAvatar user={user} />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-stone-100">{user.name}</p>
        <p className="truncate text-xs text-stone-500">{user.handle ? `@${user.handle}` : user.email || 'sem email'}</p>
      </div>
    </div>
  )
}

function SuperAdminReportPanel({ dashboard, report, onClose, onUserClick, onBookClick }: {
  dashboard: SuperAdminDashboard
  report: DashboardReportKey
  onClose: () => void
  onUserClick: (id: string) => void
  onBookClick: (id: string) => void
}) {
  if (report === 'users') {
    const rows = dashboard.reports.users
    return (
      <DashboardReportShell title={DASHBOARD_REPORT_TITLES[report]} count={rows.length} onClose={onClose}>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map(row => (
            <button key={row.user.id} onClick={() => onUserClick(row.user.id)} className="rounded-lg border border-stone-800 bg-stone-950 p-3 text-left transition hover:border-cyan-300/40">
              <DashboardUserLine user={row.user} />
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-400">
                <span>{isAdminUser(row) ? 'Admin' : 'Leitor'}</span>
                <span>{row.hasProfile ? 'Com perfil Folio' : 'Sem perfil Folio'}</span>
                <span>{row.booksRead} lidos</span>
                <span>{row.pagesRead.toLocaleString('pt-BR')} páginas</span>
                <span>{row.posts} posts</span>
                <span>{row.replies} respostas</span>
                <span>{row.shelfEntries} na estante</span>
                <span>{row.loginsToday} logins hoje</span>
              </div>
              <p className="mt-2 truncate text-xs text-stone-500">Última atividade: {row.lastActivityAt ? formatDateTime(row.lastActivityAt) : 'sem registro'}</p>
            </button>
          ))}
        </div>
      </DashboardReportShell>
    )
  }

  if (report === 'postsToday' || report === 'postsThisYear') {
    const rows = report === 'postsToday' ? dashboard.reports.postsToday : dashboard.reports.postsThisYear
    return (
      <DashboardReportShell title={DASHBOARD_REPORT_TITLES[report]} count={rows.length} onClose={onClose}>
        <div className="space-y-2">
          {rows.length ? rows.map(row => (
            <button key={row.id} onClick={() => onBookClick(row.book.id)} className="grid w-full grid-cols-[auto_1fr] gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3 text-left transition hover:border-amber-300/40 sm:grid-cols-[auto_1fr_auto]">
              <DashboardUserLine user={row.user} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-100">{row.book.title}</p>
                <p className="truncate text-xs text-stone-500">{dashboardPostTypeLabel(row.type)} · cap. {row.chapter} · {formatDateTime(row.createdAt)}</p>
                {row.text && <p className="mt-1 line-clamp-2 text-xs text-stone-400">{row.text}</p>}
              </div>
              <div className="col-span-2 flex gap-2 text-xs font-bold text-stone-500 sm:col-span-1 sm:flex-col sm:text-right">
                <span>{row.likes} curtidas</span>
                <span>{row.replies} respostas</span>
                <span>{row.views} views</span>
              </div>
            </button>
          )) : <EmptyState text="Nenhuma postagem encontrada." />}
        </div>
      </DashboardReportShell>
    )
  }

  if (report === 'activeNow') {
    const rows = dashboard.reports.activeNow
    return (
      <DashboardReportShell title={DASHBOARD_REPORT_TITLES[report]} count={rows.length} onClose={onClose}>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.length ? rows.map(row => (
            <button key={row.user.id} onClick={() => onUserClick(row.user.id)} className="flex items-center gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3 text-left transition hover:border-emerald-300/40">
              <DashboardUserLine user={row.user} />
              <div className="ml-auto text-right text-xs font-bold text-stone-500">
                <p>{row.actions} ações</p>
                <p>{formatTime(row.lastSeenAt)}</p>
              </div>
            </button>
          )) : <EmptyState text="Ninguém ativo nos últimos 15 minutos." />}
        </div>
      </DashboardReportShell>
    )
  }

  if (report === 'interactionsToday') {
    const rows = dashboard.reports.interactionsToday
    return (
      <DashboardReportShell title={DASHBOARD_REPORT_TITLES[report]} count={rows.length} onClose={onClose}>
        <div className="space-y-2">
          {rows.length ? rows.map(row => (
            <button key={row.id} onClick={() => row.book.id && onBookClick(row.book.id)} className="grid w-full grid-cols-[auto_1fr] gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3 text-left transition hover:border-rose-300/40">
              <DashboardUserLine user={row.user} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-100">{dashboardInteractionLabel(row.type)}</p>
                <p className="truncate text-xs text-stone-500">{row.book.title} · {formatDateTime(row.createdAt)}</p>
                {row.text && <p className="mt-1 line-clamp-2 text-xs text-stone-400">{row.text}</p>}
              </div>
            </button>
          )) : <EmptyState text="Nenhuma interação encontrada hoje." />}
        </div>
      </DashboardReportShell>
    )
  }

  if (report === 'books') {
    const rows = dashboard.reports.books
    return (
      <DashboardReportShell title={DASHBOARD_REPORT_TITLES[report]} count={rows.length} onClose={onClose}>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map(row => (
            <button key={row.id} onClick={() => onBookClick(row.id)} className="grid grid-cols-[48px_1fr] gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3 text-left transition hover:border-amber-300/40">
              {row.cover ? <FolioImage src={row.cover} alt={row.title} className="h-16 w-12 rounded-md object-cover" /> : <div className="h-16 w-12 rounded-md bg-stone-800" />}
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-bold text-stone-100">{row.title}</p>
                <p className="truncate text-xs text-stone-500">{row.author}</p>
                <p className="mt-2 text-xs text-stone-400">{row.readers} leitores · {row.posts} posts · {row.completed} concluídos</p>
                {row.inactive && <p className="mt-1 text-xs font-bold text-red-300">Inativo</p>}
              </div>
            </button>
          ))}
        </div>
      </DashboardReportShell>
    )
  }

  if (report === 'loginsToday') {
    const rows = dashboard.reports.loginsToday
    return (
      <DashboardReportShell title={DASHBOARD_REPORT_TITLES[report]} count={rows.length} onClose={onClose}>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.length ? rows.map((row, index) => (
            <button key={`${row.user.id}-${row.loggedAt}-${index}`} onClick={() => onUserClick(row.user.id)} className="flex items-center gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3 text-left transition hover:border-emerald-300/40">
              <DashboardUserLine user={row.user} />
              <p className="ml-auto shrink-0 text-xs font-bold text-stone-500">{formatDateTime(row.loggedAt)}</p>
            </button>
          )) : <EmptyState text="Nenhum login registrado hoje." />}
        </div>
      </DashboardReportShell>
    )
  }

  const rows = dashboard.reports.pushSubscriptions.filter(isDashboardMobilePushDevice)
  const pushUsers = Array.from(rows.reduce((map, row) => {
    const current = map.get(row.user.id)
    if (current) {
      current.devices.push(row)
      if (new Date(row.updatedAt).getTime() > new Date(current.lastUpdatedAt).getTime()) {
        current.lastUpdatedAt = row.updatedAt
      }
      return map
    }

    map.set(row.user.id, {
      user: row.user,
      devices: [row],
      lastUpdatedAt: row.updatedAt,
    })
    return map
  }, new Map<string, { user: DashboardUser; devices: DashboardPushReportRow[]; lastUpdatedAt: string }>()).values())
    .sort((a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime())

  return (
    <DashboardReportShell title={DASHBOARD_REPORT_TITLES[report]} count={pushUsers.length} onClose={onClose}>
      <div className="space-y-2">
        {pushUsers.length ? pushUsers.map(row => (
          <button key={row.user.id} onClick={() => onUserClick(row.user.id)} className="grid min-w-0 w-full max-w-full gap-3 overflow-hidden rounded-lg border border-stone-800 bg-stone-950 p-3 text-left transition hover:border-rose-300/40">
            <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
              <div className="min-w-0"><DashboardUserLine user={row.user} /></div>
              <div className="min-w-0 text-left sm:text-right">
                <p className="text-xs font-black text-rose-200">{row.devices.length} {row.devices.length === 1 ? 'mobile' : 'mobiles'}</p>
                <p className="mt-1 text-xs font-bold text-stone-500">Atualizado {formatDateTime(row.lastUpdatedAt)}</p>
              </div>
            </div>
            <div className="min-w-0 max-w-full space-y-2 overflow-hidden">
              {row.devices.map(device => (
                <div key={device.id} className="min-w-0 max-w-full overflow-hidden rounded-lg border border-stone-800 bg-stone-900 p-2">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-rose-300/10 px-2 py-0.5 text-[11px] font-black text-rose-200">{dashboardPushDeviceLabel(device)}</span>
                    <span className="text-[11px] font-bold text-stone-500">aparece na barra do celular</span>
                  </div>
                  <p className="max-w-full break-words text-xs leading-relaxed text-stone-500">{device.userAgent || 'Dispositivo sem identificação'}</p>
                  <p className="mt-1 max-w-full break-all text-xs leading-relaxed text-stone-600">{device.endpoint}</p>
                  <p className="mt-1 text-[11px] font-bold text-stone-500">Atualizado {formatDateTime(device.updatedAt)}</p>
                </div>
              ))}
            </div>
          </button>
        )) : <EmptyState text="Nenhum usuário com notificações mobile ativas." />}
      </div>
    </DashboardReportShell>
  )
}

function MaintenanceModePanel({ mode, onChange }: {
  mode: MaintenanceMode
  onChange: (mode: MaintenanceMode) => void
}) {
  const [message, setMessage] = useState(mode.message)

  useEffect(() => {
    setMessage(mode.message)
  }, [mode.message])

  function saveMaintenanceMode(enabled = mode.enabled) {
    onChange(normalizeMaintenanceMode({
      enabled,
      message,
      updatedAt: new Date().toISOString(),
    }))
  }

  return (
    <section className={`rounded-lg border p-3 sm:p-4 ${mode.enabled ? 'border-amber-300/40 bg-amber-300/10' : 'border-stone-800 bg-stone-900'}`}>
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-lg text-stone-50 sm:text-xl">Modo manutenção</h2>
            <span className={`rounded-full px-2 py-1 text-xs font-black uppercase ${mode.enabled ? 'bg-amber-300 text-stone-950' : 'border border-stone-700 text-stone-400'}`}>
              {mode.enabled ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <p className="mt-1 text-sm text-stone-400">
            Quando ativo, leitores veem o comunicado de manutenção; superadmins continuam com acesso ao painel.
          </p>
          {mode.updatedAt && <p className="mt-2 text-xs font-semibold text-stone-500">Atualizado {formatDateTime(mode.updatedAt)}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={mode.enabled}
          onClick={() => saveMaintenanceMode(!mode.enabled)}
          className={`flex min-h-11 items-center justify-between gap-3 rounded-full border px-2 py-1 transition ${mode.enabled ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-700 bg-stone-950 text-stone-300 hover:border-stone-500'}`}
        >
          <span className="px-2 text-sm font-black">{mode.enabled ? 'Desativar' : 'Ativar'}</span>
          <span className={`h-8 w-8 rounded-full transition ${mode.enabled ? 'bg-stone-950' : 'bg-stone-700'}`} />
        </button>
      </div>
      <label className="mt-4 block text-xs font-bold uppercase text-stone-500">Mensagem para usuários</label>
      <textarea
        value={message}
        onChange={event => setMessage(event.target.value)}
        rows={3}
        className="mt-2 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => saveMaintenanceMode()}
          className="rounded-lg bg-stone-100 px-3 py-2 text-sm font-bold text-stone-950 transition hover:bg-stone-200"
        >
          Salvar mensagem
        </button>
        <button
          type="button"
          onClick={() => setMessage(DEFAULT_MAINTENANCE_MESSAGE)}
          className="rounded-lg border border-stone-700 px-3 py-2 text-sm font-bold text-stone-300 transition hover:bg-stone-800"
        >
          Restaurar texto padrão
        </button>
      </div>
    </section>
  )
}

function CommunityFeaturePanel({ feature, onChange }: {
  feature: CommunityFeature
  onChange: (changes: Partial<CommunityFeature>) => void
}) {
  const status = feature.enabled ? 'Disponível para todos' : feature.previewEnabled ? 'Prévia só para superadmins' : 'Desativada'
  return (
    <section className={`rounded-lg border p-3 sm:p-4 ${feature.enabled || feature.previewEnabled ? 'border-amber-300/40 bg-amber-300/10' : 'border-stone-800 bg-stone-900'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-lg text-stone-50 sm:text-xl">Comunidade do Chá</h2>
            <span className={`rounded-full px-2 py-1 text-xs font-black uppercase ${feature.enabled || feature.previewEnabled ? 'bg-amber-300 text-stone-950' : 'border border-stone-700 text-stone-400'}`}>{status}</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-stone-400">A prévia libera somente a visualização demonstrativa para superadmins. Ela não cria, altera ou exibe posts reais para leitores.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onChange({ enabled: false, previewEnabled: !feature.previewEnabled })} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${feature.previewEnabled && !feature.enabled ? 'bg-amber-300 text-stone-950' : 'border border-stone-700 text-stone-300 hover:bg-stone-800'}`}>
            {feature.previewEnabled && !feature.enabled ? 'Encerrar prévia' : 'Testar só comigo'}
          </button>
          <button type="button" onClick={() => onChange({ enabled: !feature.enabled, previewEnabled: false })} className={`rounded-lg px-3 py-2 text-sm font-bold transition ${feature.enabled ? 'bg-amber-300 text-stone-950' : 'border border-amber-300/50 text-amber-200 hover:bg-amber-300/10'}`}>
            {feature.enabled ? 'Desabilitar para todos' : 'Habilitar para todos'}
          </button>
        </div>
      </div>
    </section>
  )
}

function SuperAdminDashboardPage({ token, onUserClick, onBookClick, maintenanceMode, onMaintenanceModeChange, communityFeature, onCommunityFeatureChange }: {
  token: string
  onUserClick: (id: string) => void
  onBookClick: (id: string) => void
  maintenanceMode: MaintenanceMode
  onMaintenanceModeChange: (mode: MaintenanceMode) => void
  communityFeature: CommunityFeature
  onCommunityFeatureChange: (changes: Partial<CommunityFeature>) => void
}) {
  const [dashboard, setDashboard] = useState<SuperAdminDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [activeReport, setActiveReport] = useState<DashboardReportKey | null>(null)

  async function loadDashboard() {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const data = await apiRequest<SuperAdminDashboard>('/folio/superadmin/dashboard', {}, token)
      setDashboard(data)
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel carregar o painel tecnico.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setNotice('')
    apiRequest<SuperAdminDashboard>('/folio/superadmin/dashboard', {}, token)
      .then(data => {
        if (active) setDashboard(data)
      })
      .catch(err => {
        if (active) setError(errorMessage(err, 'Nao foi possivel carregar o painel tecnico.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [token])

  if (loading && !dashboard) {
    return (
      <section>
        <Header title="Painel técnico" />
        <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map(item => (
              <div key={item} className="rounded-lg border border-stone-800 bg-stone-900 p-4">
                <SkeletonBlock className="h-3 w-24 rounded" />
                <SkeletonBlock className="mt-4 h-8 w-16 rounded" />
                <SkeletonBlock className="mt-3 h-3 w-32 rounded" />
              </div>
            ))}
          </div>
          <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
            <SkeletonBlock className="mb-4 h-5 w-44 rounded" />
            <div className="grid gap-2 sm:grid-cols-2">
              {[0, 1, 2, 3].map(item => (
                <div key={item} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3">
                  <SkeletonBlock className="h-16 w-12 rounded-md" />
                  <div className="min-w-0">
                    <SkeletonBlock className="h-3 w-10/12 rounded" />
                    <SkeletonBlock className="mt-2 h-3 w-7/12 rounded" />
                  </div>
                  <SkeletonBlock className="h-7 w-8 rounded-lg" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    )
  }

  if (error && !dashboard) {
    return (
      <section>
        <Header title="Painel técnico">
          <button onClick={loadDashboard} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">Tentar novamente</button>
        </Header>
        <div className="p-4">
          <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>
        </div>
      </section>
    )
  }

  if (!dashboard) return null

  const statusRows = dashboard.statusBreakdown.map(row => ({ label: STATUS_LABELS[row.label as BookStatus] || row.label, count: row.count }))
  const postTypeRows = dashboard.postTypeBreakdown.map(row => ({
    label: row.label === 'comment' ? 'Comentários' : row.label === 'reaction' ? 'Reações' : row.label === 'theory' ? 'Teorias' : row.label,
    count: row.count,
  }))
  const pushMobileUsers = new Set(dashboard.reports.pushSubscriptions.filter(isDashboardMobilePushDevice).map(row => row.user.id)).size
  const pushTotalUsers = dashboard.overview.pushUsers ?? dashboard.overview.pushSubscriptions

  function openReport(report: DashboardReportKey) {
    setActiveReport(report)
    window.requestAnimationFrame(() => {
      document.getElementById('folio-dashboard-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  async function handleSendAdminPushTest() {
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const result = await apiRequest<{ recipients: number; subscriptions: number; sent: number; expired: number; failed: number; vapidConfigured: boolean }>('/folio/superadmin/push-test', { method: 'POST' }, token)
      const vapidText = result.vapidConfigured ? 'VAPID configurado' : 'VAPID sem chave válida'
      setNotice(`${result.sent} envio(s) para ${result.recipients} super admin(s), ${result.subscriptions} dispositivo(s). ${result.failed} falha(s), ${result.expired} expirado(s). ${vapidText}.`)
      return true
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel enviar o push de teste.'))
      return false
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <Header title="Painel técnico">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-xs font-semibold text-stone-400">
            Atualizado {formatDateTime(dashboard.generatedAt)}
          </span>
          <button onClick={loadDashboard} disabled={loading} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
          <button onClick={() => void handleSendAdminPushTest()} disabled={loading} className="rounded-lg border border-stone-700 px-3 py-2 text-sm font-bold text-stone-300 hover:bg-stone-900 disabled:opacity-60">
            Testar push
          </button>
        </div>
      </Header>

      <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
        {error && <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}
        {notice && <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">{notice}</div>}

        <MaintenanceModePanel mode={maintenanceMode} onChange={onMaintenanceModeChange} />
        <CommunityFeaturePanel feature={communityFeature} onChange={onCommunityFeatureChange} />

        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          <DashboardStat label="Usuários" value={dashboard.overview.totalUsers} detail="perfis Folio cadastrados" tone="cyan" active={activeReport === 'users'} onClick={() => openReport('users')} />
          <DashboardStat label="Posts hoje" value={dashboard.overview.postsToday} detail={`${dashboard.overview.postsThisMonth} no mês`} tone="amber" active={activeReport === 'postsToday'} onClick={() => openReport('postsToday')} />
          <DashboardStat label="Ativos agora" value={dashboard.overview.activeNow} detail="atividade nos últimos 15min" tone="emerald" active={activeReport === 'activeNow'} onClick={() => openReport('activeNow')} />
          <DashboardStat label="Interações hoje" value={dashboard.overview.likesToday + dashboard.overview.repliesToday + dashboard.overview.viewsToday + (dashboard.overview.mentionsToday || 0)} detail={`${dashboard.overview.viewsToday} visualizações · ${dashboard.overview.mentionsToday || 0} menções`} tone="rose" active={activeReport === 'interactionsToday'} onClick={() => openReport('interactionsToday')} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
          <DashboardStat label="Livros" value={dashboard.overview.totalBooks} detail={`${dashboard.overview.totalShelfEntries} entradas em estantes`} active={activeReport === 'books'} onClick={() => openReport('books')} />
          <DashboardStat label="Posts no ano" value={dashboard.overview.postsThisYear} detail={`${dashboard.overview.totalPosts} no total`} tone="cyan" active={activeReport === 'postsThisYear'} onClick={() => openReport('postsThisYear')} />
          <DashboardStat label="Logins hoje" value={dashboard.overview.loginsToday} detail="entradas autenticadas" tone="emerald" active={activeReport === 'loginsToday'} onClick={() => openReport('loginsToday')} />
          <DashboardStat label="Lembretes hoje" value={dashboard.overview.remindersToday || 0} detail={`${dashboard.overview.reminderUsersToday || 0} usuários alcançados`} tone="amber" />
          <DashboardStat label="Push mobile" value={pushMobileUsers} detail={`${pushTotalUsers} usuários · ${dashboard.overview.pushSubscriptions} dispositivos`} tone="rose" active={activeReport === 'pushSubscriptions'} onClick={() => openReport('pushSubscriptions')} />
        </div>

        {activeReport && (
          <SuperAdminReportPanel
            dashboard={dashboard}
            report={activeReport}
            onClose={() => setActiveReport(null)}
            onUserClick={onUserClick}
            onBookClick={onBookClick}
          />
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <DashboardBarChart title="Postagens por dia" points={dashboard.postsByDay} />
          <DashboardBarChart title="Postagens por mês" points={dashboard.postsByMonth} />
        </div>

        <DashboardEngagementChart rows={dashboard.engagementByDay} />

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
            <h2 className="mb-4 font-serif text-lg text-stone-50 sm:text-xl">Usuários mais ativos hoje</h2>
            <div className="space-y-2">
              {dashboard.topUsersToday.length ? dashboard.topUsersToday.map(row => (
                <button key={row.user.id} onClick={() => onUserClick(row.user.id)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-stone-800 bg-stone-950 p-2 text-left transition hover:border-amber-300/40 sm:gap-3 sm:p-3">
                  <DashboardAvatar user={row.user} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-stone-100">{row.user.name}</p>
                    <p className="truncate text-xs text-stone-500">@{row.user.handle || 'sem-handle'} · {formatTime(row.lastSeenAt)}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-stone-400">{row.posts} posts · {row.replies} respostas · {row.likes} curtidas · {row.views} views</p>
                  </div>
                  <span className="rounded-lg bg-amber-300 px-2 py-1 text-sm font-black text-stone-950">{row.actions}</span>
                </button>
              )) : <EmptyState text="Nenhuma atividade registrada hoje." />}
            </div>
          </section>

          <div className="grid gap-4">
            <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
              <h2 className="mb-4 font-serif text-lg text-stone-50 sm:text-xl">Ativos agora</h2>
              <div className="space-y-2">
                {dashboard.activeNow.length ? dashboard.activeNow.map(row => (
                  <button key={row.user.id} onClick={() => onUserClick(row.user.id)} className="flex w-full items-center gap-2 rounded-lg border border-stone-800 bg-stone-950 p-2 text-left transition hover:border-emerald-300/40 sm:gap-3 sm:p-3">
                    <DashboardAvatar user={row.user} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-100">{row.user.name}</p>
                      <p className="truncate text-xs text-stone-500">{formatTime(row.lastSeenAt)} · {row.actions} ações</p>
                    </div>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                  </button>
                )) : <EmptyState text="Ninguém com atividade nos últimos 15 minutos." />}
              </div>
            </section>

            <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
              <h2 className="mb-4 font-serif text-lg text-stone-50 sm:text-xl">Mais logaram hoje</h2>
              <div className="space-y-2">
                {dashboard.topLoginsToday.length ? dashboard.topLoginsToday.map(row => (
                  <button key={row.user.id} onClick={() => onUserClick(row.user.id)} className="flex w-full items-center gap-2 rounded-lg border border-stone-800 bg-stone-950 p-2 text-left transition hover:border-cyan-300/40 sm:gap-3 sm:p-3">
                    <DashboardAvatar user={row.user} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-100">{row.user.name}</p>
                      <p className="truncate text-xs text-stone-500">último login {formatTime(row.lastLoginAt)}</p>
                    </div>
                    <span className="rounded-lg bg-cyan-300 px-2 py-1 text-xs font-black text-stone-950">{row.logins}</span>
                  </button>
                )) : <EmptyState text="Nenhum login registrado hoje." />}
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4 xl:col-span-2">
            <h2 className="mb-4 font-serif text-lg text-stone-50 sm:text-xl">Livros com mais posts</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {dashboard.topBooks.length ? dashboard.topBooks.map(book => (
                <button key={book.id} onClick={() => onBookClick(book.id)} className="grid grid-cols-[48px_1fr_auto] items-center gap-2 rounded-lg border border-stone-800 bg-stone-950 p-2 text-left transition hover:border-amber-300/40 sm:grid-cols-[52px_1fr_auto] sm:gap-3 sm:p-3">
                  {book.cover ? <FolioImage src={book.cover} alt={book.title} className="h-16 w-12 rounded-md object-cover" /> : <div className="h-16 w-12 rounded-md bg-stone-800" />}
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold text-stone-100">{book.title}</p>
                    <p className="truncate text-xs text-stone-500">{book.author}</p>
                    <p className="mt-1 text-xs text-stone-400">{book.readers} leitores na estante</p>
                  </div>
                  <span className="rounded-lg bg-stone-800 px-2 py-1 text-xs font-black text-amber-300">{book.posts}</span>
                </button>
              )) : <EmptyState text="Nenhum post por livro ainda." />}
            </div>
          </section>

          <div className="grid gap-4">
            <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
              <h2 className="mb-4 font-serif text-lg text-stone-50 sm:text-xl">Estantes</h2>
              <DashboardListMetric rows={statusRows} emptyText="Sem dados de estante." />
            </section>
            <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
              <h2 className="mb-4 font-serif text-lg text-stone-50 sm:text-xl">Tipos de post</h2>
              <DashboardListMetric rows={postTypeRows} emptyText="Sem postagens ainda." />
            </section>
          </div>
        </div>

        <DashboardBarChart title="Postagens por ano" points={dashboard.postsByYear} />
      </div>
    </section>
  )
}

function AiLabPage({ token, books }: { token: string; books: Book[] }) {
  const emptyProfileLabel = 'Novo perfil'
  const conversationModes: { value: AiConversationMode; label: string; description: string }[] = [
    { value: 'chapter-guide', label: 'Guia do capítulo', description: 'Tira dúvidas objetivas sem spoiler.' },
    { value: 'character', label: 'Personagem', description: 'Responde com uma voz/persona escolhida.' },
    { value: 'literary-analysis', label: 'Análise literária', description: 'Comenta tom, atmosfera e construção.' },
    { value: 'spoiler-free-theory', label: 'Teorias sem spoiler', description: 'Levanta hipóteses sem confirmar.' },
  ]
  const [bookId, setBookId] = useState(books[0]?.id || '')
  const [profiles, setProfiles] = useState<AiCharacterProfile[]>([])
  const [sources, setSources] = useState<AiSourceSummary[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [conversationMode, setConversationMode] = useState<AiConversationMode>('chapter-guide')
  const [characterName, setCharacterName] = useState('Personagem teste')
  const [persona, setPersona] = useState('fala como alguem atento aos detalhes, emocionalmente contido e cuidadoso com spoilers')
  const [traitsText, setTraitsText] = useState('observador, cauteloso, literario')
  const [knownFactsText, setKnownFactsText] = useState('Sabe apenas os eventos ate o capitulo informado.\nPode comentar pistas, atmosfera e conflitos ja apresentados.')
  const [forbiddenFactsText, setForbiddenFactsText] = useState('revelacao final\nidentidade do culpado\nmorte futura')
  const [memoriesText, setMemoriesText] = useState('1|0|O personagem ainda deve falar apenas sobre o que apareceu no começo do livro.')
  const [sourceChunksText, setSourceChunksText] = useState('')
  const [chapter, setChapter] = useState(1)
  const [percent, setPercent] = useState(5)
  const [message, setMessage] = useState('O que voce acha que eu deveria observar nesse ponto da leitura?')
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([])
  const [response, setResponse] = useState<AiLabResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [loadingSources, setLoadingSources] = useState(false)
  const [deletingSourceId, setDeletingSourceId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!bookId && books[0]?.id) setBookId(books[0].id)
  }, [bookId, books])

  useEffect(() => {
    let active = true
    apiRequest<AiCharacterProfile[]>('/folio/superadmin/ai/characters', {}, token)
      .then(data => {
        if (active) setProfiles(data)
      })
      .catch(err => {
        if (active) setError(errorMessage(err, 'Nao foi possivel carregar os personagens.'))
      })

    return () => {
      active = false
    }
  }, [token])

  async function loadSources(nextBookId = bookId) {
    setLoadingSources(true)
    try {
      const query = nextBookId ? `?bookId=${encodeURIComponent(nextBookId)}` : ''
      const data = await apiRequest<AiSourceSummary[]>(`/folio/superadmin/ai/sources${query}`, {}, token)
      setSources(data)
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel carregar as fontes privadas.'))
    } finally {
      setLoadingSources(false)
    }
  }

  useEffect(() => {
    void loadSources(bookId)
  }, [bookId, token])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chatMessages, loading])

  const selectedBook = books.find(book => book.id === bookId)
  const maxChapter = selectedBook?.totalChapters || 120
  const selectedProfile = profiles.find(profile => profile.id === selectedProfileId)
  const selectedConversationMode = conversationModes.find(mode => mode.value === conversationMode) || conversationModes[0]

  function formatSourceSize(size: number) {
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
    if (size >= 1024) return `${Math.ceil(size / 1024)} KB`
    return `${size} B`
  }

  function nextChatId(role: AiChatMessage['role']) {
    return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  function chatHistoryPayload() {
    return chatMessages.slice(-8).map(item => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    }))
  }

  function splitList(value: string) {
    return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean)
  }

  function splitMultiline(value: string) {
    return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean)
  }

  function formatMemories(memories: AiCharacterMemory[]) {
    return memories
      .map(memory => `${memory.chapter}|${memory.percent}|${memory.text}`)
      .join('\n')
  }

  function parseMemories(value: string): AiCharacterMemory[] {
    return value
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split('|').map(part => part.trim())
        if (parts.length >= 3) {
          return {
            chapter: Math.max(1, Number(parts[0]) || 1),
            percent: clamp(Number(parts[1]) || 0, 0, 100),
            kind: 'fact',
            text: parts.slice(2).join('|').trim(),
          }
        }

        return {
          chapter,
          percent,
          kind: 'fact',
          text: line,
        }
      })
      .filter(memory => Boolean(memory.text))
  }

  function formatSourceChunks(chunks: AiCharacterSourceChunk[]) {
    return chunks
      .map(chunk => `${chunk.chapter}|${chunk.percent}|${chunk.title || 'Trecho'}|${chunk.text}`)
      .join('\n')
  }

  function parseSourceChunks(value: string): AiCharacterSourceChunk[] {
    return value
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split('|').map(part => part.trim())
        if (parts.length >= 4) {
          return {
            chapter: Math.max(1, Number(parts[0]) || 1),
            percent: clamp(Number(parts[1]) || 0, 0, 100),
            title: parts[2],
            text: parts.slice(3).join('|').trim(),
          }
        }

        return {
          chapter,
          percent,
          title: 'Trecho importado',
          text: line,
        }
      })
      .filter(chunk => Boolean(chunk.text))
  }

  async function handleImportContextFile(file: File) {
    setError('')
    setNotice('')
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !['txt', 'md'].includes(extension)) {
      setError('Por enquanto a ingestao automatica aceita .txt ou .md. PDF/ePUB entram na proxima etapa.')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('bookId', bookId)
    formData.append('chapter', String(chapter))
    formData.append('percent', String(percent))

    try {
      const response = await fetch(`${API_BASE_URL}/folio/superadmin/ai/sources`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      })

      if (!response.ok) {
        throw new ApiRequestError(response.status, await response.text())
      }

      const result = await response.json() as AiSourceImportResponse
      const importedCount = result.chunkCount || result.chunks?.length || 0
      if (!importedCount) {
        setError(result.skipped || 'Nao encontrei texto util nesse arquivo.')
        return
      }

      setSources(current => [
        {
          id: result.sourceId,
          bookId: result.bookId,
          fileName: result.fileName,
          storedFileName: result.storedFileName,
          size: result.size,
          chunkCount: importedCount,
          importedAt: result.importedAt,
        },
        ...current.filter(source => source.id !== result.sourceId),
      ])
      setNotice(`${importedCount} trecho(s) salvos na biblioteca privada de ${result.fileName}.`)
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel importar o arquivo fonte.'))
    }
  }

  async function handleDeleteSource(source: AiSourceSummary) {
    const confirmed = window.confirm(`Remover a fonte privada "${source.fileName}"?`)
    if (!confirmed) return

    setDeletingSourceId(source.id)
    setError('')
    setNotice('')
    try {
      await apiRequest(`/folio/superadmin/ai/sources/${source.id}`, { method: 'DELETE' }, token)
      setSources(current => current.filter(item => item.id !== source.id))
      setNotice(`Fonte removida: ${source.fileName}.`)
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel remover a fonte privada.'))
    } finally {
      setDeletingSourceId('')
    }
  }

  function applyProfile(profile: AiCharacterProfile) {
    setSelectedProfileId(profile.id)
    setBookId(profile.bookId || '')
    setCharacterName(profile.name)
    setPersona(profile.persona)
    setTraitsText(profile.traits.join(', '))
    setForbiddenFactsText(profile.forbiddenFacts.join('\n'))
    setMemoriesText(formatMemories(profile.memories))
    setSourceChunksText(formatSourceChunks(profile.sourceChunks || []))
    setNotice(`Perfil carregado: ${profile.name}.`)
    setError('')
  }

  async function handleSaveProfile() {
    setSavingProfile(true)
    setError('')
    setNotice('')
    try {
      const saved = await apiRequest<AiCharacterProfile>('/folio/superadmin/ai/characters', {
        method: 'POST',
        body: JSON.stringify({
          id: selectedProfileId || null,
          bookId: bookId || null,
          name: characterName,
          persona,
          traits: splitList(traitsText),
          forbiddenFacts: splitMultiline(forbiddenFactsText),
          memories: parseMemories(memoriesText),
          sourceChunks: parseSourceChunks(sourceChunksText),
        }),
      }, token)
      setProfiles(current => {
        const next = current.filter(profile => profile.id !== saved.id)
        return [...next, saved].sort((a, b) => a.name.localeCompare(b.name))
      })
      setSelectedProfileId(saved.id)
      setNotice(`Perfil salvo: ${saved.name}.`)
      return true
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel salvar o perfil.'))
      return false
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const outgoingMessage = message.trim()
    if (!outgoingMessage) {
      setError('Informe uma mensagem para continuar a conversa.')
      return
    }

    const userChatMessage: AiChatMessage = {
      id: nextChatId('user'),
      role: 'user',
      content: outgoingMessage,
      createdAt: new Date().toISOString(),
    }
    setChatMessages(current => [...current, userChatMessage])
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const data = await apiRequest<AiLabResponse>('/folio/superadmin/ai/character-reply', {
        method: 'POST',
        body: JSON.stringify({
          characterProfileId: selectedProfileId || null,
          bookId: bookId || null,
          conversationMode,
          chatHistory: chatHistoryPayload(),
          characterName,
          persona,
          traits: splitList(traitsText),
          knownFacts: splitMultiline(knownFactsText),
          forbiddenFacts: splitMultiline(forbiddenFactsText),
          sourceChunks: parseSourceChunks(sourceChunksText),
          chapter,
          percent,
          userMessage: outgoingMessage,
        }),
      }, token)
      setResponse(data)
      setChatMessages(current => [
        ...current,
        {
          id: nextChatId('assistant'),
          role: 'assistant',
          content: data.reply,
          createdAt: data.generatedAt,
          response: data,
        },
      ])
      setMessage('')
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel executar o laboratorio de IA.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <Header title="Laboratório de IA">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200">
            Acesso superadmin
          </span>
          {response && (
            <span className="rounded-lg border border-stone-800 bg-stone-900 px-3 py-2 text-xs font-semibold text-stone-400">
              Atualizado {formatDateTime(response.generatedAt)}
            </span>
          )}
        </div>
      </Header>

      <div className="grid gap-4 p-3 sm:p-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4 rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block text-sm font-semibold text-stone-300">
              Perfil
              <select
                value={selectedProfileId}
                onChange={e => {
                  const profile = profiles.find(item => item.id === e.target.value)
                  if (profile) applyProfile(profile)
                  else {
                    setSelectedProfileId('')
                    setNotice(emptyProfileLabel)
                  }
                }}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
              >
                <option value="">{emptyProfileLabel}</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={savingProfile}
              className="self-end rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100 transition hover:bg-amber-300/20 disabled:opacity-60"
            >
              {savingProfile ? 'Salvando...' : 'Salvar perfil'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-stone-300">
              Livro
              <select
                value={bookId}
                onChange={e => setBookId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
              >
                <option value="">Sem livro vinculado</option>
                {books.map(book => (
                  <option key={book.id} value={book.id}>{book.title}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-stone-300">
              Personagem
              <input
                value={characterName}
                onChange={e => setCharacterName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-stone-300">
            Modo de conversa
            <select
              value={conversationMode}
              onChange={e => setConversationMode(e.target.value as AiConversationMode)}
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
            >
              {conversationModes.map(mode => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-stone-500">{selectedConversationMode.description}</span>
          </label>

          <label className="block text-sm font-semibold text-stone-300">
            Persona
            <textarea
              rows={3}
              value={persona}
              onChange={e => setPersona(e.target.value)}
              className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-100 outline-none focus:border-amber-300"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-stone-300">
              Traços
              <textarea
                rows={4}
                value={traitsText}
                onChange={e => setTraitsText(e.target.value)}
                className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-100 outline-none focus:border-amber-300"
              />
            </label>
            <label className="block text-sm font-semibold text-stone-300">
              Fatos permitidos
              <textarea
                rows={4}
                value={knownFactsText}
                onChange={e => setKnownFactsText(e.target.value)}
                className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-100 outline-none focus:border-amber-300"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-stone-300">
            Fatos bloqueados
            <textarea
              rows={3}
              value={forbiddenFactsText}
              onChange={e => setForbiddenFactsText(e.target.value)}
              className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-100 outline-none focus:border-amber-300"
            />
          </label>

          <label className="block text-sm font-semibold text-stone-300">
            Memórias por progresso
            <textarea
              rows={5}
              value={memoriesText}
              onChange={e => setMemoriesText(e.target.value)}
              placeholder="1|0|Texto da memória"
              className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-100 outline-none focus:border-amber-300"
            />
          </label>

          <div className="rounded-lg border border-stone-800 bg-stone-950 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-stone-200">Fontes privadas</p>
                <p className="text-xs text-stone-500">Usadas automaticamente pelo livro, capítulo e porcentagem.</p>
              </div>
              <span className="rounded-lg border border-stone-700 px-2.5 py-1 text-xs font-bold text-stone-400">
                {loadingSources ? 'Carregando...' : `${sources.length} arquivo(s)`}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {sources.length ? sources.slice(0, 5).map(source => (
                <div key={source.id} className="flex gap-3 rounded-lg border border-stone-800 bg-stone-900 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-100">{source.fileName}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {source.chunkCount.toLocaleString('pt-BR')} trecho(s) · {formatSourceSize(source.size)} · {formatDateTime(source.importedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSource(source)}
                    disabled={deletingSourceId === source.id}
                    className="self-center rounded-lg border border-red-300/20 px-2.5 py-1 text-xs font-bold text-red-200 transition hover:bg-red-300/10 disabled:opacity-50"
                  >
                    {deletingSourceId === source.id ? 'Removendo...' : 'Remover'}
                  </button>
                </div>
              )) : (
                <p className="rounded-lg border border-dashed border-stone-800 px-3 py-3 text-xs text-stone-500">
                  Nenhuma fonte privada para este livro ainda.
                </p>
              )}
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-stone-700 bg-stone-950 px-4 py-3 text-sm font-bold text-stone-300 transition hover:border-amber-300/50 hover:text-amber-200">
            Adicionar fonte .txt/.md
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="sr-only"
              onChange={e => {
                const file = e.target.files?.[0]
                e.currentTarget.value = ''
                if (file) void handleImportContextFile(file)
              }}
            />
          </label>

          <label className="block text-sm font-semibold text-stone-300">
            Contexto fonte manual
            <textarea
              rows={4}
              value={sourceChunksText}
              onChange={e => setSourceChunksText(e.target.value)}
              placeholder="1|0|Cena inicial|Texto do trecho"
              className="mt-1 w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-100 outline-none focus:border-amber-300"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-stone-300">
              Capítulo
              <input
                type="number"
                min={1}
                max={maxChapter}
                value={chapter}
                onChange={e => setChapter(Math.max(1, Math.min(maxChapter, Number(e.target.value) || 1)))}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
              />
            </label>
            <label className="block text-sm font-semibold text-stone-300">
              Porcentagem
              <input
                type="number"
                min={0}
                max={100}
                value={percent}
                onChange={e => setPercent(clamp(Number(e.target.value) || 0, 0, 100))}
                className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
              />
            </label>
          </div>

          {error && <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}
          {notice && <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100">{notice}</div>}
        </div>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-stone-800 bg-stone-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-800 px-3 py-3 sm:px-4">
              <div>
                <h2 className="font-serif text-lg text-stone-50">{selectedConversationMode.label}</h2>
                <p className="text-xs text-stone-500">Cap. {chapter} · {percent}% · {selectedBook?.title || 'sem livro'}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setChatMessages([])
                  setResponse(null)
                }}
                disabled={!chatMessages.length && !response}
                className="rounded-lg border border-stone-700 px-3 py-1.5 text-xs font-bold text-stone-300 transition hover:bg-stone-800 disabled:opacity-50"
              >
                Limpar conversa
              </button>
            </div>

            <div className="flex h-[560px] flex-col bg-stone-950">
              <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
                {chatMessages.length ? chatMessages.map(item => (
                  <div key={item.id} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      item.role === 'user'
                        ? 'rounded-br-sm bg-amber-300 text-stone-950'
                        : 'rounded-bl-sm border border-stone-800 bg-stone-900 text-stone-100'
                    }`}>
                      <p className="whitespace-pre-wrap">{item.content}</p>
                      <p className={`mt-2 text-[11px] font-semibold ${item.role === 'user' ? 'text-stone-700' : 'text-stone-500'}`}>
                        {item.role === 'user' ? 'Você' : item.response?.character || characterName} · {formatDateTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="flex h-full items-center justify-center">
                    <EmptyState text="Comece uma conversa sobre este ponto da leitura." />
                  </div>
                )}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm border border-stone-800 bg-stone-900 px-4 py-3 text-sm text-stone-400">
                      {selectedConversationMode.label} está respondendo...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSubmit} className="border-t border-stone-800 bg-stone-900 p-3">
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Mensagem"
                    className="min-h-[48px] flex-1 resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-100 outline-none focus:border-amber-300"
                  />
                  <button
                    disabled={loading}
                    className="self-end rounded-lg bg-amber-300 px-4 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-200 disabled:bg-stone-700 disabled:text-stone-500"
                  >
                    {loading ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            </div>

            {response && (
              <div className="space-y-4 border-t border-stone-800 p-3 sm:p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-stone-800 bg-stone-950 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Modo</p>
                    <p className="mt-1 text-sm font-bold text-stone-100">
                      {conversationModes.find(mode => mode.value === response.conversationMode)?.label || selectedConversationMode.label}
                    </p>
                  </div>
                  <div className="rounded-lg border border-stone-800 bg-stone-950 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Limite</p>
                    <p className="mt-1 text-sm font-bold text-stone-100">Cap. {response.spoilerBoundary.chapter} · {response.spoilerBoundary.percent}%</p>
                  </div>
                </div>
                <div className="rounded-lg border border-stone-800 bg-stone-950 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Referência</p>
                  <p className="mt-1 text-sm font-bold text-stone-100">{response.characterProfileId && selectedProfile ? selectedProfile.name : response.character}</p>
                </div>
                <div className="rounded-lg border border-stone-800 bg-stone-950 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Prompt</p>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-stone-400">{response.promptPreview}</p>
                </div>
              </div>
            )}
          </section>

          {response && (
            <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
              <h2 className="font-serif text-lg text-stone-50">Etapas internas</h2>
              <div className="mt-4 space-y-2">
                {response.learningTrace.map(step => (
                  <div key={step.label} className="rounded-lg border border-stone-800 bg-stone-950 p-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-300">{step.label}</p>
                    <p className="mt-1 text-sm font-bold text-stone-100">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-400">{step.detail}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {response.guardrails.map(rule => (
                  <span key={rule} className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-1.5 text-xs font-semibold text-stone-300">{rule}</span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  )
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const STORE_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  preparing: 'Preparando',
  sent: 'Enviado',
  completed: 'Concluido',
  cancelled: 'Cancelado',
}

const STORE_REQUEST_STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  reviewing: 'Em analise',
  approved: 'Aprovada',
  declined: 'Recusada',
  fulfilled: 'Atendida',
}

function StorePage({ token, currentUser }: { token: string; currentUser: User }) {
  const emptyProduct = { name: '', description: '', imageUrl: '', price: 0, stock: 0, category: '', bookId: '', isActive: true }
  const [store, setStore] = useState<StoreBootstrap>({ products: [], requests: [], orders: [] })
  const [tab, setTab] = useState<'shop' | 'cart' | 'products' | 'requests' | 'orders'>('shop')
  const [storeViewMode, setStoreViewMode] = useState<'client' | 'admin'>('client')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null)
  const [productDraft, setProductDraft] = useState(emptyProduct)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [cart, setCart] = useState<StoreCartItem[]>([])
  const [checkout, setCheckout] = useState({ customerName: currentUser.name, email: currentUser.email, phone: '', shippingAddress: '' })
  const [suggestion, setSuggestion] = useState({ name: '', description: '', referenceUrl: '' })
  const activeProducts = store.products.filter(product => product.isActive)
  const filteredProducts = activeProducts.filter(product => {
    const needle = normalizeSearch(productQuery)
    if (!needle) return true
    return [product.name, product.description || '', product.category || ''].some(value => normalizeSearch(value).includes(needle))
  })
  const productCategories = ['Todos', ...Array.from(new Set(activeProducts.map(product => product.category?.trim()).filter((value): value is string => Boolean(value))))]
  const visibleProducts = filteredProducts.filter(product => selectedCategory === 'Todos' || product.category?.trim() === selectedCategory)
  const cartRows = cart
    .map(item => ({ item, product: store.products.find(product => product.id === item.productId) }))
    .filter((row): row is { item: StoreCartItem; product: StoreProduct } => Boolean(row.product))
  const cartTotal = cartRows.reduce((sum, row) => sum + row.product.price * row.item.quantity, 0)
  const cartQuantity = cartRows.reduce((sum, row) => sum + row.item.quantity, 0)
  const hasLoadedStoreData = store.products.length > 0 || store.requests.length > 0 || store.orders.length > 0

  async function loadStore() {
    setLoading(true)
    setError('')
    try {
      setStore(await apiRequest<StoreBootstrap>('/folio/store', {}, token))
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel carregar a loja.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStore()
  }, [currentUser.id])

  function editProduct(product: StoreProduct) {
    setEditingProductId(product.id)
    setProductDraft({
      name: product.name,
      description: product.description || '',
      imageUrl: product.imageUrl || '',
      price: product.price,
      stock: product.stock,
      category: product.category || '',
      bookId: product.bookId || '',
      isActive: product.isActive,
    })
    setTab('products')
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const path = editingProductId ? `/folio/store/products/${editingProductId}` : '/folio/store/products'
      await apiRequest(path, {
        method: editingProductId ? 'PATCH' : 'POST',
        body: JSON.stringify(productDraft),
      }, token)
      setProductDraft(emptyProduct)
      setEditingProductId(null)
      await loadStore()
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel salvar o produto.'))
    }
  }

  function addToCart(productId: string) {
    setNotice('')
    setCart(current => {
      const existing = current.find(item => item.productId === productId)
      if (existing) return current.map(item => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item)
      return [...current, { productId, quantity: 1 }]
    })
  }

  function switchStoreViewMode(mode: 'client' | 'admin') {
    setStoreViewMode(mode)
    setSelectedProduct(null)
    setTab(mode === 'client' ? 'shop' : 'products')
  }

  function updateCart(productId: string, quantity: number) {
    setCart(current => current
      .map(item => item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item)
      .filter(item => item.quantity > 0))
  }

  async function finishCheckout(e: React.FormEvent) {
    e.preventDefault()
    if (!cartRows.length) return
    setError('')
    setNotice('')
    try {
      await apiRequest('/folio/store/orders', {
        method: 'POST',
        body: JSON.stringify({
          ...checkout,
          items: cartRows.map(row => ({ productId: row.product.id, quantity: row.item.quantity })),
        }),
      }, token)
      setCart([])
      await loadStore()
      setNotice('Pedido enviado com sucesso. Voce pode acompanhar a confirmacao pelo atendimento da loja.')
      setTab(storeViewMode === 'client' ? 'shop' : 'orders')
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel finalizar a compra.'))
    }
  }

  async function submitSuggestion(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await apiRequest('/folio/store/product-requests', { method: 'POST', body: JSON.stringify(suggestion) }, token)
      setSuggestion({ name: '', description: '', referenceUrl: '' })
      await loadStore()
      setTab('requests')
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel enviar a solicitacao.'))
    }
  }

  async function updateRequestStatus(id: string, status: string) {
    await apiRequest(`/folio/store/product-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token)
    await loadStore()
  }

  async function updateOrderStatus(id: string, status: string) {
    if (storeViewMode !== 'admin') return
    await apiRequest(`/folio/store/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token)
    await loadStore()
  }

  return (
    <section>
      {storeViewMode === 'client' ? (
        <header className="sticky top-0 z-20 border-b border-stone-800/80 bg-stone-950/95 px-3 py-3 text-stone-100 shadow-sm backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-stone-700 bg-stone-900 px-3 py-2 shadow-sm">
              <svg className="h-5 w-5 shrink-0 text-stone-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
                placeholder="Pesquisar em Livros"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-100 outline-none placeholder:text-stone-500 sm:text-base"
              />
            </div>
            <button
              onClick={() => setTab('cart')}
              aria-label="Abrir carrinho"
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${tab === 'cart' ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-700 bg-stone-900 text-stone-100 hover:bg-stone-800'}`}
            >
              <NavIcon name="store" />
              {cartQuantity > 0 && (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-400 px-1.5 py-0.5 text-center text-[10px] font-black text-stone-950">
                  {cartQuantity}
                </span>
              )}
            </button>
          </div>
          <div className="mx-auto mt-2 flex w-full max-w-5xl justify-end">
            <button onClick={() => switchStoreViewMode('admin')} className="rounded-full border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs font-black text-stone-300 transition hover:bg-stone-800 hover:text-stone-100">
              Modo admin
            </button>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-20 border-b border-stone-800/80 bg-stone-950/95 px-4 py-3 backdrop-blur-xl md:px-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-serif text-xl text-stone-100">Loja</h1>
            <div className="flex items-center gap-2">
              <button onClick={() => switchStoreViewMode('client')} className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-black text-stone-300 transition hover:bg-stone-900 hover:text-stone-100">
                Ver como cliente
              </button>
              <button
                onClick={() => setTab('cart')}
                aria-label="Abrir carrinho"
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${tab === 'cart' ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-700 bg-stone-900 text-stone-100 hover:bg-stone-800'}`}
              >
                <NavIcon name="store" />
                {cartQuantity > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 rounded-full bg-red-400 px-1.5 py-0.5 text-[10px] font-black text-stone-950">
                    {cartQuantity}
                  </span>
                )}
              </button>
            </div>
          </div>
          <div className="mt-3 flex justify-center overflow-hidden">
            <div className="grid w-full max-w-xl grid-cols-4 rounded-lg border border-stone-800 bg-stone-900 p-1">
              {(['shop', 'products', 'requests', 'orders'] as const).map(item => (
                <button
                  key={item}
                  onClick={() => setTab(item)}
                  className={`min-w-0 rounded-md px-1.5 py-2 text-center text-[11px] font-bold transition sm:px-4 sm:text-xs ${tab === item ? 'bg-amber-300 text-stone-950' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'}`}
                >
                  <span className="block truncate">{item === 'shop' ? 'Vitrine' : item === 'products' ? 'Produtos' : item === 'requests' ? 'Solicitacoes' : 'Pedidos'}</span>
                </button>
              ))}
            </div>
          </div>
        </header>
      )}

      <div className="space-y-4 p-3 sm:p-4">
        {loading && !hasLoadedStoreData && <div className="rounded-lg border border-stone-800 bg-stone-900 p-4 text-sm text-stone-400">Carregando loja...</div>}
        {error && <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}
        {notice && <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-semibold text-amber-300">{notice}</div>}

        {tab === 'shop' && storeViewMode === 'client' && (
          <div className="mx-auto max-w-5xl overflow-hidden rounded-lg border border-stone-800 bg-stone-900 text-stone-100 shadow-sm">
            <section className="border-b border-stone-800 bg-stone-950 p-3 sm:p-4">
              <h2 className="text-lg font-black sm:text-xl">Ofertas em livros</h2>
              <div className="mt-3 max-w-full overflow-x-auto pb-1">
                <div className="flex w-max max-w-none gap-2">
                  {productCategories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`flex h-16 min-w-24 shrink-0 items-center justify-center rounded-lg border px-3 text-center text-sm font-black transition ${selectedCategory === category ? 'border-amber-300 bg-amber-300 text-stone-950' : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700 hover:text-stone-100'}`}
                    >
                      <span className="line-clamp-2">{category}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="p-3 sm:p-4">
              <div className="mb-3">
                <h2 className="text-lg font-black">Vitrine</h2>
                <p className="text-sm font-semibold text-stone-500">{visibleProducts.length} produto{visibleProducts.length === 1 ? '' : 's'} encontrado{visibleProducts.length === 1 ? '' : 's'}</p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3">
                {visibleProducts.map(product => (
                  <article key={product.id} className="flex h-full min-w-0 flex-col bg-stone-900">
                    <button type="button" onClick={() => setSelectedProduct(product)} className="block w-full text-left">
                      {product.imageUrl ? (
                        <img src={resolveMediaUrl(product.imageUrl)} alt={product.name} className="aspect-[3/4] w-full rounded-sm bg-stone-800 object-cover" />
                      ) : (
                        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-sm bg-stone-800 text-xs font-bold text-stone-500">Sem imagem</div>
                      )}
                    </button>
                    <button type="button" onClick={() => setSelectedProduct(product)} className="mt-2 block min-w-0 text-left">
                      <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-tight text-stone-100">{product.name}</h3>
                      <p className="mt-0.5 min-h-4 line-clamp-1 text-xs text-stone-500">{product.category || 'Livro'}</p>
                    </button>
                    <div className="mt-1 flex items-baseline gap-1 text-amber-300">
                      <span className="text-xs font-bold">R$</span>
                      <span className="text-2xl font-semibold leading-none">{money(product.price).replace('R$', '').trim()}</span>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-stone-500">{product.stock ? `${product.stock} em estoque` : 'Disponibilidade sob consulta'}</p>
                    <div className="mt-auto pt-3">
                      <button onClick={() => addToCart(product.id)} className="h-10 w-full rounded-full bg-amber-300 px-3 text-sm font-semibold leading-tight text-stone-950 shadow-sm transition hover:bg-amber-200">
                        Adicionar ao carrinho
                      </button>
                    </div>
                  </article>
                ))}
                {!visibleProducts.length && <div className="col-span-2 lg:col-span-3"><EmptyState text={activeProducts.length ? 'Nenhum produto encontrado.' : 'Nenhum produto ativo na loja ainda.'} /></div>}
              </div>
            </section>
          </div>
        )}

        {tab === 'shop' && storeViewMode === 'admin' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
              <input
                value={productQuery}
                onChange={e => setProductQuery(e.target.value)}
                placeholder="Pesquisar produto, categoria ou descricao"
                className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-300"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map(product => (
                <article key={product.id} className="overflow-hidden rounded-lg border border-stone-800 bg-stone-900">
                  <button type="button" onClick={() => setSelectedProduct(product)} className="block w-full text-left">
                    {product.imageUrl ? <img src={resolveMediaUrl(product.imageUrl)} alt={product.name} className="h-44 w-full object-cover" /> : <div className="flex h-44 items-center justify-center bg-stone-800 text-sm text-stone-500">Sem imagem</div>}
                  </button>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <button type="button" onClick={() => setSelectedProduct(product)} className="min-w-0 text-left">
                        <h2 className="line-clamp-2 font-serif text-lg text-stone-50">{product.name}</h2>
                        <p className="mt-1 text-sm font-black text-amber-300">{money(product.price)}</p>
                      </button>
                      <button onClick={() => editProduct(product)} className="rounded-lg border border-stone-700 px-2 py-1 text-xs font-bold text-stone-300">Editar</button>
                    </div>
                    {product.description && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-400">{product.description}</p>}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-stone-500">{product.stock ? `${product.stock} em estoque` : 'Sob consulta'}</span>
                      <button onClick={() => addToCart(product.id)} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">Adicionar</button>
                    </div>
                  </div>
                </article>
              ))}
              {!filteredProducts.length && <div className="sm:col-span-2 2xl:col-span-3"><EmptyState text={activeProducts.length ? 'Nenhum produto encontrado.' : 'Nenhum produto ativo na loja ainda.'} /></div>}
            </div>
          </div>
        )}

        {tab === 'cart' && (
          <form onSubmit={finishCheckout} className="grid gap-4 xl:grid-cols-[1fr_22rem]">
            <section className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl text-stone-50">Carrinho</h2>
                <button type="button" onClick={() => setTab('shop')} className="rounded-lg border border-stone-700 px-3 py-2 text-xs font-bold text-stone-300">Continuar comprando</button>
              </div>
              <div className="space-y-2">
                {cartRows.length ? cartRows.map(row => (
                  <div key={row.product.id} className="grid grid-cols-[56px_1fr] gap-3 rounded-lg border border-stone-800 bg-stone-950 p-2 sm:grid-cols-[64px_1fr_auto] sm:items-center">
                    {row.product.imageUrl ? <img src={resolveMediaUrl(row.product.imageUrl)} alt={row.product.name} className="h-20 w-14 rounded-md object-cover sm:h-24 sm:w-16" /> : <div className="h-20 w-14 rounded-md bg-stone-800 sm:h-24 sm:w-16" />}
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-stone-100">{row.product.name}</p>
                      <p className="mt-1 text-xs text-stone-500">{money(row.product.price)} cada</p>
                      <div className="mt-3 flex items-center gap-2">
                        <input type="number" min="1" value={row.item.quantity} onChange={e => updateCart(row.product.id, Number(e.target.value))} className="w-20 rounded-lg border border-stone-700 bg-stone-900 px-2 py-1.5 text-sm text-stone-100" />
                        <button type="button" onClick={() => setCart(current => current.filter(item => item.productId !== row.product.id))} className="rounded-lg px-2 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/10">Remover</button>
                      </div>
                    </div>
                    <p className="col-span-2 text-right text-sm font-black text-amber-300 sm:col-span-1">{money(row.product.price * row.item.quantity)}</p>
                  </div>
                )) : <EmptyState text="Carrinho vazio." />}
              </div>
            </section>

            <aside className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
              <h2 className="font-serif text-xl text-stone-50">Finalizar compra</h2>
              <div className="mt-3 rounded-lg bg-stone-950 p-3">
                <div className="flex justify-between text-sm font-bold text-stone-400">
                  <span>Subtotal</span>
                  <span>{money(cartTotal)}</span>
                </div>
                <div className="mt-2 flex justify-between text-lg font-black text-stone-50">
                  <span>Total</span>
                  <span>{money(cartTotal)}</span>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <input value={checkout.customerName} onChange={e => setCheckout({ ...checkout, customerName: e.target.value })} placeholder="Nome" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
                <input value={checkout.email} onChange={e => setCheckout({ ...checkout, email: e.target.value })} placeholder="Email" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
                <input value={checkout.phone} onChange={e => setCheckout({ ...checkout, phone: e.target.value })} placeholder="Telefone" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
                <textarea value={checkout.shippingAddress} onChange={e => setCheckout({ ...checkout, shippingAddress: e.target.value })} placeholder="Endereco/observacoes" className="min-h-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
                <button disabled={!cartRows.length} className="rounded-lg bg-amber-300 px-3 py-2.5 text-sm font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">Finalizar compra</button>
              </div>
            </aside>
          </form>
        )}

        {tab === 'products' && (
          <form onSubmit={saveProduct} className="rounded-lg border border-stone-800 bg-stone-900 p-3 sm:p-4">
            <h2 className="font-serif text-xl text-stone-50">{editingProductId ? 'Editar produto' : 'Cadastrar produto'}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input value={productDraft.name} onChange={e => setProductDraft({ ...productDraft, name: e.target.value })} placeholder="Nome" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
              <input value={productDraft.category} onChange={e => setProductDraft({ ...productDraft, category: e.target.value })} placeholder="Categoria" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
              <input value={productDraft.imageUrl} onChange={e => setProductDraft({ ...productDraft, imageUrl: e.target.value })} placeholder="URL da imagem" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 sm:col-span-2" />
              <input type="number" min="0" step="0.01" value={productDraft.price} onChange={e => setProductDraft({ ...productDraft, price: Number(e.target.value) })} placeholder="Preco" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
              <input type="number" min="0" value={productDraft.stock} onChange={e => setProductDraft({ ...productDraft, stock: Number(e.target.value) })} placeholder="Estoque" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
              <textarea value={productDraft.description} onChange={e => setProductDraft({ ...productDraft, description: e.target.value })} placeholder="Descricao" className="min-h-24 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 sm:col-span-2" />
              <label className="flex items-center gap-2 text-sm font-bold text-stone-300">
                <input type="checkbox" checked={productDraft.isActive} onChange={e => setProductDraft({ ...productDraft, isActive: e.target.checked })} />
                Produto ativo
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-stone-950">Salvar produto</button>
              {editingProductId && <button type="button" onClick={() => { setEditingProductId(null); setProductDraft(emptyProduct) }} className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold text-stone-300">Cancelar edicao</button>}
            </div>
          </form>
        )}

        {tab === 'requests' && (
          <div className="grid gap-3">
            <form onSubmit={submitSuggestion} className="rounded-lg border border-stone-800 bg-stone-900 p-3">
              <h2 className="font-serif text-lg text-stone-50">Solicitar produto</h2>
              <div className="mt-3 grid gap-2">
                <input value={suggestion.name} onChange={e => setSuggestion({ ...suggestion, name: e.target.value })} placeholder="O que voce quer encontrar?" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
                <textarea value={suggestion.description} onChange={e => setSuggestion({ ...suggestion, description: e.target.value })} placeholder="Detalhes, edicao, tamanho..." className="min-h-20 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
                <input value={suggestion.referenceUrl} onChange={e => setSuggestion({ ...suggestion, referenceUrl: e.target.value })} placeholder="Link de referencia" className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100" />
                <button className="rounded-lg border border-amber-300/40 px-3 py-2 text-sm font-bold text-amber-300">Enviar solicitacao</button>
              </div>
            </form>
            {store.requests.map(request => (
              <article key={request.id} className="rounded-lg border border-stone-800 bg-stone-900 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg text-stone-50">{request.name}</h2>
                    <p className="text-xs text-stone-500">por @{request.user.handle || request.user.name} · {formatDateTime(request.createdAt)}</p>
                  </div>
                  <select value={request.status} onChange={e => updateRequestStatus(request.id, e.target.value)} className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100">
                    {['open', 'reviewing', 'approved', 'declined', 'fulfilled'].map(status => <option key={status} value={status}>{STORE_REQUEST_STATUS_LABELS[status]}</option>)}
                  </select>
                </div>
                {request.description && <p className="mt-2 text-sm text-stone-400">{request.description}</p>}
                {request.referenceUrl && <p className="mt-2 truncate text-xs text-amber-300">{request.referenceUrl}</p>}
              </article>
            ))}
            {!store.requests.length && <EmptyState text="Nenhuma solicitacao de produto ainda." />}
          </div>
        )}

        {tab === 'orders' && storeViewMode === 'admin' && (
          <div className="grid gap-2">
            {store.orders.map(order => (
              <article key={order.id} className="rounded-lg border border-stone-800 bg-stone-900 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg text-stone-50">{order.customerName}</h2>
                    <p className="text-xs text-stone-500">{formatDateTime(order.createdAt)} · {money(order.total)}</p>
                  </div>
                  <select value={order.status} onChange={e => updateOrderStatus(order.id, e.target.value)} className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100">
                    {['pending', 'paid', 'preparing', 'sent', 'completed', 'cancelled'].map(status => <option key={status} value={status}>{STORE_ORDER_STATUS_LABELS[status]}</option>)}
                  </select>
                </div>
                <div className="mt-3 space-y-2">
                  {order.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-stone-950 p-2 text-sm">
                      <span className="min-w-0 truncate text-stone-100">{item.quantity}x {item.productName}</span>
                      <span className="shrink-0 font-bold text-amber-300">{money(item.total)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
            {!store.orders.length && <EmptyState text="Nenhum pedido finalizado ainda." />}
          </div>
        )}
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-md sm:items-center" onClick={e => e.currentTarget === e.target && setSelectedProduct(null)}>
          <article className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-stone-800 bg-stone-900 shadow-2xl shadow-black/40">
            {selectedProduct.imageUrl ? (
              <img src={resolveMediaUrl(selectedProduct.imageUrl)} alt={selectedProduct.name} className="h-72 w-full object-cover" />
            ) : (
              <div className="flex h-60 items-center justify-center bg-stone-800 text-sm text-stone-500">Sem imagem</div>
            )}
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-2xl text-stone-50">{selectedProduct.name}</h2>
                  <p className="mt-2 text-lg font-black text-amber-300">{money(selectedProduct.price)}</p>
                </div>
                <button onClick={() => setSelectedProduct(null)} className="rounded-lg px-2 py-1 text-xl leading-none text-stone-500 hover:bg-stone-800 hover:text-stone-100">×</button>
              </div>
              {selectedProduct.category && <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-stone-500">{selectedProduct.category}</p>}
              {selectedProduct.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-stone-300">{selectedProduct.description}</p>}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-800 pt-4">
                <span className="text-sm font-semibold text-stone-500">{selectedProduct.stock ? `${selectedProduct.stock} em estoque` : 'Sob consulta'}</span>
                <div className="flex gap-2">
                  {storeViewMode === 'admin' && <button onClick={() => editProduct(selectedProduct)} className="rounded-lg border border-stone-700 px-4 py-2 text-sm font-bold text-stone-300">Editar</button>}
                  <button onClick={() => { addToCart(selectedProduct.id); setSelectedProduct(null); setTab('cart') }} className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-stone-950">Adicionar ao carrinho</button>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}

function RightPanel({ currentUser, users, shelf, books, posts, readingGoal, onBookClick, onUserClick, onCreatePost, onToggleReadingCheckIn, onToggleFollow }: {
  currentUser: User
  users: User[]
  shelf: ShelfEntry[]
  books: Book[]
  posts: Post[]
  readingGoal: ReadingGoal
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
  onCreatePost: (bookId?: string) => void
  onToggleReadingCheckIn: () => Promise<boolean | void> | boolean | void
  onToggleFollow: (userId: string) => Promise<boolean | void> | boolean | void
}) {
  const [readerQuery, setReaderQuery] = useState('')
  const nudges = buildSmartNudges(currentUser, books, shelf, posts, readingGoal)
  const spotlights = buildWeeklySpotlights(users, books, posts, shelf).slice(0, 3)
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
      {nudges.length > 0 && (
        <div className="rounded-lg border border-amber-300/25 bg-stone-900 p-3">
          <h2 className="mb-2 font-serif text-base text-stone-100">Voltar hoje</h2>
          <div className="space-y-2">
            {nudges.map(nudge => (
              <button
                key={nudge.key}
                type="button"
                onClick={() => {
                  if (nudge.action === 'checkin') void onToggleReadingCheckIn()
                  else if (nudge.action === 'post') onCreatePost(nudge.bookId)
                  else if (nudge.bookId) onBookClick(nudge.bookId)
                }}
                className="w-full rounded-lg border border-stone-800 bg-stone-950 p-2.5 text-left transition hover:border-amber-300/50"
              >
                <span className="block text-sm font-bold text-stone-100">{nudge.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-stone-500">{nudge.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}
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
      {spotlights.length > 0 && (
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
          <h2 className="mb-2 font-serif text-base text-stone-100">Em alta</h2>
          <div className="space-y-2">
            {spotlights.map(row => (
              <button
                key={row.key}
                type="button"
                onClick={() => row.bookId ? onBookClick(row.bookId) : row.userId ? onUserClick(row.userId) : undefined}
                className="w-full rounded-lg bg-stone-950 p-2.5 text-left transition hover:bg-stone-800"
              >
                <span className="block text-xs font-bold uppercase tracking-[0.14em] text-amber-300">{row.label}</span>
                <span className="mt-1 block truncate text-sm font-bold text-stone-100">{row.title}</span>
                <span className="mt-1 block text-xs text-stone-500">{row.detail}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {currentlyReading.length > 0 && (
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-3">
          <h2 className="mb-2 font-serif text-base text-stone-100">Lendo agora</h2>
          <div className="space-y-3">
            {currentlyReading.map(({ entry, book }) => (
              <button key={book.id} onClick={() => onBookClick(book.id)} className="flex w-full gap-3 text-left">
                <FolioImage src={book.cover} alt={book.title} className="h-14 w-10 rounded object-cover" />
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

function NotificationPreferencesPanel({ preferences, onUpdate }: {
  preferences: NotificationPreferences
  onUpdate: (changes: Partial<NotificationPreferences>) => Promise<boolean | void> | boolean | void
}) {
  return (
    <section className="rounded-lg border border-stone-800 bg-stone-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-stone-50">Lembretes inteligentes</h2>
          <p className="mt-1 text-sm text-stone-500">No máximo 1 lembrete por dia, enviados só em horário seguro.</p>
        </div>
        <select
          value={preferences.reminderFrequency}
          onChange={e => onUpdate({ reminderFrequency: e.target.value as ReminderFrequency })}
          className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-stone-100 outline-none focus:border-amber-300"
        >
          <option value="off">Desligados</option>
          <option value="low">Baixa</option>
          <option value="normal">Normal</option>
          <option value="intense">Intensa</option>
        </select>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {([
          ['checkInReminders', 'Check-in diário', 'Lembrar de marcar leitura do dia.'],
          ['readingGoalReminders', 'Metas de leitura', 'Motivar semana e mês sem cobrança.'],
          ['reactionReminders', 'Postar reação', 'Sugerir reação ao avançar no livro.'],
          ['clubReminders', 'Clube da leitura', 'Avisar quando houver gente no mesmo trecho.'],
          ['returnReminders', 'Voltar hoje', 'Convite suave para continuar lendo.'],
        ] as const).map(([key, title, detail]) => (
          <label key={key} className="flex items-start gap-3 rounded-lg border border-stone-800 bg-stone-950 p-3">
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={e => onUpdate({ [key]: e.target.checked } as Partial<NotificationPreferences>)}
              className="mt-1 h-4 w-4 accent-amber-300"
            />
            <span>
              <span className="block text-sm font-bold text-stone-100">{title}</span>
              <span className="mt-1 block text-xs text-stone-500">{detail}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-[calc(max(env(safe-area-inset-bottom),0px)+5.75rem)] left-3 right-3 z-[70] grid gap-2 md:bottom-5 md:left-auto md:right-5 md:w-96">
      {toasts.map(toast => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-2xl shadow-black/40 ${toast.type === 'success'
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
  const enabledPages = ['timeline', 'shelf', 'library', 'book', 'profile', 'profile-list', 'goals', 'notifications', 'superadmin', 'store']
  if (AI_LAB_FRONTEND_ENABLED) enabledPages.push('ai-lab')
  return enabledPages.includes(value || '') ? value as Page : 'timeline'
}

function storedBookId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('bookId') || localStorage.getItem('folio_selected_book_id')
}

function storedPostId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('postId')
}

function storedColorTheme(): ColorTheme {
  const theme = localStorage.getItem('folio_theme') === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme
  return theme
}

function normalizeMaintenanceMode(value?: Partial<MaintenanceMode> | null): MaintenanceMode {
  return {
    enabled: Boolean(value?.enabled),
    message: (value?.message || DEFAULT_MAINTENANCE_MESSAGE).trim() || DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: value?.updatedAt || null,
  }
}

function storedMaintenanceMode() {
  try {
    const value = localStorage.getItem(MAINTENANCE_STORAGE_KEY)
    return value ? normalizeMaintenanceMode(JSON.parse(value) as Partial<MaintenanceMode>) : normalizeMaintenanceMode()
  } catch {
    return normalizeMaintenanceMode()
  }
}

function maintenanceNotice(mode: MaintenanceMode): ServiceNotice {
  return {
    eyebrow: 'Comunicado Oficial - Grupo Entrelinhas',
    title: 'Plataforma em manutenção',
    paragraphs: [
      mode.message,
      'Nossa equipe está aplicando melhorias neste momento. Assim que a manutenção terminar, o acesso será liberado normalmente.',
      mode.updatedAt ? `Última atualização: ${formatDateTime(mode.updatedAt)}.` : 'Agradecemos a compreensão e a paciência.',
    ],
    deadlineLabel: '',
    deadlineIso: '',
    deadlineDisplay: '',
    retryLabel: 'Tentar novamente',
    logoutLabel: 'Sair',
  }
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('folio_token') || '')
  const [users, setUsers] = useState<User[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [theme, setTheme] = useState<ColorTheme>(() => storedColorTheme())
  const [page, setPage] = useState<Page>(() => storedPage())
  const [selectedBookId, setSelectedBookId] = useState<string | null>(() => storedBookId())
  const [selectedPostId, setSelectedPostId] = useState<string | null>(() => storedPostId())
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(() => localStorage.getItem('folio_selected_profile_user_id'))
  const [profileListKind, setProfileListKind] = useState<ProfileListKind>('following')
  const [showPostModal, setShowPostModal] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [postModalBookId, setPostModalBookId] = useState<string | null>(null)
  const [shelf, setShelf] = useState<ShelfEntry[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [replies, setReplies] = useState<Reply[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [notifications, setNotifications] = useState<FolioNotification[]>([])
  const [readingGoal, setReadingGoal] = useState<ReadingGoal>({ targetBooks: 40, targetBooksMonth: 4, targetBooksWeek: 1, targetDays: 120, checkIns: [], currentStreak: 0, bestStreak: 0, checkedInToday: false })
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES)
  const [loadingApp, setLoadingApp] = useState(true)
  const [resumeError, setResumeError] = useState('')
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceMode>(() => storedMaintenanceMode())
  const [communityFeature, setCommunityFeature] = useState<CommunityFeature>({ enabled: false })
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [actionLoadingCount, setActionLoadingCount] = useState(0)
  const [deviceNotifications, setDeviceNotifications] = useState<DeviceNotificationStatus>(() => deviceNotificationStatus())
  const [remotePushRegistered, setRemotePushRegistered] = useState(false)
  const navigationHistoryRef = useRef<ViewState[]>([])
  const notifiedDeviceNotificationIds = useRef<Set<string>>(new Set())
  const notifiedDeviceNotificationUserId = useRef<string | null>(null)
  const viewedPostIdsRef = useRef<Set<string>>(new Set())
  const postViewsEndpointUnavailableRef = useRef(false)
  const pendingDeletedPostIdsRef = useRef<Set<string>>(new Set())
  const pendingDeletedReplyIdsRef = useRef<Set<string>>(new Set())
  const { askDate, datePromptDialog } = useDatePrompt()
  const { askConfirm, confirmPromptDialog } = useConfirmPrompt()
  const canUseDeviceNotifications = Boolean(currentUser)
  const visibleNotifications = useMemo(() => {
    if (!currentUser) return notifications
    return notifications.filter(notification => canDisplayNotification(notification, currentUser, shelf, books))
  }, [books, currentUser, notifications, shelf])

  function handleMaintenanceModeChange(nextMode: MaintenanceMode) {
    const normalizedMode = normalizeMaintenanceMode(nextMode)
    beginActionLoading()
    void apiRequest<MaintenanceMode>('/folio/superadmin/maintenance', {
      method: 'PATCH',
      body: JSON.stringify({
        enabled: normalizedMode.enabled,
        message: normalizedMode.message,
      }),
    }, token)
      .then(savedMode => {
        const saved = normalizeMaintenanceMode(savedMode)
        localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(saved))
        setMaintenanceMode(saved)
        showToast('success', saved.enabled ? 'Modo manutenção ativado.' : 'Modo manutenção desativado.')
      })
      .catch(error => {
        showToast('error', errorMessage(error, 'Nao foi possivel atualizar o modo manutenção.'))
      })
      .finally(endActionLoading)
  }

  function handleCommunityFeatureChange(changes: Partial<CommunityFeature>) {
    beginActionLoading()
    void apiRequest<CommunityFeature>('/folio/superadmin/community', {
      method: 'PATCH',
      body: JSON.stringify(changes),
    }, token)
      .then(saved => {
        setCommunityFeature({ enabled: Boolean(saved.enabled), previewEnabled: Boolean(saved.previewEnabled) })
        showToast('success', saved.enabled ? 'Comunidade do Chá habilitada para todos.' : saved.previewEnabled ? 'Prévia privada da Comunidade do Chá ativada.' : 'Comunidade do Chá desativada.')
      })
      .catch(error => showToast('error', errorMessage(error, 'Nao foi possivel atualizar a Comunidade do Chá.')))
      .finally(endActionLoading)
  }

  function currentViewState(): ViewState {
    return {
      page,
      selectedBookId,
      selectedPostId,
      selectedProfileUserId,
      profileListKind,
    }
  }

  function sameViewState(a: ViewState, b: ViewState) {
    return a.page === b.page
      && a.selectedBookId === b.selectedBookId
      && a.selectedPostId === b.selectedPostId
      && a.selectedProfileUserId === b.selectedProfileUserId
      && a.profileListKind === b.profileListKind
  }

  function applyViewState(view: ViewState) {
    setPage(view.page)
    setSelectedBookId(view.selectedBookId)
    setSelectedPostId(view.selectedPostId)
    setSelectedProfileUserId(view.selectedProfileUserId)
    setProfileListKind(view.profileListKind)
  }

  function pushCurrentViewState() {
    const current = currentViewState()
    const last = navigationHistoryRef.current[navigationHistoryRef.current.length - 1]
    if (last && sameViewState(last, current)) return
    navigationHistoryRef.current = [...navigationHistoryRef.current, current].slice(-25)
  }

  function navigateToView(view: ViewState) {
    const current = currentViewState()
    if (!sameViewState(current, view)) pushCurrentViewState()
    applyViewState(view)
  }

  function handleBack() {
    const previous = navigationHistoryRef.current.pop()
    applyViewState(previous || {
      ...currentViewState(),
      page: 'timeline',
      selectedBookId: null,
      selectedPostId: null,
    })
  }

  function scrollPageToTop() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })
  }

  function activeAuthToken() {
    return localStorage.getItem('folio_token') || token
  }

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

  function handleOpenCreatePost(bookId?: string | null) {
    setPostModalBookId(bookId || null)
    setShowPostModal(true)
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

  async function runAction(action: () => Promise<void>, feedback: ActionFeedback) {
    try {
      await action()
      if (!feedback.silentSuccess && feedback.success) showToast('success', feedback.success)
      return true
    } catch (error) {
      showToast('error', errorMessage(error, feedback.error))
      return false
    }
  }

  async function loadBootstrap(activeToken = activeAuthToken()) {
    const data = await apiRequest<{
      currentUserId: string
      token?: string | null
      users: User[]
      books: Book[]
      shelf: ShelfEntry[]
      posts: Post[]
      replies: Reply[]
      timeline: TimelineEvent[]
      maintenanceMode?: MaintenanceMode
      communityFeature?: CommunityFeature
      notifications?: FolioNotification[]
      notificationPreferences?: NotificationPreferences
      readingGoal?: ReadingGoal
    }>('/folio/bootstrap', {}, activeToken || undefined)

    if (data.token && data.token !== activeToken) {
      localStorage.setItem('folio_token', data.token)
      setToken(data.token)
    }
    warmBootstrapImages(data)
    setUsers(data.users)
    setBooks(data.books)
    setShelf(data.shelf)
    setPosts(data.posts.filter(post => !pendingDeletedPostIdsRef.current.has(post.id)))
    setReplies(data.replies.filter(reply =>
      !pendingDeletedPostIdsRef.current.has(reply.postId)
      && !pendingDeletedReplyIdsRef.current.has(reply.id)
      && (!reply.parentReplyId || !pendingDeletedReplyIdsRef.current.has(reply.parentReplyId))
    ))
    setTimeline(data.timeline || [])
    const remoteMaintenanceMode = normalizeMaintenanceMode(data.maintenanceMode)
    localStorage.setItem(MAINTENANCE_STORAGE_KEY, JSON.stringify(remoteMaintenanceMode))
    setMaintenanceMode(remoteMaintenanceMode)
    setCommunityFeature({ enabled: Boolean(data.communityFeature?.enabled), previewEnabled: Boolean(data.communityFeature?.previewEnabled) })
    setNotifications(data.notifications || [])
    setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...(data.notificationPreferences || {}) })
    setReadingGoal(data.readingGoal || { targetBooks: 40, targetBooksMonth: 4, targetBooksWeek: 1, targetDays: 120, checkIns: [], currentStreak: 0, bestStreak: 0, checkedInToday: false })
    setCurrentUser(data.users.find(user => user.id === data.currentUserId) || data.users[0] || null)
    setResumeError('')
    setLoadingApp(false)
  }

  function clearStoredLogin() {
    localStorage.removeItem('folio_token')
    setToken('')
    setCurrentUser(null)
    setResumeError('')
  }

  function handleStoredLoginFailure(error: unknown) {
    if (isAuthExpiredError(error)) {
      clearStoredLogin()
      setLoadingApp(false)
      return
    }

    setResumeError('Nao foi possivel carregar sua sessao agora. Confira a conexao e tente novamente.')
    setLoadingApp(false)
  }

  async function retryStoredLogin() {
    setLoadingApp(true)
    setResumeError('')
    try {
      await loadBootstrap()
    } catch (error) {
      handleStoredLoginFailure(error)
    }
  }

  useEffect(() => {
    loadBootstrap().catch(handleStoredLoginFailure)
  }, [])

  useEffect(() => {
    function syncMaintenanceMode(event: StorageEvent) {
      if (event.key === MAINTENANCE_STORAGE_KEY) {
        setMaintenanceMode(storedMaintenanceMode())
      }
    }

    window.addEventListener('storage', syncMaintenanceMode)
    return () => window.removeEventListener('storage', syncMaintenanceMode)
  }, [])

  useEffect(() => {
    const retryFailedImages = () => {
      if (document.hidden) return
      document
        .querySelectorAll<HTMLImageElement>('img[data-folio-image-failed="true"]')
        .forEach(image => retryImageElement(image))
    }

    const handleImageError = (event: Event) => {
      if (!(event.target instanceof HTMLImageElement)) return
      if (event.target.dataset.folioImageManaged === 'true') return
      event.target.dataset.folioImageFailed = 'true'
      retryImageElement(event.target, 1500)
    }

    const handleImageLoad = (event: Event) => {
      if (!(event.target instanceof HTMLImageElement)) return
      delete event.target.dataset.folioImageFailed
      delete event.target.dataset.folioImageRetryAttempts
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) retryFailedImages()
    }

    document.addEventListener('error', handleImageError, true)
    document.addEventListener('load', handleImageLoad, true)
    window.addEventListener('online', retryFailedImages)
    window.addEventListener('focus', retryFailedImages)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('error', handleImageError, true)
      document.removeEventListener('load', handleImageLoad, true)
      window.removeEventListener('online', retryFailedImages)
      window.removeEventListener('focus', retryFailedImages)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
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
    saveDevicePushSubscription(token)
      .then(result => {
        return result === 'saved'
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

    const freshUnreadNotifications = visibleNotifications
      .filter(notification => !notification.read && !notifiedDeviceNotificationIds.current.has(notification.id))
      .sort(newestFirst)

    if (!freshUnreadNotifications.length) return

    freshUnreadNotifications.forEach(notification => notifiedDeviceNotificationIds.current.add(notification.id))
    saveDeviceNotificationIds(currentUser.id, notifiedDeviceNotificationIds.current)
    freshUnreadNotifications.slice(0, 3).forEach(notification => {
      showDeviceNotification(notification, users, books, currentUser, shelf).catch(() => {
        // Device notifications are best-effort; the in-app notification list remains authoritative.
      })
    })
  }, [currentUser, notifications, visibleNotifications, users, books, shelf, deviceNotifications, remotePushRegistered])

  useEffect(() => {
    if (!token || !currentUser) return

    let active = true
    let refreshing = false

    // A tela se reconcilia quando o usuário volta ao app. Atualizações em tempo real
    // devem chegar por eventos do servidor; evitar recarregar todo o bootstrap em intervalo.
    const refreshAfterResume = async () => {
      if (!active || refreshing || document.hidden) return
      refreshing = true
      try {
        await loadBootstrap(token)
      } catch {
        // A sincronização ao retomar é best-effort; ações explícitas continuam mostrando erro.
      } finally {
        refreshing = false
      }
    }

    const handleFocus = () => void refreshAfterResume()
    const handleVisibilityChange = () => {
      if (!document.hidden) void refreshAfterResume()
    }
    const handleOnline = () => void refreshAfterResume()

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      active = false
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [token, currentUser?.id])

  useEffect(() => {
    if (!token || !currentUser) return

    let active = true
    let refreshTimer: number | undefined
    const connection = new HubConnectionBuilder()
      .withUrl(FOLIO_HUB_URL, { accessTokenFactory: () => activeAuthToken() })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build()

    // Uma sequência de ações pode gerar vários eventos. Recarregamos uma única vez,
    // depois que a sequência termina, em vez de repetir o bootstrap para cada evento.
    const scheduleRefresh = () => {
      if (!active) return
      if (refreshTimer) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        refreshTimer = undefined
        if (!document.hidden) void loadBootstrap(token).catch(() => {
          // A conexão tenta se recuperar sozinha; a tela permanece com o último estado válido.
        })
      }, 500)
    }

    connection.on('dataChanged', scheduleRefresh)
    void connection.start().catch(() => {
      // Atualização em tempo real é progressiva; a reconciliação ao retomar a aba continua ativa.
    })

    return () => {
      active = false
      if (refreshTimer) window.clearTimeout(refreshTimer)
      connection.off('dataChanged', scheduleRefresh)
      if (connection.state !== HubConnectionState.Disconnected) void connection.stop()
    }
  }, [token, currentUser?.id])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('folio_theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('folio_page', page)
  }, [page])

  useEffect(() => {
    if (page === 'ai-lab' && !AI_LAB_FRONTEND_ENABLED) {
      setPage('timeline')
      return
    }

    if (currentUser && (page === 'superadmin' || page === 'store' || page === 'ai-lab') && !isSuperAdminUser(currentUser)) {
      setPage('timeline')
    }
  }, [currentUser, page])

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
      setSelectedPostId(null)
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
    setResumeError('')
    setLoadingApp(true)
    await loadBootstrap(auth.token)
  }

  function handleBookClick(bookId: string) {
    navigateToView({
      ...currentViewState(),
      page: 'book',
      selectedBookId: bookId,
      selectedPostId: null,
    })
  }

  function handleNotificationClick(notification: FolioNotification) {
    if (notification.bookId) {
      navigateToView({
        ...currentViewState(),
        page: 'book',
        selectedBookId: notification.bookId,
        selectedPostId: notification.postId || null,
      })
      return
    }

    handleUserClick(notification.userId)
  }

  function handleUserClick(userId: string) {
    navigateToView({
      ...currentViewState(),
      page: 'profile',
      selectedBookId: null,
      selectedPostId: null,
      selectedProfileUserId: userId,
    })
  }

  function handleOpenProfileList(kind: ProfileListKind) {
    navigateToView({
      ...currentViewState(),
      page: 'profile-list',
      selectedBookId: null,
      selectedPostId: null,
      profileListKind: kind,
    })
  }

  async function handleNavigate(nextPage: Page) {
    navigateToView({
      ...currentViewState(),
      page: nextPage,
      selectedBookId: nextPage === 'book' ? selectedBookId : null,
      selectedPostId: nextPage === 'book' ? selectedPostId : null,
      selectedProfileUserId: nextPage === 'profile' ? currentUser?.id || null : selectedProfileUserId,
    })
    scrollPageToTop()
    if (nextPage === 'notifications') {
      await apiRequest('/folio/notifications/mark-all-read', { method: 'POST' }, token)
      await loadBootstrap()
    }
  }

  async function handleUpdateShelfEntry(bookId: string, changes: Partial<ShelfEntry>, feedback?: ActionFeedback, options?: UpdateShelfOptions) {
    if (!currentUser) return false
    const entry = shelf.find(item => item.userId === currentUser.id && item.bookId === bookId)
    const book = books.find(item => item.id === bookId)
    const previousChapter = entry && book ? chapterFromPercent(book, entry.progress) : null
    const nextChapter = typeof changes.progress === 'number' && book ? chapterFromPercent(book, changes.progress) : null
    const activeToken = activeAuthToken()
    const saved = await runAction(async () => {
      await apiRequest(`/folio/shelf/${encodeURIComponent(bookId)}`, { method: 'PATCH', body: JSON.stringify(changes) }, activeToken)
      await loadBootstrap(activeToken)
    }, feedback || {
      error: 'Nao foi possivel atualizar a estante.',
      silentSuccess: true,
    })
    if (saved && options?.offerReadingCheckIn && !readingGoal.checkedInToday && previousChapter !== null && nextChapter !== null && nextChapter > previousChapter) {
      const confirmed = await askConfirm({
        title: 'Fazer check-in de hoje?',
        description: `Você avançou de capítulo em ${book?.title || 'um livro'}. Quer marcar hoje na sua meta de dias de leitura?`,
        confirmLabel: 'Fazer check-in',
        cancelLabel: 'Agora não',
      })
      if (confirmed) await handleAddReadingCheckIn()
    }
    return saved
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
      await apiRequest('/folio/shelf', { method: 'POST', body: JSON.stringify({ bookId, status, progress: isCompletedStatus(status) ? 100 : 0, ...dateChanges }) }, token)
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
      const activeToken = activeAuthToken()
      if (!isImageUpload(file)) throw new Error('Envie uma imagem em JPG, PNG, WEBP ou GIF.')
      const uploadFile = await prepareBookCoverImageFile(file)
      const formData = new FormData()
      formData.append('file', uploadFile, uploadFile.name)
      const response = await fetch(`${API_BASE_URL}/folio/books/cover`, {
        method: 'POST',
        credentials: 'include',
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : undefined,
        body: formData,
      })
      if (!response.ok) throw new ApiRequestError(response.status, await response.text())
      const data = await response.json() as {
        url?: string
        cover?: string
        coverUrl?: string
        imageUrl?: string
        path?: string
        fileName?: string
        filename?: string
      }
      const uploadedUrl = data.url || data.coverUrl || data.cover || data.imageUrl || data.path || data.fileName || data.filename
      const normalizedUrl = normalizeUploadedBookCoverUrl(uploadedUrl)
      if (!normalizedUrl) throw new Error('O servidor nao retornou a URL da capa.')
      showToast('success', 'Capa enviada com sucesso.')
      return normalizedUrl
    } catch (error) {
      if (isAuthExpiredError(error)) clearStoredLogin()
      showToast('error', errorMessage(error, 'Nao foi possivel enviar a capa.'))
      throw error
    } finally {
      endActionLoading()
    }
  }

  async function handleUploadPostImage(file: File) {
    beginActionLoading()
    try {
      const activeToken = activeAuthToken()
      const uploadFile = await preparePostImageFile(file)
      const formData = new FormData()
      formData.append('file', uploadFile, uploadFile.name)
      const response = await fetch(`${API_BASE_URL}/folio/media`, {
        method: 'POST',
        credentials: 'include',
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : undefined,
        body: formData,
      })
      if (!response.ok) throw new ApiRequestError(response.status, await response.text())
      const data = await response.json() as { url: string }
      showToast('success', 'Imagem anexada com sucesso.')
      return data.url
    } catch (error) {
      if (isAuthExpiredError(error)) clearStoredLogin()
      showToast('error', errorMessage(error, 'Nao foi possivel anexar a imagem.'))
      throw error
    } finally {
      endActionLoading()
    }
  }

  async function handleAddReply(postId: string, text: string, parentReplyId?: string, mentionedUserIds: string[] = []) {
    if (!currentUser) return false
    const activeToken = activeAuthToken()
    const temporaryId = `optimistic-reply-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimisticReply: Reply = { id: temporaryId, postId, parentReplyId, userId: currentUser.id, text, timestamp: new Date().toISOString(), likes: [], reactions: [], comments: 0, mentionedUserIds }
    setReplies(current => [...current, optimisticReply])
    syncInBackground(async () => {
      const path = parentReplyId ? '/folio/replies/replies' : `/folio/posts/${encodeURIComponent(postId)}/replies`
      const payload = { text, ...(parentReplyId ? { parentReplyId } : {}), ...(mentionedUserIds.length ? { mentionedUserIds } : {}) }
      const saved = await apiRequest<Reply>(path, { method: 'POST', body: JSON.stringify(payload) }, activeToken)
      setReplies(current => current.map(reply => reply.id === temporaryId ? saved : reply))
    }, 'Não foi possível publicar o comentário.', () => setReplies(current => current.filter(reply => reply.id !== temporaryId)))
    return true
  }

  async function handleDeletePost(postId: string) {
    if (!currentUser) return false
    const post = posts.find(item => item.id === postId)
    if (!post) return false
    const isTheory = post?.type === 'theory'
    const confirmed = await askConfirm({
      title: isTheory ? 'Excluir teoria?' : 'Excluir publicação?',
      description: `Essa ação remove ${isTheory ? 'esta teoria' : 'esta publicação'} e as respostas vinculadas a ela. Não será possível desfazer.`,
      confirmLabel: 'Excluir',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    })
    if (!confirmed) return false

    const removedReplies = replies.filter(reply => reply.postId === postId)
    pendingDeletedPostIdsRef.current.add(postId)
    setPosts(current => current.filter(item => item.id !== postId))
    setReplies(current => current.filter(reply => reply.postId !== postId))
    syncInBackground(async () => {
      await apiRequest(`/folio/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }, activeAuthToken())
      await loadBootstrap()
      pendingDeletedPostIdsRef.current.delete(postId)
    }, 'Não foi possível apagar a publicação.', () => {
      pendingDeletedPostIdsRef.current.delete(postId)
      setPosts(current => [...current, post].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))
      setReplies(current => [...current, ...removedReplies])
    })
    return true
  }

  async function handleDeleteReply(replyId: string) {
    if (!currentUser) return false
    const removedReplies = replies.filter(reply => reply.id === replyId || reply.parentReplyId === replyId)
    removedReplies.forEach(reply => pendingDeletedReplyIdsRef.current.add(reply.id))
    setReplies(current => current.filter(reply => reply.id !== replyId && reply.parentReplyId !== replyId))
    syncInBackground(async () => {
      await apiRequest(`/folio/replies/${encodeURIComponent(replyId)}`, { method: 'DELETE' }, activeAuthToken())
      await loadBootstrap()
      removedReplies.forEach(reply => pendingDeletedReplyIdsRef.current.delete(reply.id))
    }, 'Não foi possível apagar o comentário.', () => {
      removedReplies.forEach(reply => pendingDeletedReplyIdsRef.current.delete(reply.id))
      setReplies(current => [...current, ...removedReplies])
    })
    return true
  }

  function handleEditPost(post: Post) {
    setEditingPost(post)
    setShowPostModal(true)
  }

  async function handleUpdatePost(post: Post) {
    if (!currentUser) return false
    const previous = posts.find(item => item.id === post.id)
    setPosts(current => current.map(item => item.id === post.id ? { ...item, ...post, editedAt: new Date().toISOString() } : item))
    syncInBackground(async () => {
      await apiRequest(`/folio/posts/${encodeURIComponent(post.id)}`, { method: 'PATCH', body: JSON.stringify(post) }, activeAuthToken())
      await loadBootstrap(activeAuthToken())
    }, 'Não foi possível editar a publicação.', () => previous && setPosts(current => current.map(item => item.id === post.id ? previous : item)))
    return true
  }

  async function handleEditReply(reply: Reply, text: string) {
    if (!currentUser) return false
    const previous = replies.find(item => item.id === reply.id)
    setReplies(current => current.map(item => item.id === reply.id ? { ...item, text: text.trim(), editedAt: new Date().toISOString() } : item))
    syncInBackground(async () => {
      await apiRequest(`/folio/replies/${encodeURIComponent(reply.id)}`, { method: 'PATCH', body: JSON.stringify({ text: text.trim(), mentionedUserIds: mentionedUsersFromText(text, currentUser, users).map(user => user.id) }) }, activeAuthToken())
      await loadBootstrap(activeAuthToken())
    }, 'Não foi possível editar o comentário.', () => previous && setReplies(current => current.map(item => item.id === reply.id ? previous : item)))
    return true
  }

  async function handleToggleLike(postId: string) {
    if (!currentUser) return false
    const post = posts.find(item => item.id === postId)
    const liked = Boolean(post?.likes.includes(currentUser.id))
    const nextLikes = liked ? (post?.likes || []).filter(id => id !== currentUser.id) : [...(post?.likes || []), currentUser.id]
    setPosts(current => current.map(item => item.id === postId ? { ...item, likes: nextLikes } : item))
    syncInBackground(async () => {
      const activeToken = activeAuthToken()
      await apiRequest(`/folio/posts/${encodeURIComponent(postId)}/likes/toggle`, { method: 'POST' }, activeToken)
    }, 'Não foi possível atualizar a curtida.')
    return true
  }

  function handleViewPost(postId: string) {
    if (!currentUser || viewedPostIdsRef.current.has(postId)) return
    if (isSuperAdminUser(currentUser)) return
    const post = posts.find(item => item.id === postId)
    if (!post || post.userId === currentUser.id) return

    viewedPostIdsRef.current.add(postId)
    setPosts(currentPosts => currentPosts.map(item => {
      if (item.id !== postId) return item
      const views = item.views?.includes(currentUser.id) ? item.views : [...(item.views || []), currentUser.id]
      return {
        ...item,
        views,
        viewCount: Math.max(item.viewCount || 0, views.length),
      }
    }))

    if (postViewsEndpointUnavailableRef.current) return

    void (async () => {
      try {
        const activeToken = activeAuthToken()
        const response = await fetch(`${API_BASE_URL}/folio/posts/${encodeURIComponent(postId)}/views`, {
          method: 'POST',
          credentials: 'include',
          headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : undefined,
        })
        if (response.status === 404 || response.status === 405) {
          postViewsEndpointUnavailableRef.current = true
        }
      } catch {
        // Visualização é métrica passiva; falhas não devem interromper a leitura do feed.
      }
    })()
  }

  async function handleToggleReplyLike(replyId: string) {
    if (!currentUser) return false
    const reply = replies.find(item => item.id === replyId)
    const liked = Boolean(reply?.likes?.includes(currentUser.id))
    const nextLikes = liked ? (reply?.likes || []).filter(id => id !== currentUser.id) : [...(reply?.likes || []), currentUser.id]
    setReplies(current => current.map(item => item.id === replyId ? { ...item, likes: nextLikes } : item))
    syncInBackground(async () => {
      const activeToken = activeAuthToken()
      await apiRequest('/folio/replies/likes/toggle', { method: 'POST', body: JSON.stringify({ replyId }) }, activeToken)
    }, 'Não foi possível atualizar a curtida.')
    return true
  }

  async function handleTogglePostReaction(postId: string, type: ReactionType) {
    if (!currentUser) return false
    const post = posts.find(item => item.id === postId)
    const selected = post?.reactions?.some(reaction => reaction.userId === currentUser.id && reaction.type === type)
    setPosts(current => current.map(item => {
      if (item.id !== postId) return item
      const others = (item.reactions || []).filter(reaction => reaction.userId !== currentUser.id)
      return { ...item, reactions: selected ? others : [...others, { userId: currentUser.id, type }] }
    }))
    syncInBackground(async () => {
      const activeToken = activeAuthToken()
      await apiRequest(`/folio/posts/${encodeURIComponent(postId)}/reactions/toggle`, { method: 'POST', body: JSON.stringify({ type }) }, activeToken)
    }, 'Não foi possível reagir à publicação.')
    return true
  }

  function syncInBackground(work: () => Promise<void>, errorText: string, rollback?: () => void) {
    void work().catch(async error => {
      rollback?.()
      showToast('error', errorMessage(error, errorText))
      try {
        await loadBootstrap(activeAuthToken())
      } catch {
        // A próxima atualização normal da tela tenta sincronizar novamente.
      }
    })
  }

  async function handleToggleReplyReaction(replyId: string, type: ReplyReactionType) {
    if (!currentUser) return false
    const reply = replies.find(item => item.id === replyId)
    const selected = reply?.reactions?.some(reaction => reaction.userId === currentUser.id && reaction.type === type)
    setReplies(current => current.map(item => {
      if (item.id !== replyId) return item
      const others = (item.reactions || []).filter(reaction => reaction.userId !== currentUser.id)
      return { ...item, reactions: selected ? others : [...others, { userId: currentUser.id, type }] }
    }))
    syncInBackground(async () => {
      const activeToken = activeAuthToken()
      await apiRequest(`/folio/replies/${encodeURIComponent(replyId)}/reactions/toggle`, { method: 'POST', body: JSON.stringify({ type }) }, activeToken)
    }, 'Não foi possível reagir ao comentário.')
    return true
  }

  async function handleToggleFollow(userId: string) {
    if (!currentUser || userId === currentUser.id) return false
    const following = currentUser.following.includes(userId)
    const nextFollowing = following ? currentUser.following.filter(id => id !== userId) : [...currentUser.following, userId]
    setCurrentUser(current => current ? { ...current, following: nextFollowing } : current)
    setUsers(current => current.map(user => user.id === currentUser.id ? { ...user, following: nextFollowing } : user))
    syncInBackground(async () => {
      await apiRequest(`/folio/follows/${userId}/toggle`, { method: 'POST' }, activeAuthToken())
    }, 'Não foi possível atualizar o seguimento.')
    return true
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
      if (!isImageUpload(file)) throw new Error('Envie uma imagem em JPG, PNG, WEBP ou GIF.')
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch(`${API_BASE_URL}/folio/me/avatar`, {
        method: 'POST',
        credentials: 'include',
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
    if (!currentUser) return false
    const book = books.find(item => item.id === post.bookId)
    const entry = shelf.find(item => item.userId === currentUser.id && item.bookId === post.bookId)
    const currentChapter = book && entry ? chapterFromPercent(book, isCompletedStatus(entry.status) ? 100 : entry.progress) : null
    const shouldOfferShelfUpdate = Boolean(book && entry && !isCompletedStatus(entry.status) && currentChapter !== post.chapter)
    const activeToken = activeAuthToken()

    const temporaryId = `optimistic-post-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimisticPost: Post = { ...post, id: temporaryId, userId: currentUser.id, timestamp: new Date().toISOString(), likes: [], reactions: [], comments: 0, views: [], viewCount: 0 }
    setPosts(current => [optimisticPost, ...current])
    syncInBackground(async () => {
      const saved = await apiRequest<Post>('/folio/posts', { method: 'POST', body: JSON.stringify(post) }, activeToken)
      setPosts(current => current.map(item => item.id === temporaryId ? saved : item))
      let shelfUpdated = false
      let shelfUpdateFailed = false
      const shouldUpdateShelf = shouldOfferShelfUpdate && await askConfirm({
        title: 'Atualizar progresso?',
        description: `Sua ${post.type === 'theory' ? 'teoria' : 'publicação'} foi publicada no capítulo ${post.chapter}, mas sua estante ainda está no capítulo ${currentChapter}. Quer atualizar este livro para o capítulo ${post.chapter}?${book && post.chapter >= book.totalChapters ? '\n\nComo este é o último capítulo, o livro será marcado como lido.' : ''}`,
        confirmLabel: 'Atualizar estante',
        cancelLabel: 'Agora não',
      })

      if (shouldUpdateShelf && book) {
        try {
          await apiRequest(`/folio/shelf/${encodeURIComponent(post.bookId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ progress: percentFromChapter(book, post.chapter) }),
          }, activeToken)
          shelfUpdated = true
        } catch {
          shelfUpdateFailed = true
        }
      }

      await loadBootstrap(activeToken)
      showToast('success', shelfUpdated ? 'Publicação criada e estante atualizada.' : 'Publicação criada com sucesso.')
      if (shelfUpdateFailed) showToast('error', 'A publicação foi criada, mas nao foi possivel atualizar a estante.')
    }, 'Não foi possível criar a publicação.', () => setPosts(current => current.filter(item => item.id !== temporaryId)))
    return true
  }

  async function handleUpdateReadingGoal(changes: { targetBooks?: number; targetBooksMonth?: number; targetBooksWeek?: number; targetDays?: number }) {
    return runAction(async () => {
      await apiRequest('/folio/reading-goal', { method: 'PATCH', body: JSON.stringify(changes) }, token)
      await loadBootstrap()
    }, {
      success: 'Meta atualizada com sucesso.',
      error: 'Nao foi possivel atualizar a meta.',
    })
  }

  async function handleUpdateNotificationPreferences(changes: Partial<NotificationPreferences>) {
    const previous = notificationPreferences
    const next = { ...notificationPreferences, ...changes }
    setNotificationPreferences(next)
    return runAction(async () => {
      const saved = await apiRequest<NotificationPreferences>('/folio/notifications/preferences', { method: 'PATCH', body: JSON.stringify(changes) }, token)
      setNotificationPreferences({ ...DEFAULT_NOTIFICATION_PREFERENCES, ...saved })
    }, {
      success: 'Preferências de notificação atualizadas.',
      error: 'Nao foi possivel atualizar as notificações.',
      silentSuccess: true,
    }).then(result => {
      if (!result) setNotificationPreferences(previous)
      return result
    })
  }

  async function handleAddReadingCheckIn() {
    return runAction(async () => {
      const activeToken = activeAuthToken()
      const updatedGoal = await apiRequest<ReadingGoal>('/folio/reading-goal/checkins', { method: 'POST', body: JSON.stringify({ date: localDateKey() }) }, activeToken)
      setReadingGoal(updatedGoal)
    }, {
      success: 'Check-in registrado com sucesso.',
      error: 'Nao foi possivel registrar o check-in.',
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

  async function handleResetReadingCheckIns() {
    const confirmed = await askConfirm({
      title: 'Recomeçar meta de dias?',
      description: 'Isso limpa os check-ins atuais para você começar uma nova rodada da meta de dias de leitura. A meta anual de livros não será alterada.',
      confirmLabel: 'Recomeçar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    })
    if (!confirmed) return false

    return runAction(async () => {
      const activeToken = activeAuthToken()
      const updatedGoal = await apiRequest<ReadingGoal>('/folio/reading-goal/checkins', { method: 'DELETE' }, activeToken)
      setReadingGoal(updatedGoal)
    }, {
      success: 'Meta de dias reiniciada.',
      error: 'Nao foi possivel recomeçar a meta de dias.',
    })
  }

  async function handleLogout() {
    const logoutToken = activeAuthToken()
    try {
      await apiRequest('/auth/logout', { method: 'POST' }, logoutToken || undefined)
    } catch {
      // Local logout must still work if the network is unavailable.
    }

    setCurrentUser(null)
    localStorage.removeItem('folio_token')
    setToken('')
    setResumeError('')
    setPage('timeline')
    setSelectedBookId(null)
    setSelectedPostId(null)
    setSelectedProfileUserId(null)
    setProfileListKind('following')
    localStorage.removeItem('folio_page')
    localStorage.removeItem('folio_selected_book_id')
    localStorage.removeItem('folio_selected_profile_user_id')
  }

  if (!currentUser) {
    if (loadingApp) return <AppLoadingScreen />
    if (resumeError) return <ServiceUnavailableNotice notice={SERVICE_UNAVAILABLE_NOTICE} onRetry={retryStoredLogin} onLogout={handleLogout} />
    return <LoginPage onLogin={handleLogin} />
  }

  if (maintenanceMode.enabled && !isSuperAdminUser(currentUser)) {
    return (
      <ServiceUnavailableNotice
        notice={maintenanceNotice(maintenanceMode)}
        onRetry={() => void loadBootstrap(token).catch(() => setMaintenanceMode(storedMaintenanceMode()))}
        onLogout={handleLogout}
      />
    )
  }

  const selectedBook = selectedBookId ? books.find(book => book.id === selectedBookId) : null
  const selectedProfileUser = users.find(user => user.id === (selectedProfileUserId || currentUser.id)) || currentUser
  const notificationCount = visibleNotifications.filter(notification => !notification.read).length

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <Navigation
        currentUser={currentUser}
        page={page}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onNavigate={handleNavigate}
        onCreatePost={() => handleOpenCreatePost()}
        onLogout={handleLogout}
      />
      <ActionLoadingIndicator active={actionLoadingCount > 0} />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <NotificationTopButton count={notificationCount} active={page === 'notifications'} onClick={() => void handleNavigate('notifications')} />
      {datePromptDialog}
      {confirmPromptDialog}

      <div className="flex md:ml-60">
        <main className="min-h-screen min-w-0 flex-1 border-x border-stone-800 pb-24 md:pb-0">
          {page === 'timeline' && <TimelinePage currentUser={currentUser} users={users} books={books} shelf={shelf} posts={posts} replies={replies} timeline={timeline} communityFeatureEnabled={communityFeature.enabled || (Boolean(communityFeature.previewEnabled) && isSuperAdminUser(currentUser))} communityPreviewEnabled={Boolean(communityFeature.previewEnabled) && !communityFeature.enabled && isSuperAdminUser(currentUser)} onBookClick={handleBookClick} onUserClick={handleUserClick} onAddReply={handleAddReply} onToggleLike={handleToggleLike} onToggleReaction={handleTogglePostReaction} onToggleReplyLike={handleToggleReplyLike} onToggleReplyReaction={handleToggleReplyReaction} onDeletePost={handleDeletePost} onDeleteReply={handleDeleteReply} onEditPost={handleEditPost} onEditReply={handleEditReply} onViewPost={handleViewPost} onToggleFollow={handleToggleFollow} />}
          {page === 'shelf' && <ShelfPage currentUser={currentUser} shelf={shelf} books={books} onBookClick={handleBookClick} onUpdateShelfEntry={handleUpdateShelfEntry} onRemoveShelfEntry={handleRemoveShelfEntry} onAddBook={handleAddBook} onSaveBook={handleSaveBook} onSearchBooks={handleSearchBooks} />}
          {page === 'library' && <LibraryPage currentUser={currentUser} shelf={shelf} books={books} onBookClick={handleBookClick} onAddBook={handleAddBook} onSaveBook={handleSaveBook} onSetBookActive={handleSetBookActive} onDeleteBook={handleDeleteBook} onSearchBooks={handleSearchBooks} onUploadCover={handleUploadBookCover} />}
          {page === 'book' && selectedBook && <BookPage book={selectedBook} shelf={shelf} posts={posts} replies={replies} users={users} currentUser={currentUser} highlightedPostId={selectedPostId} onBack={handleBack} onUserClick={handleUserClick} onCreatePost={handleOpenCreatePost} onAddReply={handleAddReply} onToggleLike={handleToggleLike} onToggleReaction={handleTogglePostReaction} onToggleReplyLike={handleToggleReplyLike} onToggleReplyReaction={handleToggleReplyReaction} onDeletePost={handleDeletePost} onDeleteReply={handleDeleteReply} onEditPost={handleEditPost} onEditReply={handleEditReply} onViewPost={handleViewPost} onUpdateShelfEntry={handleUpdateShelfEntry} onAddBook={handleAddBook} />}
          {page === 'profile' && <ProfilePage currentUser={currentUser} profileUser={selectedProfileUser} users={users} shelf={shelf} posts={posts} books={books} notificationPreferences={notificationPreferences} onBookClick={handleBookClick} onUpdateUser={handleUpdateUser} onUserClick={handleUserClick} onToggleFollow={handleToggleFollow} onDeletePost={handleDeletePost} onOpenProfileList={handleOpenProfileList} onLogout={handleLogout} onUploadAvatar={handleUploadAvatar} onUpdateNotificationPreferences={handleUpdateNotificationPreferences} />}
          {page === 'profile-list' && <ProfileListPage kind={profileListKind} currentUser={currentUser} profileUser={selectedProfileUser} users={users} books={books} shelf={shelf} posts={posts} replies={replies} onBack={() => setPage('profile')} onBookClick={handleBookClick} onUserClick={handleUserClick} onToggleFollow={handleToggleFollow} onAddReply={handleAddReply} onToggleLike={handleToggleLike} onToggleReaction={handleTogglePostReaction} onToggleReplyLike={handleToggleReplyLike} onToggleReplyReaction={handleToggleReplyReaction} onDeletePost={handleDeletePost} onDeleteReply={handleDeleteReply} onEditPost={handleEditPost} onEditReply={handleEditReply} onViewPost={handleViewPost} />}
          {page === 'goals' && <GoalsPage currentUser={currentUser} shelf={shelf} books={books} readingGoal={readingGoal} onUpdateReadingGoal={handleUpdateReadingGoal} onToggleReadingCheckIn={handleToggleReadingCheckIn} onResetReadingCheckIns={handleResetReadingCheckIns} />}
          {page === 'notifications' && <NotificationsPage notifications={visibleNotifications} currentUser={currentUser} users={users} books={books} shelf={shelf} posts={posts} readingGoal={readingGoal} showDeviceNotificationControls={canUseDeviceNotifications} deviceNotificationStatus={deviceNotifications} onEnableDeviceNotifications={handleEnableDeviceNotifications} onNotificationClick={handleNotificationClick} onUserClick={handleUserClick} onBookClick={handleBookClick} onCreatePost={handleOpenCreatePost} onToggleReadingCheckIn={handleToggleReadingCheckIn} />}
          {page === 'superadmin' && isSuperAdminUser(currentUser) && <SuperAdminDashboardPage token={token} onUserClick={handleUserClick} onBookClick={handleBookClick} maintenanceMode={maintenanceMode} onMaintenanceModeChange={handleMaintenanceModeChange} communityFeature={communityFeature} onCommunityFeatureChange={handleCommunityFeatureChange} />}
          {page === 'store' && isSuperAdminUser(currentUser) && <StorePage token={token} currentUser={currentUser} />}
          {AI_LAB_FRONTEND_ENABLED && page === 'ai-lab' && isSuperAdminUser(currentUser) && <AiLabPage token={token} books={books} />}
        </main>

        <div className="hidden w-88 shrink-0 p-3 xl:block 2xl:w-96">
          <RightPanel currentUser={currentUser} users={users} shelf={shelf} books={books} posts={posts} readingGoal={readingGoal} onBookClick={handleBookClick} onUserClick={handleUserClick} onCreatePost={handleOpenCreatePost} onToggleReadingCheckIn={handleToggleReadingCheckIn} onToggleFollow={handleToggleFollow} />
        </div>
      </div>

      {showPostModal && (
        <CreatePostModal
          currentUser={currentUser}
          users={users}
          shelf={shelf}
          books={books}
          initialBookId={editingPost?.bookId || postModalBookId || (page === 'book' ? selectedBookId : null)}
          editingPost={editingPost}
          communityFeatureEnabled={communityFeature.enabled}
          onClose={() => {
            setShowPostModal(false)
            setPostModalBookId(null)
            setEditingPost(null)
          }}
          onPost={editingPost ? handleUpdatePost : handleCreatePost}
          onUploadImage={handleUploadPostImage}
        />
      )}
    </div>
  )
}

