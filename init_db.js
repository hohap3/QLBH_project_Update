const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './server/.env' });

async function initDB() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Kết nối tới Neon.tech thành công!');

    const sqlPath = path.join(__dirname, 'QLBH_FullSchema_Vietnamese_v2.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('⏳ Đang khởi tạo Full Schema Phase 4...');
    await client.query(sql);

    console.log('✅ Chạy kịch bản Database thành công! Các bảng đã được tạo sẵn sàng.');
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    await client.end();
  }
}

initDB();
