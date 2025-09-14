import { NextRequest, NextResponse } from 'next/server'

// 认证配置
const AUTH_CONFIG = {
  SESSION_KEY: 'payment_admin_session',
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24小时
}

// 公开路由（不需要认证）
const PUBLIC_ROUTES = [
  '/demo',
  '/login',
  '/webhook',
  '/callback',
  '/favicon.ico',
  '/_next',
  '/static',
]

// API路由（部分需要认证）
const PROTECTED_API_ROUTES = [
  '/api/admin',
  '/api/management',
]

// 检查是否为公开路由
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => {
    if (route === '/') return pathname === '/'
    return pathname.startsWith(route)
  })
}

// 检查是否为受保护的API路由
function isProtectedApiRoute(pathname: string): boolean {
  return PROTECTED_API_ROUTES.some(route => pathname.startsWith(route))
}

// 验证session
function validateSession(sessionData: string | undefined): boolean {
  if (!sessionData) return false

  try {
    const session = JSON.parse(sessionData)
    const now = Date.now()
    
    // 检查session是否过期
    if (session.expiresAt && now > session.expiresAt) {
      return false
    }

    return session.isAuthenticated === true
  } catch (error) {
    console.error('Session验证失败:', error)
    return false
  }
}

// 获取认证状态（从cookie或localStorage信息）
function getAuthStatus(request: NextRequest): boolean {
  // 优先检查cookie
  const sessionCookie = request.cookies.get(AUTH_CONFIG.SESSION_KEY)
  if (sessionCookie && validateSession(sessionCookie.value)) {
    return true
  }

  // 检查请求头中的认证信息（用于客户端路由）
  const authHeader = request.headers.get('x-auth-session')
  if (authHeader && validateSession(authHeader)) {
    return true
  }

  return false
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 静态资源直接放行
  if (pathname.startsWith('/_next') || 
      pathname.startsWith('/static') || 
      pathname.includes('.')) {
    return NextResponse.next()
  }

  // 公开路由直接放行
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // 检查认证状态
  const isAuthenticated = getAuthStatus(request)

  // API路由处理
  if (pathname.startsWith('/api/')) {
    // 受保护的API路由需要认证
    if (isProtectedApiRoute(pathname) && !isAuthenticated) {
      return NextResponse.json(
        { error: '未授权访问', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }
    
    // 其他API路由放行（如webhook等）
    return NextResponse.next()
  }

  // 主要页面路由处理
  if (!isAuthenticated) {
    // 未认证用户重定向到登录页
    const loginUrl = new URL('/login', request.url)
    
    // 保存原始访问路径（登录后跳转回去）
    if (pathname !== '/') {
      loginUrl.searchParams.set('from', pathname)
    }
    
    return NextResponse.redirect(loginUrl)
  }

  // 已认证用户访问登录页，重定向到首页
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 认证通过，继续请求
  return NextResponse.next()
}

// 配置matcher - 指定中间件运行的路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - api/webhook (webhook路由)
     * - _next/static (静态文件)
     * - _next/image (图片优化)
     * - favicon.ico (网站图标)
     * - public文件夹中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}