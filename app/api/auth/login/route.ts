import { NextRequest, NextResponse } from 'next/server'
import { getConfig } from '@/lib/system-config'

// 认证配置
const AUTH_CONFIG = {
  SESSION_KEY: 'payment_admin_session',
  SESSION_DURATION: 24 * 60 * 60 * 1000, // 24小时
  ADMIN_USERNAME: 'admin',
}

// 获取管理员密码（从数据库配置）
async function getAdminPassword(): Promise<string> {
  return await getConfig('system.admin_password') || 'admin123'
}

// 验证密码
async function validateCredentials(username: string, password: string): Promise<boolean> {
  const adminPassword = await getAdminPassword()
  return username === AUTH_CONFIG.ADMIN_USERNAME && password === adminPassword
}

// 创建session数据
function createSession() {
  return {
    isAuthenticated: true,
    username: AUTH_CONFIG.ADMIN_USERNAME,
    loginTime: Date.now(),
    expiresAt: Date.now() + AUTH_CONFIG.SESSION_DURATION
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    // 验证请求参数
    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: '用户名和密码不能为空' },
        { status: 400 }
      )
    }

    // 验证凭据
    if (!(await validateCredentials(username, password))) {
      return NextResponse.json(
        { success: false, message: '用户名或密码错误' },
        { status: 401 }
      )
    }

    // 创建session
    const session = createSession()
    const sessionData = JSON.stringify(session)

    // 创建响应，设置cookie
    const response = NextResponse.json({
      success: true,
      message: '登录成功',
      user: {
        username: AUTH_CONFIG.ADMIN_USERNAME,
        loginTime: session.loginTime
      }
    })

    // 设置HttpOnly cookie以增强安全性
    response.cookies.set({
      name: AUTH_CONFIG.SESSION_KEY,
      value: sessionData,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: AUTH_CONFIG.SESSION_DURATION / 1000, // 转换为秒
    })

    return response

  } catch (error) {
    console.error('登录API错误:', error)
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