import { NextRequest, NextResponse } from 'next/server'

const AUTH_CONFIG = {
  SESSION_KEY: 'payment_admin_session',
}

// 验证session
function validateSession(sessionData: string | undefined): { valid: boolean; session?: Record<string, unknown> } {
  if (!sessionData) return { valid: false }

  try {
    const session = JSON.parse(sessionData)
    const now = Date.now()
    
    // 检查session是否过期
    if (session.expiresAt && now > session.expiresAt) {
      return { valid: false }
    }

    if (session.isAuthenticated === true) {
      return { valid: true, session }
    }

    return { valid: false }
  } catch (error) {
    console.error('Session验证失败:', error)
    return { valid: false }
  }
}

export async function GET(request: NextRequest) {
  try {
    // 从cookie获取session
    const sessionCookie = request.cookies.get(AUTH_CONFIG.SESSION_KEY)
    const { valid, session } = validateSession(sessionCookie?.value)

    if (valid && session) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        user: {
          username: session.username,
          loginTime: session.loginTime,
          expiresAt: session.expiresAt
        }
      })
    } else {
      return NextResponse.json({
        success: true,
        authenticated: false,
        message: '未登录或session已过期'
      })
    }

  } catch (error) {
    console.error('验证API错误:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}

// OPTIONS 请求处理（CORS预检）
export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 })
}