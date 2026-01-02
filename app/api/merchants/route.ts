import { NextRequest, NextResponse } from 'next/server';
import {
  getAllMerchants,
  getActiveMerchants,
  getMerchantById,
  getMerchantByCode,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  ensureDefaultMerchant
} from '@/lib/db-operations';

// 获取商户列表
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const code = searchParams.get('code');
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // 确保默认商户存在
    await ensureDefaultMerchant();

    // 根据ID查询单个商户
    if (id) {
      const merchant = await getMerchantById(id);
      if (!merchant) {
        return NextResponse.json(
          { error: '商户不存在' },
          { status: 404 }
        );
      }
      return NextResponse.json(merchant);
    }

    // 根据代码查询单个商户
    if (code) {
      const merchant = await getMerchantByCode(code);
      if (!merchant) {
        return NextResponse.json(
          { error: '商户不存在' },
          { status: 404 }
        );
      }
      return NextResponse.json(merchant);
    }

    // 获取商户列表
    const merchants = activeOnly
      ? await getActiveMerchants()
      : await getAllMerchants();

    return NextResponse.json({
      merchants,
      total: merchants.length
    });

  } catch (error) {
    console.error('获取商户列表错误:', error);
    return NextResponse.json(
      { error: '获取商户列表失败' },
      { status: 500 }
    );
  }
}

// 创建新商户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, name, callbackUrl, apiKey, description, webhookSecret, allowedIps, callbackRetryTimes, callbackTimeout } = body;

    // 验证必填参数
    if (!code || !name) {
      return NextResponse.json(
        { error: '商户代码和名称为必填项' },
        { status: 400 }
      );
    }

    // 检查商户代码是否已存在
    const existingMerchant = await getMerchantByCode(code);
    if (existingMerchant) {
      return NextResponse.json(
        { error: '商户代码已存在' },
        { status: 400 }
      );
    }

    // 创建商户
    const merchant = await createMerchant({
      code,
      name,
      callbackUrl,
      apiKey,
      description,
      webhookSecret,
      allowedIps,
      callbackRetryTimes,
      callbackTimeout
    });

    console.log('创建商户:', merchant);

    return NextResponse.json({
      success: true,
      merchant,
      message: '商户创建成功'
    });

  } catch (error) {
    console.error('创建商户错误:', error);
    return NextResponse.json(
      { error: '创建商户失败' },
      { status: 500 }
    );
  }
}

// 更新商户信息
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: '缺少商户ID' },
        { status: 400 }
      );
    }

    // 检查商户是否存在
    const existingMerchant = await getMerchantById(id);
    if (!existingMerchant) {
      return NextResponse.json(
        { error: '商户不存在' },
        { status: 404 }
      );
    }

    // 如果更新了code，检查是否与其他商户冲突
    if (updateData.code && updateData.code !== existingMerchant.code) {
      const conflictMerchant = await getMerchantByCode(updateData.code);
      if (conflictMerchant && conflictMerchant.id !== id) {
        return NextResponse.json(
          { error: '商户代码已被使用' },
          { status: 400 }
        );
      }
    }

    await updateMerchant(id, updateData);

    const updatedMerchant = await getMerchantById(id);

    return NextResponse.json({
      success: true,
      merchant: updatedMerchant,
      message: '商户更新成功'
    });

  } catch (error) {
    console.error('更新商户错误:', error);
    return NextResponse.json(
      { error: '更新商户失败' },
      { status: 500 }
    );
  }
}

// 删除商户
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '缺少商户ID' },
        { status: 400 }
      );
    }

    // 不允许删除默认商户
    if (id === 'default') {
      return NextResponse.json(
        { error: '不能删除默认商户' },
        { status: 400 }
      );
    }

    // 检查商户是否存在
    const existingMerchant = await getMerchantById(id);
    if (!existingMerchant) {
      return NextResponse.json(
        { error: '商户不存在' },
        { status: 404 }
      );
    }

    await deleteMerchant(id);

    return NextResponse.json({
      success: true,
      message: '商户删除成功'
    });

  } catch (error) {
    console.error('删除商户错误:', error);
    return NextResponse.json(
      { error: '删除商户失败' },
      { status: 500 }
    );
  }
}
