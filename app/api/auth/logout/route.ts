import { NextResponse } from 'next/server'

const AUTH_CONFIG = {
  SESSION_KEY: 'payment_admin_session',
}

export async function POST() {
  try {
    // 创建响应
    const response = NextResponse.json({
      success: true,
      message: '已成功登出'
    })

    // 删除认证cookie
    response.cookies.set({
      name: AUTH_CONFIG.SESSION_KEY,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 0, // 立即过期
    })

    return response

  } catch (error) {
    console.error('登出API错误:', error)
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