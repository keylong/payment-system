import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

// 获取数据库连接URL
const getDatabaseUrl = () => {
  const url = process.env.DATABASE_URL;
  
  if (!url) {
    throw new Error('DATABASE_URL环境变量未设置');
  }
  
  return url;
};

// 创建SQL查询客户端
const sql = neon(getDatabaseUrl());

// 创建Drizzle ORM实例
export const db = drizzle(sql);

// 测试数据库连接
export async function testDatabaseConnection() {
  try {
    const result = await sql`SELECT version()`;
    console.log('✅ 数据库连接成功:', result[0]?.version?.substring(0, 50) + '...');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    throw error;
  }
}