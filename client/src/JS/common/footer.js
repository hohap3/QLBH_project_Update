// src/JS/common/footer.js
import "../../styles/footer.css";

export async function loadFooter() {
    const footerContainer = document.getElementById('footer-shared');
    if (!footerContainer) return;

    try {
        // Import dạng ?raw để Vite nhúng HTML vào bundle (fetch "/src/..." không tồn tại trên Vercel)
        const { default: footerHtml } = await import('../../pages/common/footer.html?raw');
        footerContainer.innerHTML = footerHtml;
    } catch (error) {
        console.error('Lỗi khi tải component Footer kèm CSS:', error);
    }
}