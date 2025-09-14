import { NextRequest, NextResponse } from 'next/server';
import { systemConfig, SYSTEM_CONFIGS, CONFIG_CATEGORIES, SystemConfigManager } from '@/lib/system-config';
import { isAuthenticated } from '@/lib/simple-auth';

// 获取系统配置
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const key = searchParams.get('key');

    // 验证身份
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    // 获取单个配置
    if (key) {
      const value = await systemConfig.get(key);
      const definition = systemConfig.getConfigDefinition(key);
      
      return NextResponse.json({
        key,
        value,
        definition
      });
    }

    // 获取所有配置或按分类获取
    let configs = SYSTEM_CONFIGS;
    if (category) {
      configs = systemConfig.getConfigsByCategory(category);
    }

    // 获取配置值
    const configsWithValues = await Promise.all(
      configs.map(async (config) => {
        const value = await systemConfig.get(config.key, config.defaultValue);
        
        return {
          ...config,
          value: config.sensitive ? (value ? '***已设置***' : '') : value
        };
      })
    );

    return NextResponse.json({
      categories: CONFIG_CATEGORIES,
      configs: configsWithValues,
      category: category || null
    });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    return NextResponse.json(
      { error: '获取配置失败' },
      { status: 500 }
    );
  }
}

// 更新系统配置
export async function POST(request: NextRequest) {
  try {
    // 验证身份
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { configs } = body;

    if (!configs || !Array.isArray(configs)) {
      return NextResponse.json(
        { error: '无效的请求数据' },
        { status: 400 }
      );
    }

    // 验证和更新配置
    const updates = [];
    const errors = [];

    for (const { key, value } of configs) {
      try {
        const definition = systemConfig.getConfigDefinition(key);
        
        if (!definition) {
          errors.push(`未知的配置项: ${key}`);
          continue;
        }

        // 验证必填项
        if (definition.required && (!value || value.trim() === '')) {
          errors.push(`${definition.label}为必填项`);
          continue;
        }

        // 类型验证
        if (value && value.trim() !== '') {
          switch (definition.type) {
            case 'number':
              if (isNaN(Number(value))) {
                errors.push(`${definition.label}必须为数字`);
                continue;
              }
              break;
            case 'boolean':
              if (!['true', 'false'].includes(value)) {
                errors.push(`${definition.label}必须为布尔值`);
                continue;
              }
              break;
            case 'url':
              try {
                new URL(value);
              } catch {
                errors.push(`${definition.label}必须为有效的URL`);
                continue;
              }
              break;
            case 'json':
              try {
                JSON.parse(value);
              } catch {
                errors.push(`${definition.label}必须为有效的JSON格式`);
                continue;
              }
              break;
          }
        }

        // 自定义验证
        if (definition.validation && value && !definition.validation(value)) {
          errors.push(`${definition.label}格式不正确`);
          continue;
        }

        updates.push({ key, value: value || '', description: definition.description });
      } catch (error) {
        errors.push(`处理配置 ${key} 时发生错误: ${error}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: '配置验证失败', details: errors },
        { status: 400 }
      );
    }

    // 执行更新
    for (const { key, value, description } of updates) {
      await systemConfig.set(key, value, description);
    }

    // 清理缓存
    systemConfig.clearCache();

    return NextResponse.json({
      success: true,
      message: `成功更新 ${updates.length} 个配置项`
    });

  } catch (error) {
    console.error('更新系统配置失败:', error);
    return NextResponse.json(
      { error: '更新配置失败' },
      { status: 500 }
    );
  }
}

// 重置配置为默认值
export async function PUT(request: NextRequest) {
  try {
    // 验证身份
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { keys } = body;

    if (!keys || !Array.isArray(keys)) {
      return NextResponse.json(
        { error: '无效的请求数据' },
        { status: 400 }
      );
    }

    let resetCount = 0;
    for (const key of keys) {
      const definition = systemConfig.getConfigDefinition(key);
      if (definition && definition.defaultValue !== undefined) {
        await systemConfig.set(key, definition.defaultValue, definition.description);
        resetCount++;
      }
    }

    // 清理缓存
    systemConfig.clearCache();

    return NextResponse.json({
      success: true,
      message: `成功重置 ${resetCount} 个配置项为默认值`
    });

  } catch (error) {
    console.error('重置配置失败:', error);
    return NextResponse.json(
      { error: '重置配置失败' },
      { status: 500 }
    );
  }
}

// 初始化默认配置
export async function PATCH(request: NextRequest) {
  try {
    // 验证身份
    if (!isAuthenticated(request)) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    await systemConfig.initializeDefaults();
    systemConfig.clearCache();

    return NextResponse.json({
      success: true,
      message: '默认配置初始化完成'
    });

  } catch (error) {
    console.error('初始化默认配置失败:', error);
    return NextResponse.json(
      { error: '初始化失败' },
      { status: 500 }
    );
  }
}