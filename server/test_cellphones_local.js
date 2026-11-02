// server/test_cellphones_local.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function verifyLocalStorefront() {
  console.log("🚀 Đang khởi động Playwright (channel: msedge) để kiểm tra giao diện mới...");
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  try {
    console.log("🌐 Đang truy cập http://localhost:5173/ ...");
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Đợi tải API sản phẩm

    const outputDir = path.resolve(__dirname, '../client/public/cellphones_reference');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const screenshotPath = path.join(outputDir, 'cellphones_redesigned_local.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Đã chụp ảnh màn hình giao diện mới tại: ${screenshotPath}`);

    // Kiểm tra các thành phần UI chủ chốt
    const pageCheck = await page.evaluate(() => {
      const header = document.querySelector('.cp-main-header');
      const headerBg = header ? window.getComputedStyle(header).backgroundColor : null;
      const logo = document.querySelector('.cp-brand-logo')?.textContent.trim();
      const sidebarLinks = document.querySelectorAll('.cp-cat-link').length;
      const productCards = document.querySelectorAll('.cp-product-card').length;
      const flashSaleTitle = document.querySelector('.cp-flashsale-title')?.textContent.trim();

      return {
        title: document.title,
        headerBg,
        logo,
        sidebarLinksCount: sidebarLinks,
        productCardsCount: productCards,
        flashSaleTitle
      };
    });

    console.log("✅ KẾT QUẢ KIỂM THỬ PLAYWRIGHT:", JSON.stringify(pageCheck, null, 2));

  } catch (err) {
    console.error("❌ Lỗi kiểm tra storefront:", err.message);
  } finally {
    await browser.close();
    console.log("🏁 Hoàn tất kiểm thử Playwright.");
  }
}

verifyLocalStorefront();
