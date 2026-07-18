import { useEffect, useMemo, useState } from 'react'

type BookStatus = 'reading' | 'want' | 'read' | 'rereading' | 'abandoned'
type PostType = 'comment' | 'reaction' | 'theory'
type Page = 'timeline' | 'shelf' | 'book' | 'profile' | 'goals' | 'notifications'
type FilterMode = 'percent' | 'chapter'

interface User {
  id: string
  name: string
  email: string
  password: string
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
  source?: 'mock' | 'openlibrary'
  genres: string[]
  rating: number
  synopsis: string
}

interface ShelfEntry {
  userId: string
  bookId: string
  status: BookStatus
  progress: number
  rating?: number
  spiceRating?: number
  startDate?: string
  endDate?: string
}

interface Post {
  id: string
  userId: string
  bookId: string
  chapter: number
  percent: number
  text?: string
  reactionEmoji?: string
  type: PostType
  timestamp: string
  likes: string[]
  comments: number
}

interface TimelineEvent {
  id: string
  userId: string
  type: 'started' | 'finished' | 'progress' | 'posted'
  bookId?: string
  postId?: string
  data?: Record<string, number>
  timestamp: string
}

interface Reply {
  id: string
  postId: string
  userId: string
  text: string
  timestamp: string
}

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'https://localhost:7113' : '')

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
  return response.json() as Promise<T>
}

const STATUS_LABELS: Record<BookStatus, string> = {
  reading: 'Lendo',
  want: 'TBR',
  read: 'Lido',
  rereading: 'Relendo',
  abandoned: 'Abandonei',
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min))
}

function chapterFromPercent(book: Book, percent: number) {
  return clamp(Math.ceil((book.totalChapters * percent) / 100), 1, book.totalChapters)
}

function percentFromChapter(book: Book, chapter: number) {
  return clamp(Math.round((chapter / book.totalChapters) * 100), 1, 100)
}

const RATING_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]

function ratingText(value?: number, label = 'estrelas') {
  return value ? `${value} de 5 ${label}` : 'Sem avaliação'
}

function formatTime(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const diffHours = Math.floor((now.getTime() - d.getTime()) / 3600000)
  if (diffHours < 1) return 'agora'
  if (diffHours < 24) return `${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function Avatar({ user, size = 'md' }: { user: User; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-xl',
  }

  const isImage = user.avatar.startsWith('http') || user.avatar.startsWith('data:')

  return isImage ? (
    <img src={user.avatar} alt={user.name} className={`${sizes[size]} shrink-0 select-none rounded-full object-cover`} />
  ) : (
    <div className={`${sizes[size]} flex shrink-0 select-none items-center justify-center rounded-full bg-amber-700 font-semibold text-amber-50`}>
      {user.avatar}
    </div>
  )
}

function ProgressBadge({ percent, chapter }: { percent: number; chapter?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
      {chapter ? `Cap. ${chapter} · ` : ''}{percent}%
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
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('Ana Beatriz')
  const [email, setEmail] = useState('ana@leitora.com')
  const [password, setPassword] = useState('leitora123')
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

  return (
    <main className="min-h-screen bg-stone-950 px-4 py-8 text-stone-100">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 md:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">Folio</p>
            <h1 className="max-w-2xl font-serif text-4xl leading-tight text-stone-50 sm:text-5xl">
              Twitter literário para comentar livros sem tomar spoiler.
            </h1>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {['Feed por capítulo', 'Estante e progresso', 'Teorias protegidas'].map(item => (
              <div key={item} className="rounded-lg border border-stone-800 bg-stone-900/70 p-4 text-sm text-stone-300">
                {item}
              </div>
            ))}
          </div>
        </section>

        <form onSubmit={handleSubmit} className="rounded-lg border border-stone-800 bg-stone-900 p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-stone-50">{mode === 'login' ? 'Entrar' : 'Criar conta'}</h2>
            <p className="mt-1 text-sm text-stone-400">Agora conectado à API e ao Postgres do servidor.</p>
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
        </form>
      </div>
    </main>
  )
}

function Navigation({ currentUser, page, notificationCount, onNavigate, onCreatePost, onLogout }: {
  currentUser: User
  page: Page
  notificationCount: number
  onNavigate: (p: Page) => void
  onCreatePost: () => void
  onLogout: () => void
}) {
  const navItems: { id: Page; icon: string; label: string }[] = [
    { id: 'timeline', icon: '⌂', label: 'Início' },
    { id: 'shelf', icon: '▦', label: 'Estante' },
    { id: 'goals', icon: '◎', label: 'Metas' },
    { id: 'notifications', icon: '◌', label: 'Avisos' },
    { id: 'profile', icon: '○', label: 'Perfil' },
  ]

  return (
    <>
      <aside className="fixed left-0 top-0 z-30 hidden h-full w-60 flex-col border-r border-stone-800 bg-stone-950 px-3 py-5 md:flex">
        <button onClick={() => onNavigate('timeline')} className="mb-6 px-2 text-left font-serif text-2xl text-amber-300">
          Folio
        </button>
        <nav className="flex-1 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                page === item.id ? 'bg-amber-300/10 text-amber-300' : 'text-stone-400 hover:bg-stone-900 hover:text-stone-100'
              }`}
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-800 bg-stone-950/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-6 items-center gap-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex min-h-12 flex-col items-center justify-center rounded-lg text-[11px] font-semibold ${
                page === item.id ? 'bg-amber-300/10 text-amber-300' : 'text-stone-500'
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
              {item.id === 'notifications' && notificationCount > 0 && (
                <span className="absolute right-2 top-1 rounded-full bg-red-400 px-1 text-[9px] font-bold text-stone-950">{notificationCount}</span>
              )}
            </button>
          ))}
          <button onClick={onCreatePost} className="flex min-h-12 flex-col items-center justify-center rounded-lg bg-amber-300 text-[11px] font-bold text-stone-950">
            <span className="text-base leading-none">+</span>
            Postar
          </button>
        </div>
      </nav>
    </>
  )
}

