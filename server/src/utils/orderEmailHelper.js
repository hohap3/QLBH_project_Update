const { pool } = require("../config/database");
const mailer = require("../config/mailer");

function formatVnd(amount) {
  return `${Math.round(Number(amount) || 0).toLocaleString("vi-VN")}đ`;
}

function formatVietnamTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return new Date(date).toLocaleString("vi-VN");
  }
}

function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchOrderEmailContext(maDonHang) {
  const orderRes = await pool.query(
    `
    SELECT
      dh.madonhang,
      dh.ngaydat,
      dh.trangthai,
      dh.tongtien,
      dh.ghichu,
      COALESCE(nd.email, kh.email) AS email,
      COALESCE(nd.hoten, kh.hoten, pgh.nguoinhan, 'Quý khách') AS hoten,
      pgh.nguoinhan,
      pgh.sdtnguoinhan,
      pgh.diachi,
      tt.phuongthuc
    FROM donhang dh
    LEFT JOIN nguoidung nd ON dh.manguoidung = nd.mand
    LEFT JOIN khachhang kh ON dh.makh = kh.makh
    LEFT JOIN phieugiaohang pgh ON dh.madonhang = pgh.madonhang
    LEFT JOIN thanhtoan tt ON dh.madonhang = tt.madonhang
    WHERE dh.madonhang = $1
    LIMIT 1
    `,
    [String(maDonHang).trim()],
  );

  if (orderRes.rows.length === 0) return null;
  const order = orderRes.rows[0];
  const targetEmail = (order.email || "").trim();
  if (!targetEmail) return null;

  const itemsRes = await pool.query(
    `
    SELECT ct.masp, ct.soluong, ct.giaban, ct.giamgia, sp.tensp
    FROM chitiet_donhang ct
    LEFT JOIN sanpham sp ON ct.masp = sp.masp
    WHERE ct.madonhang = $1
    `,
    [String(maDonHang).trim()],
  );

  return {
    ...order,
    email: targetEmail,
    items: itemsRes.rows || [],
  };
}

