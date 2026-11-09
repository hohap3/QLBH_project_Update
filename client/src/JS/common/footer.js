// src/JS/footer.js

export async function loadFooter() {
    const footerContainer = document.getElementById('footer-shared');
    if (!footerContainer) return;

    try {
        // 🟢 1. Tự động kiểm tra và tiêm file CSS của Footer vào <head> nếu chưa có
        if (!document.getElementById('footer-css-pack')) {
            const cssLink = document.createElement('link');
            cssLink.id = 'footer-css-pack';
            cssLink.rel = 'stylesheet';
            cssLink.href = '/src/css/footer.css'; // Đường dẫn đến file CSS riêng của bạn
            document.head.appendChild(cssLink);
        }

        // 🔵 2. Gọi file HTML tĩnh của footer về trang
        // Import dạng ?raw để Vite nhúng HTML vào bundle (fetch "/src/..." không tồn tại trên Vercel)
        const { default: footerHtml } = await import('../../pages/common/footer.html?raw');
        footerContainer.innerHTML = footerHtml;
    } catch (error) {
        console.error('Lỗi khi tải component Footer kèm CSS:', error);
    }
}