function PostCard({ post, users, books, currentUser, replies, onBookClick, onUserClick, onAddReply, onToggleLike, onDeletePost, onDeleteReply, compactBook = false }: {
  post: Post
  users: User[]
  books: Book[]
  currentUser: User
  replies: Reply[]
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
  onAddReply: (postId: string, text: string) => void
  onToggleLike: (postId: string) => void
  onDeletePost: (postId: string) => void
  onDeleteReply: (replyId: string) => void
  compactBook?: boolean
}) {
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [replyText, setReplyText] = useState('')
  const author = users.find(u => u.id === post.userId)!
  const book = books.find(b => b.id === post.bookId)
  const relatedReplies = replies.filter(reply => reply.postId === post.id)
  const displayedComments = post.comments + relatedReplies.length
  const liked = post.likes.includes(currentUser.id)

  function submitReply() {
    const trimmed = replyText.trim()
    if (!trimmed) return
    onAddReply(post.id, trimmed)
    setReplyText('')
    setShowReplyBox(false)
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
              <img src={book.cover} alt={book.title} className="h-8 w-6 shrink-0 rounded object-cover" />
              <span className="truncate text-xs font-semibold text-amber-300">{book.title}</span>
              <ProgressBadge percent={post.percent} chapter={post.chapter} />
            </button>
          )}
          {book && compactBook && <div className="mb-2"><ProgressBadge percent={post.percent} chapter={post.chapter} /></div>}
          {post.reactionEmoji && <div className="mb-2 text-3xl leading-none">{post.reactionEmoji}</div>}
          {post.text && <p className="mb-3 text-sm leading-relaxed text-stone-300">{post.text}</p>}
          <div className="flex items-center gap-5 text-xs">
            <button
              onClick={() => onToggleLike(post.id)}
              className={`font-semibold ${liked ? 'text-red-300' : 'text-stone-500 hover:text-red-300'}`}
            >
              {liked ? '♥' : '♡'} {post.likes.length}
            </button>
            <button onClick={() => setShowReplyBox(value => !value)} className="font-semibold text-stone-500 hover:text-amber-300">
              comentar {displayedComments}
            </button>
          </div>
          {showReplyBox && (
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
          {relatedReplies.length > 0 && (
            <div className="mt-3 space-y-2">
              {relatedReplies.slice(-2).map(reply => {
                const replyUser = users.find(user => user.id === reply.userId) || currentUser
                return (
                  <div key={reply.id} className="flex gap-2 rounded-lg bg-stone-950 p-2">
                    <button onClick={() => onUserClick(replyUser.id)}><Avatar user={replyUser} size="sm" /></button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onUserClick(replyUser.id)} className="text-xs font-bold text-stone-200 hover:text-amber-300">@{replyUser.handle}</button>
                        {reply.userId === currentUser.id && (
                          <button onClick={() => onDeleteReply(reply.id)} className="text-xs font-bold text-red-300 hover:text-red-200">apagar</button>
                        )}
                      </div>
                      <p className="text-sm text-stone-400">{reply.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function TimelinePage({ currentUser, users, books, posts, replies, timeline, onBookClick, onUserClick, onAddReply, onToggleLike, onDeletePost, onDeleteReply, onToggleFollow }: {
  currentUser: User
  users: User[]
  books: Book[]
  posts: Post[]
  replies: Reply[]
  timeline: TimelineEvent[]
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
  onAddReply: (postId: string, text: string) => void
  onToggleLike: (postId: string) => void
  onDeletePost: (postId: string) => void
  onDeleteReply: (replyId: string) => void
  onToggleFollow: (userId: string) => void
}) {
  const [tab, setTab] = useState<'posts' | 'activity'>('posts')
  const [readerQuery, setReaderQuery] = useState('')
  const feedPosts = useMemo(() => {
    const allowed = [...currentUser.following, currentUser.id]
    return posts.filter(p => allowed.includes(p.userId)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [posts, currentUser.following, currentUser.id])
  const feedActivity = useMemo(() => timeline.filter(e => currentUser.following.includes(e.userId)).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()), [timeline, currentUser.following])
  const foundReaders = users
    .filter(user => user.id !== currentUser.id)
    .filter(user => `${user.name} ${user.handle}`.toLowerCase().includes(readerQuery.toLowerCase()))
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
        feedPosts.length ? feedPosts.map(post => <PostCard key={post.id} post={post} users={users} books={books} currentUser={currentUser} replies={replies} onBookClick={onBookClick} onUserClick={onUserClick} onAddReply={onAddReply} onToggleLike={onToggleLike} onDeletePost={onDeletePost} onDeleteReply={onDeleteReply} />) : <EmptyState text="Siga leitores para ver publicações aqui." />
      )}

      {tab === 'activity' && (
        feedActivity.length ? feedActivity.map(event => {
          const user = users.find(u => u.id === event.userId)!
          const book = event.bookId ? books.find(b => b.id === event.bookId) : null
          const textByType = {
            started: 'começou a ler',
            finished: 'terminou',
            progress: `atualizou o progresso para ${event.data?.to}%`,
            posted: 'publicou em',
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

function BookSearchRow({ book, actionLabel, onAction }: { book: Book; actionLabel: string; onAction: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-stone-950 p-2">
      <img src={book.cover} alt={book.title} className="h-12 w-8 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
        <p className="truncate text-xs text-stone-500">{book.author}</p>
        <p className="text-xs text-stone-600">{book.totalPages} págs. · {book.totalChapters} caps.{book.chaptersEstimated ? ' estimados' : ''}</p>
      </div>
      <button onClick={onAction} className="rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-stone-950">
        {actionLabel}
      </button>
    </div>
  )
}

function ShelfPage({ currentUser, shelf, books, onBookClick, onUpdateShelfEntry, onRemoveShelfEntry, onAddBook, onImportBook, onSearchBooks }: {
  currentUser: User
  shelf: ShelfEntry[]
  books: Book[]
  onBookClick: (id: string) => void
  onUpdateShelfEntry: (bookId: string, changes: Partial<ShelfEntry>) => void
  onRemoveShelfEntry: (bookId: string) => void
  onAddBook: (bookId: string, status: BookStatus) => void
  onImportBook: (book: Book, status: BookStatus) => void
  onSearchBooks: (query: string) => Promise<Book[]>
}) {
  const [activeStatus, setActiveStatus] = useState<BookStatus>('reading')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [progressInput, setProgressInput] = useState('')
  const [chapterInput, setChapterInput] = useState('')
  const [bookQuery, setBookQuery] = useState('')
  const [newBookStatus, setNewBookStatus] = useState<BookStatus>('reading')
  const [openLibraryResults, setOpenLibraryResults] = useState<Book[]>([])
  const [openLibraryLoading, setOpenLibraryLoading] = useState(false)
  const [openLibraryError, setOpenLibraryError] = useState('')
  const [bookSearchAttempted, setBookSearchAttempted] = useState(false)
  const statuses: BookStatus[] = ['reading', 'want', 'read', 'rereading', 'abandoned']
  const myShelf = shelf.filter(s => s.userId === currentUser.id)
  const statusCounts = statuses.reduce((acc, status) => ({ ...acc, [status]: myShelf.filter(entry => entry.status === status).length }), {} as Record<BookStatus, number>)
  const filtered = myShelf
    .filter(entry => entry.status === activeStatus)
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)
  const availableBooks = books
    .filter(book => !myShelf.some(entry => entry.bookId === book.id))
    .filter(book => `${book.title} ${book.author}`.toLowerCase().includes(bookQuery.toLowerCase()))
    .slice(0, 4)
  const importableResults = openLibraryResults.filter(book => !myShelf.some(entry => entry.bookId === book.id))

  async function searchOpenLibrary() {
    const query = bookQuery.trim()
    if (query.length < 2) return
    setOpenLibraryLoading(true)
    setOpenLibraryError('')
    setBookSearchAttempted(true)
    try {
      setOpenLibraryResults(await onSearchBooks(query))
    } catch {
      setOpenLibraryError('Não consegui consultar agora. Tente novamente em instantes.')
      setOpenLibraryResults([])
    } finally {
      setOpenLibraryLoading(false)
    }
  }

  function startEdit(book: Book, entry: ShelfEntry) {
    setEditingId(book.id)
    setProgressInput(String(entry.progress))
    setChapterInput(String(chapterFromPercent(book, Math.max(entry.progress, 1))))
  }

  function saveProgress(book: Book) {
    const hasChapter = chapterInput.trim().length > 0
    const nextProgress = hasChapter ? percentFromChapter(book, Number(chapterInput)) : clamp(Number(progressInput), 0, 100)
    onUpdateShelfEntry(book.id, {
      progress: nextProgress,
      status: nextProgress >= 100 ? 'read' : activeStatus === 'read' ? 'reading' : activeStatus,
      endDate: nextProgress >= 100 ? new Date().toISOString().slice(0, 10) : undefined,
    })
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
                setOpenLibraryError('')
              }}
              placeholder="Pesquisar por título ou autor"
              className="mt-2 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm normal-case tracking-normal text-stone-100 outline-none focus:border-amber-300"
            />
          </label>
          <div className="mt-2 flex gap-2">
            <select value={newBookStatus} onChange={e => setNewBookStatus(e.target.value as BookStatus)} className="min-w-0 flex-1 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300">
              {statuses.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
            <button onClick={searchOpenLibrary} disabled={bookQuery.trim().length < 2 || openLibraryLoading} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950 disabled:bg-stone-700 disabled:text-stone-500">
              {openLibraryLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          {bookQuery && (
            <div className="mt-3 space-y-2">
              {availableBooks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Catálogo do protótipo</p>
                  {availableBooks.map(book => (
                    <BookSearchRow
                      key={book.id}
                      book={book}
                      actionLabel="Adicionar"
                      onAction={() => {
                        onAddBook(book.id, newBookStatus)
                        setBookQuery('')
                        setBookSearchAttempted(false)
                        setActiveStatus(newBookStatus)
                      }}
                    />
                  ))}
                </div>
              )}
              {openLibraryError && <p className="rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{openLibraryError}</p>}
              {importableResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Resultados de busca</p>
                  {importableResults.map(book => (
                    <BookSearchRow
                      key={book.id}
                      book={book}
                      actionLabel="Importar"
                      onAction={() => {
                        onImportBook(book, newBookStatus)
                        setBookQuery('')
                        setOpenLibraryResults([])
                        setBookSearchAttempted(false)
                        setActiveStatus(newBookStatus)
                      }}
                    />
                  ))}
                </div>
              )}
              {!availableBooks.length && !importableResults.length && !openLibraryLoading && !openLibraryError && (
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
              <img src={book.cover} alt={book.title} className="h-full min-h-36 w-full object-cover sm:h-48" />
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
                  onChange={e => {
                    const status = e.target.value as BookStatus
                    onUpdateShelfEntry(book.id, {
                      status,
                      progress: status === 'read' ? 100 : entry.progress,
                      endDate: status === 'read' ? new Date().toISOString().slice(0, 10) : undefined,
                    })
                  }}
                  className="rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs font-bold text-stone-100 outline-none focus:border-amber-300"
                >
                  {statuses.map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                </select>
                {entry.status === 'read' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={entry.rating ?? ''}
                      onChange={e => onUpdateShelfEntry(book.id, { rating: Number(e.target.value) })}
                      className="rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs font-bold text-amber-300 outline-none focus:border-amber-300"
                    >
                      <option value="">★</option>
                      {RATING_OPTIONS.map(value => <option key={value} value={value}>{value} ★</option>)}
                    </select>
                    <select
                      value={entry.spiceRating ?? ''}
                      onChange={e => onUpdateShelfEntry(book.id, { spiceRating: Number(e.target.value) })}
                      className="rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-xs font-bold text-red-300 outline-none focus:border-red-300"
                    >
                      <option value="">Hot</option>
                      {RATING_OPTIONS.map(value => <option key={value} value={value}>{value} 🌶</option>)}
                    </select>
                  </div>
                ) : (
                  <span className="rounded-lg border border-stone-800 px-2 py-2 text-xs text-stone-500">Cap. {chapterFromPercent(book, Math.max(entry.progress, 1))}</span>
                )}
              </div>
              {entry.status === 'reading' || entry.status === 'rereading' ? (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300">{entry.progress}% lido</span>
                    <button onClick={() => startEdit(book, entry)} className="text-xs font-semibold text-stone-500 hover:text-stone-200">
                      atualizar
                    </button>
                  </div>
                  {editingId === book.id ? (
                    <div className="grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={progressInput}
                          onChange={e => {
                            setProgressInput(e.target.value)
                            setChapterInput(String(chapterFromPercent(book, Number(e.target.value))))
                          }}
                          placeholder="%"
                          className="min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
                        />
                        <input
                          type="number"
                          min="1"
                          max={book.totalChapters}
                          value={chapterInput}
                          onChange={e => {
                            setChapterInput(e.target.value)
                            setProgressInput(String(percentFromChapter(book, Number(e.target.value))))
                          }}
                          placeholder="Capítulo"
                          className="min-w-0 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
                        />
                      </div>
                      <button onClick={() => saveProgress(book)} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">
                        Salvar progresso
                      </button>
                    </div>
                  ) : (
                    <ProgressBar value={entry.progress} />
                  )}
                </>
              ) : entry.status === 'read' ? (
                <div>
                  <p className="mb-2 text-sm text-stone-400">Leitura concluída</p>
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
    </section>
  )
}

function BookPage({ book, shelf, posts, replies, users, currentUser, onBack, onUserClick, onAddReply, onToggleLike, onDeletePost, onDeleteReply, onUpdateShelfEntry, onAddBook }: {
  book: Book
  shelf: ShelfEntry[]
  posts: Post[]
  replies: Reply[]
  users: User[]
  currentUser: User
  onBack: () => void
  onUserClick: (id: string) => void
  onAddReply: (postId: string, text: string) => void
  onToggleLike: (postId: string) => void
  onDeletePost: (postId: string) => void
  onDeleteReply: (replyId: string) => void
  onUpdateShelfEntry: (bookId: string, changes: Partial<ShelfEntry>) => void
  onAddBook: (bookId: string, status: BookStatus) => void
}) {
  const [tab, setTab] = useState<'feed' | 'theories' | 'about'>('feed')
  const myEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === book.id)
  const myProgress = myEntry?.progress ?? 0
  const defaultChapter = chapterFromPercent(book, Math.max(myProgress, 1))
  const [filterMode, setFilterMode] = useState<FilterMode>('percent')
  const [percentLimit, setPercentLimit] = useState(myProgress || 1)
  const [chapterLimit, setChapterLimit] = useState(defaultChapter)
  const [progressInput, setProgressInput] = useState(String(myProgress || 1))
  const [chapterInput, setChapterInput] = useState(String(defaultChapter))
  const readers = shelf.filter(entry => entry.bookId === book.id).length

  const postsInBook = posts.filter(post => post.bookId === book.id)
  const comments = postsInBook.filter(post => post.type !== 'theory').sort((a, b) => a.percent - b.percent)
  const theories = postsInBook.filter(post => post.type === 'theory').sort((a, b) => a.percent - b.percent)
  const isVisible = (post: Post) => filterMode === 'percent' ? post.percent <= percentLimit : post.chapter <= chapterLimit
  const activeList = tab === 'theories' ? theories : comments
  const visible = activeList.filter(isVisible)
  const hidden = activeList.filter(post => !isVisible(post))

  return (
    <section>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-800 bg-stone-950/90 px-4 py-3 backdrop-blur-xl md:px-5">
        <button onClick={onBack} className="rounded-lg px-2 py-1 text-xl leading-none text-stone-400 hover:bg-stone-900 hover:text-stone-100">
          ←
        </button>
        <h1 className="min-w-0 truncate font-serif text-base text-stone-100">{book.title}</h1>
      </header>

      <div className="border-b border-stone-800 p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-[132px_1fr]">
          <img src={book.cover} alt={book.title} className="h-48 w-32 rounded-lg object-cover sm:h-52 sm:w-full" />
          <div className="min-w-0">
            <h2 className="font-serif text-2xl leading-tight text-stone-50">{book.title}</h2>
            <p className="mt-1 text-sm text-stone-400">{book.author}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
              <span className="font-bold text-amber-300">★ {book.rating}</span>
              <span>{book.totalPages} páginas</span>
              <span>{book.totalChapters} capítulos{book.chaptersEstimated ? ' estimados' : ''}</span>
              <span>{readers} leitores</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {book.genres.map(genre => <span key={genre} className="rounded-full border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-300">{genre}</span>)}
            </div>
            <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">Filtro anti-spoiler</span>
                <span className="text-xs text-stone-400">Seu progresso: {myProgress || 0}%</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="grid grid-cols-2 rounded-lg bg-stone-950 p-1">
                  {([['percent', '%'], ['chapter', 'Capítulo']] as const).map(([id, label]) => (
                    <button key={id} onClick={() => setFilterMode(id)} className={`rounded-md px-3 py-2 text-xs font-bold ${filterMode === id ? 'bg-amber-300 text-stone-950' : 'text-stone-400'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {filterMode === 'percent' ? (
                  <label className="grid gap-2 text-xs text-stone-400">
                    Mostrar comentários até {percentLimit}%
                    <input type="range" min="1" max="100" value={percentLimit} onChange={e => setPercentLimit(Number(e.target.value))} className="accent-amber-300" />
                  </label>
                ) : (
                  <label className="grid gap-2 text-xs text-stone-400">
                    Mostrar comentários até o capítulo {chapterLimit}
                    <input type="range" min="1" max={book.totalChapters} value={chapterLimit} onChange={e => setChapterLimit(Number(e.target.value))} className="accent-amber-300" />
                  </label>
                )}
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-stone-800 bg-stone-900 p-3">
              {myEntry ? (
                <>
                  <div className="mb-3 grid gap-2 sm:grid-cols-2">
                    <select
                      value={myEntry.status}
                      onChange={e => {
                        const status = e.target.value as BookStatus
                        onUpdateShelfEntry(book.id, {
                          status,
                          progress: status === 'read' ? 100 : myEntry.progress,
                          endDate: status === 'read' ? new Date().toISOString().slice(0, 10) : undefined,
                        })
                        if (status === 'read') {
                          setProgressInput('100')
                          setChapterInput(String(book.totalChapters))
                          setPercentLimit(100)
                          setChapterLimit(book.totalChapters)
                        }
                      }}
                      className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-stone-100 outline-none focus:border-amber-300"
                    >
                      {(['reading', 'want', 'read', 'rereading', 'abandoned'] as BookStatus[]).map(status => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                    </select>
                    {myEntry.status === 'read' && (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={myEntry.rating ?? ''}
                          onChange={e => onUpdateShelfEntry(book.id, { rating: Number(e.target.value) })}
                          className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-amber-300 outline-none focus:border-amber-300"
                        >
                          <option value="">Estrelas</option>
                          {RATING_OPTIONS.map(value => <option key={value} value={value}>{value} ★</option>)}
                        </select>
                        <select
                          value={myEntry.spiceRating ?? ''}
                          onChange={e => onUpdateShelfEntry(book.id, { spiceRating: Number(e.target.value) })}
                          className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm font-bold text-red-300 outline-none focus:border-red-300"
                        >
                          <option value="">Pimentas</option>
                          {RATING_OPTIONS.map(value => <option key={value} value={value}>{value} 🌶</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  {(myEntry.status === 'reading' || myEntry.status === 'rereading') && (
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={progressInput}
                        onChange={e => {
                          setProgressInput(e.target.value)
                          setChapterInput(String(chapterFromPercent(book, Number(e.target.value))))
                        }}
                        className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
                        aria-label="Porcentagem lida"
                      />
                      <input
                        type="number"
                        min="1"
                        max={book.totalChapters}
                        value={chapterInput}
                        onChange={e => {
                          setChapterInput(e.target.value)
                          setProgressInput(String(percentFromChapter(book, Number(e.target.value))))
                        }}
                        className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
                        aria-label="Capítulo atual"
                      />
                      <button onClick={() => {
                        const nextProgress = clamp(Number(progressInput), 0, 100)
                        onUpdateShelfEntry(book.id, {
                          progress: nextProgress,
                          status: nextProgress >= 100 ? 'read' : myEntry.status,
                          endDate: nextProgress >= 100 ? new Date().toISOString().slice(0, 10) : undefined,
                        })
                        setPercentLimit(nextProgress || 1)
                        setChapterLimit(chapterFromPercent(book, Math.max(nextProgress, 1)))
                      }} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">
                        Atualizar
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => onAddBook(book.id, 'reading')} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-stone-950">Adicionar como lendo</button>
                  <button onClick={() => onAddBook(book.id, 'want')} className="rounded-lg border border-stone-700 px-3 py-2 text-sm font-bold text-stone-300">TBR</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[53px] z-10 grid grid-cols-3 border-b border-stone-800 bg-stone-950">
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
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Páginas', book.totalPages],
              [book.chaptersEstimated ? 'Capítulos estimados' : 'Capítulos', book.totalChapters],
              ['Avaliação', book.rating ? `★ ${book.rating}` : 'Sem nota'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-stone-800 bg-stone-900 p-3 text-center">
                <div className="font-serif text-xl text-amber-300">{value}</div>
                <div className="text-xs text-stone-500">{label}</div>
              </div>
            ))}
          </div>
          {book.source === 'openlibrary' && (
            <p className="text-xs text-stone-500">Dados importados. Páginas e nota vêm do catálogo; capítulos são estimados quando a API não informa divisão por capítulos.</p>
          )}
          {myEntry?.status === 'read' && (
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
          {!visible.length && !hidden.length && <EmptyState text={tab === 'theories' ? 'Nenhuma teoria publicada ainda.' : 'Nenhum comentário publicado ainda.'} />}
          {visible.map(post => <PostCard key={post.id} post={post} users={users} books={[book]} currentUser={currentUser} replies={replies} onBookClick={() => {}} onUserClick={onUserClick} onAddReply={onAddReply} onToggleLike={onToggleLike} onDeletePost={onDeletePost} onDeleteReply={onDeleteReply} compactBook />)}
          {hidden.length > 0 && (
            <div className="m-4 rounded-lg border border-stone-800 bg-stone-900 p-5 text-center">
              <div className="mb-2 text-3xl">🔒</div>
              <p className="text-sm font-bold text-stone-200">
                {hidden.length} {tab === 'theories' ? 'teoria(s)' : 'comentário(s)'} depois do filtro
              </p>
              <p className="mt-1 text-xs text-stone-500">Avance a leitura ou ajuste o filtro para desbloquear com segurança.</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function ProfilePage({ currentUser, profileUser, users, shelf, posts, books, onBookClick, onUpdateUser, onUserClick, onToggleFollow, onDeletePost }: {
  currentUser: User
  profileUser: User
  users: User[]
  shelf: ShelfEntry[]
  posts: Post[]
  books: Book[]
  onBookClick: (id: string) => void
  onUpdateUser: (changes: Partial<User>) => void
  onUserClick: (userId: string) => void
  onToggleFollow: (userId: string) => void
  onDeletePost: (postId: string) => void
}) {
  const isOwnProfile = currentUser.id === profileUser.id
  const followingThisUser = currentUser.following.includes(profileUser.id)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profileUser.name)
  const [handle, setHandle] = useState(profileUser.handle)
  const [bio, setBio] = useState(profileUser.bio)
  const [avatar, setAvatar] = useState(profileUser.avatar.startsWith('http') ? profileUser.avatar : '')
  const myShelf = shelf.filter(entry => entry.userId === profileUser.id)
  const myPosts = posts.filter(post => post.userId === profileUser.id).sort((a, b) => a.percent - b.percent)
  const visibleShelf = myShelf
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId) }))
    .filter((item): item is { entry: ShelfEntry; book: Book } => Boolean(item.book))
  const stats = [
    ['Livros lidos', myShelf.filter(entry => entry.status === 'read').length],
    ['Páginas lidas', profileUser.pagesRead.toLocaleString('pt-BR')],
    ['Lendo agora', myShelf.filter(entry => entry.status === 'reading').length],
    ['TBR', myShelf.filter(entry => entry.status === 'want').length],
  ]
  const socialLists = [
    ['Seguindo', profileUser.following],
    ['Seguidores', profileUser.followers],
  ] as const

  return (
    <section>
      <Header title={isOwnProfile ? 'Perfil' : `@${profileUser.handle}`} />
      <div className="border-b border-stone-800 p-4 md:p-5">
        <div className="flex gap-4">
          <Avatar user={profileUser} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-2xl text-stone-50">{profileUser.name}</h2>
            <p className="text-sm text-stone-500">@{profileUser.handle}</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-300">{profileUser.bio}</p>
          </div>
          {isOwnProfile ? (
            <button onClick={() => setEditing(value => !value)} className="h-9 rounded-lg border border-stone-700 px-3 text-xs font-bold text-stone-300 hover:bg-stone-900">
              {editing ? 'Fechar' : 'Editar'}
            </button>
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
            <label className="text-sm font-semibold text-stone-300">
              Foto
              <input value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="Cole a URL de uma imagem" className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300" />
            </label>
            <div className="flex justify-end">
              <button onClick={() => {
                const fallbackAvatar = name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || profileUser.avatar
                onUpdateUser({ name: name.trim() || profileUser.name, handle: handle.trim() || profileUser.handle, bio: bio.trim(), avatar: avatar.trim() || fallbackAvatar })
                setEditing(false)
              }} className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-stone-950">
                Salvar perfil
              </button>
            </div>
          </div>
        )}
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          {[['Seguindo', profileUser.following.length], ['Seguidores', profileUser.followers.length], ['Posts', myPosts.length]].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-stone-800 bg-stone-900 p-3">
              <div className="font-serif text-xl text-stone-100">{value}</div>
              <div className="text-xs text-stone-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-stone-800 p-4 md:p-5">
        <h3 className="mb-3 font-serif text-lg text-stone-100">Rede</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {socialLists.map(([label, ids]) => (
            <div key={label} className="rounded-lg border border-stone-800 bg-stone-900 p-3">
              <h4 className="mb-2 text-sm font-bold text-stone-300">{label}</h4>
              <div className="space-y-2">
                {ids.length ? ids.slice(0, 5).map(id => {
                  const user = users.find(item => item.id === id)
                  if (!user) return null
                  return (
                    <button key={id} onClick={() => onUserClick(id)} className="flex w-full items-center gap-2 rounded-lg bg-stone-950 p-2 text-left">
                      <Avatar user={user} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-stone-100">{user.name}</p>
                        <p className="text-xs text-stone-500">@{user.handle}</p>
                      </div>
                    </button>
                  )
                }) : <p className="text-sm text-stone-500">Nada por aqui ainda.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-stone-800 p-4 md:p-5">
        <h3 className="mb-3 font-serif text-lg text-stone-100">Estatísticas</h3>
        <div className="grid grid-cols-2 gap-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-stone-800 bg-stone-900 p-4">
              <div className="font-serif text-2xl text-amber-300">{value}</div>
              <div className="text-xs text-stone-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 md:p-5">
        <h3 className="mb-3 font-serif text-lg text-stone-100">Estante</h3>
        <div className="mb-6 space-y-3">
          {visibleShelf.length ? visibleShelf.map(({ entry, book }) => (
            <button key={entry.bookId} onClick={() => onBookClick(book.id)} className="flex w-full gap-3 rounded-lg border border-stone-800 bg-stone-900 p-3 text-left">
              <img src={book.cover} alt={book.title} className="h-16 w-11 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
                  <span className="rounded-full border border-stone-700 px-2 py-0.5 text-xs text-stone-400">{STATUS_LABELS[entry.status]}</span>
                </div>
                <p className="mb-2 text-xs text-stone-500">{book.author} · {entry.progress}% lido</p>
                {entry.status === 'read' && (
                  <p className="text-xs font-bold text-stone-300">
                    <span className="text-amber-300">{ratingText(entry.rating)}</span>
                    {' · '}
                    <span className="text-red-300">{ratingText(entry.spiceRating, 'pimentas')}</span>
                  </p>
                )}
              </div>
            </button>
          )) : <p className="text-sm text-stone-500">Nenhum livro na estante ainda.</p>}
        </div>
        <h3 className="mb-3 font-serif text-lg text-stone-100">Leitura</h3>
        {myPosts.length ? (
          <div className="space-y-3">
            {myPosts.map(post => {
              const book = books.find(item => item.id === post.bookId)
              return (
                <div key={post.id} className="flex gap-3 rounded-lg border border-stone-800 bg-stone-900 p-3 text-left">
                  {book && <img src={book.cover} alt={book.title} className="h-14 w-10 shrink-0 rounded object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      {book && <button onClick={() => onBookClick(book.id)} className="truncate text-xs font-bold text-amber-300 hover:text-amber-200">{book.title}</button>}
                      <ProgressBadge percent={post.percent} chapter={post.chapter} />
                      {isOwnProfile && <button onClick={() => onDeletePost(post.id)} className="ml-auto text-xs font-bold text-red-300 hover:text-red-200">apagar</button>}
                    </div>
                    {post.reactionEmoji && <span className="text-xl">{post.reactionEmoji}</span>}
                    {post.text && <p className="line-clamp-2 text-sm text-stone-300">{post.text}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : <p className="text-sm text-stone-500">Suas leituras e publicações aparecerão aqui em ordem de progresso.</p>}
      </div>
    </section>
  )
}

function NotificationsPage({ currentUser, users, posts, replies, books, onBookClick, onUserClick }: {
  currentUser: User
  users: User[]
  posts: Post[]
  replies: Reply[]
  books: Book[]
  onBookClick: (id: string) => void
  onUserClick: (id: string) => void
}) {
  const myPosts = posts.filter(post => post.userId === currentUser.id)
  const likeNotifications = myPosts.flatMap(post =>
    post.likes
      .filter(userId => userId !== currentUser.id)
      .map(userId => ({ id: `like-${post.id}-${userId}`, type: 'like' as const, userId, post, timestamp: post.timestamp }))
  )
  const replyNotifications = replies
    .map(reply => {
      const post = myPosts.find(item => item.id === reply.postId)
      return post && reply.userId !== currentUser.id ? { id: `reply-${reply.id}`, type: 'reply' as const, userId: reply.userId, post, reply, timestamp: reply.timestamp } : null
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const notifications = [...replyNotifications, ...likeNotifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <section>
      <Header title="Avisos">
        <p className="text-sm text-stone-500">Curtidas e respostas nas suas publicações aparecem aqui.</p>
      </Header>
      {notifications.length ? (
        <div>
          {notifications.map(notification => {
            const user = users.find(item => item.id === notification.userId)
            const book = books.find(item => item.id === notification.post.bookId)
            if (!user || !book) return null
            return (
              <article key={notification.id} className="border-b border-stone-800 px-4 py-4 md:px-5">
                <div className="flex gap-3">
                  <button onClick={() => onUserClick(user.id)}><Avatar user={user} size="sm" /></button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-300">
                      <button onClick={() => onUserClick(user.id)} className="font-bold text-stone-100 hover:text-amber-300">{user.name}</button>{' '}
                      {notification.type === 'like' ? 'curtiu sua publicação em' : 'comentou na sua publicação em'}{' '}
                      <button onClick={() => onBookClick(book.id)} className="font-bold text-amber-300">{book.title}</button>
                    </p>
                    {'reply' in notification && <p className="mt-2 rounded-lg bg-stone-900 p-3 text-sm text-stone-400">{notification.reply.text}</p>}
                    {notification.post.text && <p className="mt-2 line-clamp-2 text-xs text-stone-600">Seu post: {notification.post.text}</p>}
                    <p className="mt-1 text-xs text-stone-600">{formatTime(notification.timestamp)}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState text="Quando alguém curtir ou comentar suas publicações, você verá aqui." />
      )}
    </section>
  )
}

function GoalsPage({ currentUser, shelf, books }: { currentUser: User; shelf: ShelfEntry[]; books: Book[] }) {
  const [goalCount, setGoalCount] = useState(40)
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('40')
  const myShelf = shelf.filter(entry => entry.userId === currentUser.id)
  const readThisYear = myShelf.filter(entry => entry.status === 'read').length
  const progress = Math.min(100, Math.round((readThisYear / goalCount) * 100))
  const remaining = Math.max(0, goalCount - readThisYear)
  const currentlyReading = myShelf
    .filter(entry => entry.status === 'reading')
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)

  return (
    <section>
      <Header title="Metas de leitura" />
      <div className="space-y-4 p-4 md:p-5">
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl text-stone-100">Meta anual</h2>
              <p className="text-sm text-stone-500">Organize sua vida de leitura como no Skoob, sem perder o lado social.</p>
            </div>
            {editing ? (
              <div className="flex gap-2">
                <input value={inputVal} onChange={e => setInputVal(e.target.value)} type="number" className="w-20 rounded-lg border border-stone-700 bg-stone-950 px-2 py-2 text-center text-sm text-stone-100 outline-none focus:border-amber-300" />
                <button onClick={() => {
                  setGoalCount(clamp(Number(inputVal), 1, 999))
                  setEditing(false)
                }} className="rounded-lg bg-amber-300 px-3 text-sm font-bold text-stone-950">
                  OK
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="text-sm font-bold text-amber-300">Editar</button>
            )}
          </div>
          <div className="mb-4 flex items-end gap-3">
            <span className="font-serif text-6xl leading-none text-amber-300">{readThisYear}</span>
            <span className="pb-2 text-sm text-stone-400">de {goalCount} livros</span>
          </div>
          <ProgressBar value={progress} />
          <div className="mt-2 flex justify-between text-xs text-stone-500">
            <span>{progress}% concluído</span>
            <span>{remaining} restantes</span>
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
                <img src={book.cover} alt={book.title} className="h-16 w-11 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
                  <p className="mb-2 text-xs text-stone-500">{book.author}</p>
                  <ProgressBar value={entry.progress} />
                </div>
                <span className="text-sm font-bold text-amber-300">{entry.progress}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CreatePostModal({ currentUser, shelf, books, onClose, onPost }: {
  currentUser: User
  shelf: ShelfEntry[]
  books: Book[]
  onClose: () => void
  onPost: (post: Post) => void
}) {
  const myBooks = shelf
    .filter(entry => entry.userId === currentUser.id && (entry.status === 'reading' || entry.status === 'rereading'))
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)
  const [selectedBookId, setSelectedBookId] = useState(myBooks[0]?.book.id || '')
  const selectedBook = books.find(book => book.id === selectedBookId) || myBooks[0]?.book
  const selectedEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === selectedBookId)
  const defaultPercent = selectedEntry?.progress || 1
  const [postType, setPostType] = useState<PostType>('comment')
  const [text, setText] = useState('')
  const [reactionEmoji, setReactionEmoji] = useState('🤯')
  const [percent, setPercent] = useState(defaultPercent)
  const [chapter, setChapter] = useState(selectedBook ? chapterFromPercent(selectedBook, defaultPercent) : 1)
  const emojis = ['😭', '🤯', '♥', '😂', '😡', '🔥', '💔', '😱', '🥹', '👏']
  const canPost = selectedBook && (postType === 'reaction' ? Boolean(reactionEmoji) : text.trim().length > 0)

  function handleBookChange(bookId: string) {
    const nextBook = books.find(book => book.id === bookId)
    const nextEntry = shelf.find(entry => entry.userId === currentUser.id && entry.bookId === bookId)
    const nextPercent = nextEntry?.progress || 1
    setSelectedBookId(bookId)
    setPercent(nextPercent)
    setChapter(nextBook ? chapterFromPercent(nextBook, nextPercent) : 1)
  }

  function handlePercentChange(value: number) {
    if (!selectedBook) return
    const next = clamp(value, 1, 100)
    setPercent(next)
    setChapter(chapterFromPercent(selectedBook, next))
  }

  function handleChapterChange(value: number) {
    if (!selectedBook) return
    const next = clamp(value, 1, selectedBook.totalChapters)
    setChapter(next)
    setPercent(percentFromChapter(selectedBook, next))
  }

  function handlePost() {
    if (!canPost || !selectedBook) return
    onPost({
      id: `p${Date.now()}`,
      userId: currentUser.id,
      bookId: selectedBook.id,
      chapter,
      percent,
      text: postType === 'reaction' ? undefined : text.trim(),
      reactionEmoji: postType === 'reaction' ? reactionEmoji : undefined,
      type: postType,
      timestamp: new Date().toISOString(),
      likes: [],
      comments: 0,
    })
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
            <p className="rounded-lg border border-stone-800 bg-stone-950 p-4 text-sm text-stone-400">Adicione um livro como "Lendo" para publicar no feed da obra.</p>
          ) : (
            <>
              <label className="block text-sm font-semibold text-stone-300">
                Livro
                <select value={selectedBookId} onChange={e => handleBookChange(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-300">
                  {myBooks.map(({ book }) => <option key={book.id} value={book.id}>{book.title}</option>)}
                </select>
              </label>

              {selectedBook && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-stone-300">
                    Porcentagem
                    <input type="number" min="1" max="100" value={percent} onChange={e => handlePercentChange(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-300" />
                  </label>
                  <label className="text-sm font-semibold text-stone-300">
                    Capítulo
                    <input type="number" min="1" max={selectedBook.totalChapters} value={chapter} onChange={e => handleChapterChange(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2.5 text-sm text-stone-100 outline-none focus:border-amber-300" />
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
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-stone-800 px-4 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-bold text-stone-400 hover:bg-stone-800">Cancelar</button>
          <button onClick={handlePost} disabled={!canPost} className="rounded-lg bg-amber-300 px-5 py-2 text-sm font-bold text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-500">
            Publicar
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
  onToggleFollow: (userId: string) => void
}) {
  const [readerQuery, setReaderQuery] = useState('')
  const currentlyReading = shelf
    .filter(entry => entry.userId === currentUser.id && entry.status === 'reading')
    .map(entry => ({ entry, book: books.find(book => book.id === entry.bookId)! }))
    .filter(item => item.book)
  const suggestions = users
    .filter(user => user.id !== currentUser.id)
    .filter(user => readerQuery ? `${user.name} ${user.handle}`.toLowerCase().includes(readerQuery.toLowerCase()) : !currentUser.following.includes(user.id))
    .slice(0, 4)

  return (
    <aside className="sticky top-4 space-y-4">
      <div className="rounded-lg border border-stone-800 bg-stone-900 p-4">
        <h2 className="mb-3 font-serif text-base text-stone-100">Buscar leitores</h2>
        <input
          value={readerQuery}
          onChange={e => setReaderQuery(e.target.value)}
          placeholder="Pesquisar @ ou nome"
          className="mb-3 w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none focus:border-amber-300"
        />
        <div className="space-y-3">
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
      <div className="rounded-lg border border-stone-800 bg-stone-900 p-4">
        <h2 className="mb-3 font-serif text-base text-stone-100">Proteção ativa</h2>
        <p className="text-sm leading-relaxed text-stone-400">
          Nos feeds de obra, o leitor escolhe capítulo ou porcentagem e só vê publicações até aquele ponto.
        </p>
      </div>
      {currentlyReading.length > 0 && (
        <div className="rounded-lg border border-stone-800 bg-stone-900 p-4">
          <h2 className="mb-3 font-serif text-base text-stone-100">Lendo agora</h2>
          <div className="space-y-3">
            {currentlyReading.map(({ entry, book }) => (
              <button key={book.id} onClick={() => onBookClick(book.id)} className="flex w-full gap-3 text-left">
                <img src={book.cover} alt={book.title} className="h-14 w-10 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-stone-100">{book.title}</p>
                  <p className="mb-1 text-xs text-stone-500">{entry.progress}% lido</p>
                  <ProgressBar value={entry.progress} />
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

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('folio_token') || '')
  const [users, setUsers] = useState<User[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [page, setPage] = useState<Page>('timeline')
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null)
  const [showPostModal, setShowPostModal] = useState(false)
  const [shelf, setShelf] = useState<ShelfEntry[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [replies, setReplies] = useState<Reply[]>([])
  const [seenNotificationIds, setSeenNotificationIds] = useState<string[]>([])
  const [loadingApp, setLoadingApp] = useState(Boolean(token))

  async function loadBootstrap(activeToken = token) {
    if (!activeToken) return
    const data = await apiRequest<{
      currentUserId: string
      users: User[]
      books: Book[]
      shelf: ShelfEntry[]
      posts: Post[]
      replies: Reply[]
      notifications?: { id: string; read: boolean }[]
    }>('/folio/bootstrap', {}, activeToken)

    setUsers(data.users)
    setBooks(data.books)
    setShelf(data.shelf)
    setPosts(data.posts)
    setReplies(data.replies)
    setCurrentUser(data.users.find(user => user.id === data.currentUserId) || data.users[0] || null)
    setSeenNotificationIds(data.notifications?.filter(item => item.read).map(item => item.id) || [])
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

  async function handleNavigate(nextPage: Page) {
    setPage(nextPage)
    if (nextPage !== 'book') setSelectedBookId(null)
    if (nextPage === 'profile') setSelectedProfileUserId(currentUser?.id || null)
    if (nextPage === 'notifications') {
      setSeenNotificationIds(prev => Array.from(new Set([...prev, ...notificationIds])))
      await apiRequest('/folio/notifications/mark-all-read', { method: 'POST' }, token)
      await loadBootstrap()
    }
  }

  async function handleUpdateShelfEntry(bookId: string, changes: Partial<ShelfEntry>) {
    if (!currentUser) return
    await apiRequest(`/folio/shelf/${encodeURIComponent(bookId)}`, { method: 'PATCH', body: JSON.stringify(changes) }, token)
    await loadBootstrap()
  }

  async function handleRemoveShelfEntry(bookId: string) {
    if (!currentUser) return
    await apiRequest(`/folio/shelf/${encodeURIComponent(bookId)}`, { method: 'DELETE' }, token)
    await loadBootstrap()
  }

  async function handleAddBook(bookId: string, status: BookStatus) {
    if (!currentUser) return
    await apiRequest('/folio/shelf', { method: 'POST', body: JSON.stringify({ bookId, status, progress: status === 'read' ? 100 : 0 }) }, token)
    await loadBootstrap()
  }

  async function handleImportBook(book: Book, status: BookStatus) {
    await apiRequest('/folio/books', { method: 'POST', body: JSON.stringify({ ...book, status, progress: status === 'read' ? 100 : 0 }) }, token)
    await loadBootstrap()
  }

  async function handleAddReply(postId: string, text: string) {
    if (!currentUser) return
    await apiRequest(`/folio/posts/${encodeURIComponent(postId)}/replies`, { method: 'POST', body: JSON.stringify({ text }) }, token)
    await loadBootstrap()
  }

  async function handleDeletePost(postId: string) {
    if (!currentUser) return
    await apiRequest(`/folio/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' }, token)
    await loadBootstrap()
  }

  async function handleDeleteReply(replyId: string) {
    if (!currentUser) return
    await apiRequest(`/folio/replies/${encodeURIComponent(replyId)}`, { method: 'DELETE' }, token)
    await loadBootstrap()
  }

  async function handleToggleLike(postId: string) {
    if (!currentUser) return
    await apiRequest(`/folio/posts/${encodeURIComponent(postId)}/likes/toggle`, { method: 'POST' }, token)
    await loadBootstrap()
  }

  async function handleToggleFollow(userId: string) {
    if (!currentUser || userId === currentUser.id) return
    await apiRequest(`/folio/follows/${userId}/toggle`, { method: 'POST' }, token)
    await loadBootstrap()
  }

  async function handleUpdateUser(changes: Partial<User>) {
    if (!currentUser) return
    await apiRequest('/folio/me', { method: 'PATCH', body: JSON.stringify(changes) }, token)
    await loadBootstrap()
  }

  async function handleSearchBooks(query: string) {
    return apiRequest<Book[]>(`/folio/books/search?q=${encodeURIComponent(query)}`, {}, token)
  }

  async function handleCreatePost(post: Post) {
    await apiRequest('/folio/posts', { method: 'POST', body: JSON.stringify(post) }, token)
    await loadBootstrap()
  }

  if (!currentUser) {
    if (loadingApp) return <div className="flex min-h-screen items-center justify-center bg-stone-950 text-sm text-stone-400">Carregando Folio...</div>
    return <LoginPage onLogin={handleLogin} />
  }

  const selectedBook = selectedBookId ? books.find(book => book.id === selectedBookId) : null
  const selectedProfileUser = users.find(user => user.id === (selectedProfileUserId || currentUser.id)) || currentUser
  const myPostIds = posts.filter(post => post.userId === currentUser.id).map(post => post.id)
  const notificationIds = [
    ...posts
      .filter(post => post.userId === currentUser.id)
      .flatMap(post => post.likes.filter(userId => userId !== currentUser.id).map(userId => `like-${post.id}-${userId}`)),
    ...replies
      .filter(reply => myPostIds.includes(reply.postId) && reply.userId !== currentUser.id)
      .map(reply => `reply-${reply.id}`),
  ]
  const notificationCount = notificationIds.filter(id => !seenNotificationIds.includes(id)).length

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <Navigation
        currentUser={currentUser}
        page={page}
        notificationCount={notificationCount}
        onNavigate={handleNavigate}
        onCreatePost={() => setShowPostModal(true)}
        onLogout={() => {
          setCurrentUser(null)
          localStorage.removeItem('folio_token')
          setToken('')
          setPage('timeline')
          setSelectedBookId(null)
          setSelectedProfileUserId(null)
        }}
      />

      <div className="mx-auto flex max-w-6xl md:pl-60">
        <main className="min-h-screen w-full border-x border-stone-800 pb-24 md:max-w-[680px] md:pb-0">
          {page === 'timeline' && <TimelinePage currentUser={currentUser} users={users} books={books} posts={posts} replies={replies} timeline={[]} onBookClick={handleBookClick} onUserClick={handleUserClick} onAddReply={handleAddReply} onToggleLike={handleToggleLike} onDeletePost={handleDeletePost} onDeleteReply={handleDeleteReply} onToggleFollow={handleToggleFollow} />}
          {page === 'shelf' && <ShelfPage currentUser={currentUser} shelf={shelf} books={books} onBookClick={handleBookClick} onUpdateShelfEntry={handleUpdateShelfEntry} onRemoveShelfEntry={handleRemoveShelfEntry} onAddBook={handleAddBook} onImportBook={handleImportBook} onSearchBooks={handleSearchBooks} />}
          {page === 'book' && selectedBook && <BookPage book={selectedBook} shelf={shelf} posts={posts} replies={replies} users={users} currentUser={currentUser} onBack={() => setPage('timeline')} onUserClick={handleUserClick} onAddReply={handleAddReply} onToggleLike={handleToggleLike} onDeletePost={handleDeletePost} onDeleteReply={handleDeleteReply} onUpdateShelfEntry={handleUpdateShelfEntry} onAddBook={handleAddBook} />}
          {page === 'profile' && <ProfilePage currentUser={currentUser} profileUser={selectedProfileUser} users={users} shelf={shelf} posts={posts} books={books} onBookClick={handleBookClick} onUpdateUser={handleUpdateUser} onUserClick={handleUserClick} onToggleFollow={handleToggleFollow} onDeletePost={handleDeletePost} />}
          {page === 'goals' && <GoalsPage currentUser={currentUser} shelf={shelf} books={books} />}
          {page === 'notifications' && <NotificationsPage currentUser={currentUser} users={users} posts={posts} replies={replies} books={books} onBookClick={handleBookClick} onUserClick={handleUserClick} />}
        </main>

        <div className="hidden w-80 shrink-0 p-4 lg:block">
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
        />
      )}
    </div>
  )
}