function buildItemsTableHtml(items = []) {
  if (!items || items.length === 0) return "";
  const rows = items
    .map((it) => {
      const name = escHtml(it.tensp || it.masp);
      const qty = Number(it.soluong) || 0;
      const lineTotal = Math.max(
        0,
        (Number(it.giaban) || 0) * qty - (Number(it.giamgia) || 0),
      );
      return `
        <tr>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">${name}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; color: #334155;">${qty}</td>
          <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 13px; font-weight: 600; color: #0f172a;">${formatVnd(lineTotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 9px 10px; text-align: left; font-size: 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Sản phẩm</th>
          <th style="padding: 9px 10px; text-align: center; font-size: 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">SL</th>
          <th style="padding: 9px 10px; text-align: right; font-size: 12px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Thành tiền</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// 1. Gửi Email xác nhận ngay khi Đặt hàng thành công
async function sendOrderCreatedEmail(maDonHang) {
  try {
    const ctx = await fetchOrderEmailContext(maDonHang);
    if (!ctx) return;

    const paymentLabel =
      String(ctx.phuongthuc || "COD").toUpperCase() === "COD"
        ? "Thanh toán khi nhận hàng (COD)"
        : "Chuyển khoản ngân hàng (VietQR)";

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #d70018 0%, #991b1b 100%); color: #ffffff; padding: 20px 24px;">
          <h2 style="margin: 0; font-size: 20px;">HP STORE — Xác nhận đặt hàng thành công</h2>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Mã đơn hàng: <strong>#${escHtml(ctx.madonhang)}</strong></p>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p style="margin-top: 0;">Xin chào <strong>${escHtml(ctx.hoten)}</strong>,</p>
          <p>Cảm ơn bạn đã đặt hàng tại <strong>HP STORE</strong>! Đơn hàng <strong>#${escHtml(ctx.madonhang)}</strong> của bạn đã được hệ thống ghi nhận vào lúc ${formatVietnamTime(ctx.ngaydat || new Date())}.</p>

          ${buildItemsTableHtml(ctx.items)}

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; font-size: 13.5px; margin-bottom: 16px;">
            <div style="margin-bottom: 6px;"><strong>Tổng thanh toán:</strong> <span style="color: #d70018; font-size: 16px; font-weight: 800;">${formatVnd(ctx.tongtien)}</span></div>
            <div style="margin-bottom: 4px;"><strong>Phương thức:</strong> ${paymentLabel}</div>
            <div style="margin-bottom: 4px;"><strong>Người nhận:</strong> ${escHtml(ctx.nguoinhan || ctx.hoten)} — ${escHtml(ctx.sdtnguoinhan || "---")}</div>
            <div><strong>Địa chỉ giao hàng:</strong> ${escHtml(ctx.diachi || "---")}</div>
          </div>

          <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
            Chúng tôi sẽ sớm xác nhận và thông báo cho bạn khi đơn hàng bắt đầu được giao.
          </p>
        </div>
        <div style="background: #f8fafc; padding: 14px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          HP STORE — Hệ thống bán lẻ công nghệ chính hãng • Hotline: 1800.6868
        </div>
      </div>
    `;

    await mailer.sendMail({
      to: ctx.email,
      subject: `[HP STORE] Xác nhận đơn hàng #${ctx.madonhang}`,
      html,
    });
  } catch (err) {
    console.error("ORDER CREATED EMAIL ERROR:", err.message);
  }
}

// 2. Gửi Email thông báo ở 3 mốc trạng thái quan trọng: Đang giao / Thành công / Đã hủy
async function sendOrderStatusEmail(maDonHang, overrideStatus = null) {
  try {
    const ctx = await fetchOrderEmailContext(maDonHang);
    if (!ctx) return;

    const status = String(overrideStatus || ctx.trangthai || "").trim();
    let subject = "";
    let headerBg = "";
    let heading = "";
    let bodyMessage = "";

    if (status === "Đang giao") {
      subject = `[HP STORE] Đơn hàng #${ctx.madonhang} đang được giao đến bạn`;
      headerBg = "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)";
      heading = "Đơn hàng của bạn đang trên đường giao!";
      bodyMessage = `
        <p>Đơn hàng <strong>#${escHtml(ctx.madonhang)}</strong> đã được đóng gói cẩn thận và bàn giao cho đơn vị vận chuyển.</p>
        <p>Vui lòng chú ý điện thoại <strong>${escHtml(ctx.sdtnguoinhan || "")}</strong> để nhận hàng trong thời gian sớm nhất nhé!</p>
      `;
    } else if (status === "Thành công") {
      subject = `[HP STORE] Giao hàng thành công đơn #${ctx.madonhang} — Cảm ơn bạn!`;
      headerBg = "linear-gradient(135deg, #16a34a 0%, #15803d 100%)";
      heading = "Đơn hàng đã hoàn tất thành công!";
      bodyMessage = `
        <p>Cảm ơn bạn đã tin tưởng và mua sắm tại <strong>HP STORE</strong>! Đơn hàng <strong>#${escHtml(ctx.madonhang)}</strong> đã được giao thành công.</p>
        <p>Điểm tích lũy thành viên <strong>HP Member</strong> đã được cập nhật vào tài khoản của bạn. Hãy quay lại website để chia sẻ đánh giá sản phẩm nhé!</p>
      `;
    } else if (status === "Đã hủy") {
      subject = `[HP STORE] Thông báo hủy đơn hàng #${ctx.madonhang}`;
      headerBg = "linear-gradient(135deg, #475569 0%, #1e293b 100%)";
      heading = "Thông báo hủy đơn hàng";
      bodyMessage = `
        <p>Đơn hàng <strong>#${escHtml(ctx.madonhang)}</strong> (tổng giá trị <strong>${formatVnd(ctx.tongtien)}</strong>) đã được chuyển sang trạng thái <strong>Đã hủy</strong>.</p>
        <p>Nếu bạn đã thanh toán chuyển khoản hoặc cần hỗ trợ đặt lại đơn hàng, vui lòng liên hệ Hotline <strong>1800.6868</strong> (Miễn phí) để được hỗ trợ ngay.</p>
      `;
    } else {
      // Bỏ qua các trạng thái trung gian (Đang xử lý, Đã giao...) để không spam hộp thư khách
      return;
    }

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: ${headerBg}; color: #ffffff; padding: 20px 24px;">
          <h2 style="margin: 0; font-size: 20px;">HP STORE — ${heading}</h2>
          <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Mã đơn hàng: <strong>#${escHtml(ctx.madonhang)}</strong> • Cập nhật lúc ${formatVietnamTime(new Date())}</p>
        </div>
        <div style="padding: 24px; color: #1e293b; line-height: 1.6;">
          <p style="margin-top: 0;">Xin chào <strong>${escHtml(ctx.hoten)}</strong>,</p>
          ${bodyMessage}
          ${buildItemsTableHtml(ctx.items)}
          <div style="font-size: 13.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
            <strong>Tổng giá trị đơn hàng:</strong> <span style="color: #d70018; font-weight: 800;">${formatVnd(ctx.tongtien)}</span><br/>
            <strong>Địa chỉ nhận hàng:</strong> ${escHtml(ctx.diachi || "---")}
          </div>
        </div>
        <div style="background: #f8fafc; padding: 14px 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
          Email tự động từ hệ thống HP STORE • Hotline hỗ trợ: 1800.6868
        </div>
      </div>
    `;

    await mailer.sendMail({
      to: ctx.email,
      subject,
      html,
    });
  } catch (err) {
    console.error("ORDER STATUS EMAIL ERROR:", err.message);
  }
}

module.exports = {
  sendOrderCreatedEmail,
  sendOrderStatusEmail,
};
