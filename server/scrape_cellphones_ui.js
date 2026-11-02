// server/scrape_cellphones_ui.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function inspectCellphoneS() {
  console.log("🌐 Đang khởi động Playwright (channel: msedge) để kiểm tra giao diện https://cellphones.com.vn/ ...");
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  try {
    console.log("🚀 Đang truy cập https://cellphones.com.vn/ ...");
    await page.goto('https://cellphones.com.vn/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Đợi tải các component động

    // Tạo thư mục artifacts nếu cần
    const artifactDir = path.resolve(__dirname, '../client/public/cellphones_reference');
    if (!fs.existsSync(artifactDir)) {
      fs.mkdirSync(artifactDir, { recursive: true });
    }

    const screenshotPath = path.join(artifactDir, 'cellphones_home.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`📸 Đã chụp ảnh màn hình tại: ${screenshotPath}`);

    // Phân tích các thông số UI thực tế của CellphoneS
    const uiData = await page.evaluate(() => {
      const headerEl = document.querySelector('header') || document.querySelector('.header');
      const headerBg = headerEl ? window.getComputedStyle(headerEl).backgroundColor : 'N/A';

      // Trích xuất danh mục
      const menuItems = Array.from(document.querySelectorAll('.menu-tree__item, .menu-item, nav a')).slice(0, 12).map(el => el.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean);

      // Trích xuất cấu trúc thẻ sản phẩm mẫu
      const sampleCard = document.querySelector('.product-item, .product-card, [class*="product"]');
      let cardStyles = {};
      if (sampleCard) {
        const computed = window.getComputedStyle(sampleCard);
        cardStyles = {
          borderRadius: computed.borderRadius,
          boxShadow: computed.boxShadow,
          border: computed.border,
          padding: computed.padding,
        };
      }

      return {
        title: document.title,
        headerBg,
        menuItems: menuItems.slice(0, 10),
        cardStyles,
      };
    });

    console.log("📊 KẾT QUẢ PHÂN TÍCH UI CELLPHONES:", JSON.stringify(uiData, null, 2));

  } catch (err) {
    console.error("❌ Lỗi khi tải CellphoneS:", err.message);
  } finally {
    await browser.close();
    console.log("🏁 Đã đóng trình duyệt.");
  }
}

inspectCellphoneS();
