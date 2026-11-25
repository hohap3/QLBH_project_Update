// src/models/checkoutModel.js
const { pool } = require("../config/database");
const crypto = require("crypto");

// Bảng quy đổi điểm thưởng chuẩn phía Server (chống sửa giá/giảm giá từ Client)
const POINT_DISCOUNT_TIERS = {
  0: 0,
  75: 5,
  150: 10,
  225: 15,
};

const VALID_WAREHOUSES = ["KHO_TONG", "KHO_CN1", "KHO_CN2"];

function createBusinessError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

class CheckoutModel {
  /**
   * Xử lý giao dịch Đặt hàng & Trừ tồn kho Đa chi nhánh
   * Đảm bảo an toàn Concurrency bằng Transaction & SELECT ... FOR UPDATE
   * Tính lại giá bán, giảm giá điểm thưởng và phí vận chuyển 100% ở Server
   */
  static async saveCheckoutTransaction(checkoutData) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Gộp các sản phẩm trùng mã (nếu có) và validate số lượng > 0
      const mergedMap = new Map();
      for (const item of checkoutData.ChiTiet) {
        const maSP = String(item.MaSP || item.masp || "").trim();
        const soLuong = parseInt(item.SoLuong || item.soluong, 10) || 0;
        if (!maSP) {
          throw createBusinessError("Có sản phẩm bị thiếu mã sản phẩm!");
        }
        if (soLuong <= 0) {
          throw createBusinessError(
            `Số lượng đặt cho sản phẩm '${maSP}' phải lớn hơn 0!`,
          );
        }
        mergedMap.set(maSP, (mergedMap.get(maSP) || 0) + soLuong);
      }

      const normalizedItems = [];
      let rawTotal = 0;

      // 2. Truy vấn GIÁ BÁN THẬT từ bảng sanpham (không tin GiaBan từ Client)
      for (const [maSP, soLuong] of mergedMap.entries()) {
        const spRes = await client.query(
          "SELECT masp, tensp, giaban FROM sanpham WHERE masp = $1",
          [maSP],
        );
        if (spRes.rows.length === 0) {
          throw createBusinessError(
            `Sản phẩm '${maSP}' không còn tồn tại trong hệ thống!`,
          );
        }
        const realGiaBan = parseFloat(spRes.rows[0].giaban) || 0;
        rawTotal += realGiaBan * soLuong;
        normalizedItems.push({
          maSP,
          tenSP: spRes.rows[0].tensp,
          soLuong,
          giaBan: realGiaBan,
        });
      }

      // 3. Xác định kho hàng thao tác (Ưu tiên kho khách chọn, fallback sang kho khác nếu đủ hàng)
      const requestedKho = VALID_WAREHOUSES.includes(checkoutData.MaKho)
        ? checkoutData.MaKho
        : "KHO_TONG";
      const candidateWarehouses = [
        requestedKho,
        "KHO_TONG",
        "KHO_CN1",
        "KHO_CN2",
      ].filter((v, i, a) => a.indexOf(v) === i);

      let makho = requestedKho;
      for (const candidateKho of candidateWarehouses) {
        let isEligible = true;
        for (const item of normalizedItems) {
          const checkRes = await client.query(
            `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2`,
            [item.maSP, candidateKho],
          );
          const avail =
            checkRes.rows.length > 0
              ? parseFloat(checkRes.rows[0].soluongton)
              : 0;
          if (avail < item.soLuong) {
            isEligible = false;
            break;
          }
        }
        if (isEligible) {
          makho = candidateKho;
          break;
        }
      }

      // Đồng bộ MaChiNhanh theo đúng makho thực tế được chọn
      const machinhanh =
        makho === "KHO_CN1"
          ? "CN_1"
          : makho === "KHO_CN2"
            ? "CN_2"
            : "CN_CHINH";

      // 4. Tìm MaKH & Xác thực + Khấu trừ Điểm tích lũy (chống giả mạo TongGiamGia)
      let maKhachHang = null;
      const pointsToDeduct = parseInt(checkoutData.PointsToDeduct, 10) || 0;

      if (!(pointsToDeduct in POINT_DISCOUNT_TIERS)) {
        throw createBusinessError(
          `Mốc điểm đổi thưởng (${pointsToDeduct} điểm) không hợp lệ!`,
        );
      }

      let discountPercent = 0;

      if (checkoutData.MaNguoiDung) {
        const customerResult = await client.query(
          `SELECT makh, diemtichluy FROM khachhang WHERE mand = $1 FOR UPDATE`,
          [checkoutData.MaNguoiDung],
        );

        if (customerResult.rows && customerResult.rows.length > 0) {
          maKhachHang = customerResult.rows[0].makh;

          if (pointsToDeduct > 0) {
            const currentPoints =
              parseInt(customerResult.rows[0].diemtichluy, 10) || 0;
            if (currentPoints < pointsToDeduct) {
              throw createBusinessError(
                `Điểm tích lũy khả dụng (${currentPoints}) không đủ để đổi mốc ${pointsToDeduct} điểm!`,
              );
            }
            await client.query(
              `UPDATE khachhang SET diemtichluy = diemtichluy - $1 WHERE makh = $2`,
              [pointsToDeduct, maKhachHang],
            );
            discountPercent = POINT_DISCOUNT_TIERS[pointsToDeduct];
          }
        } else if (pointsToDeduct > 0) {
          throw createBusinessError(
            "Tài khoản hiện tại không có hồ sơ điểm tích lũy để áp dụng giảm giá!",
          );
        }
      }

      // 5. Tính tổng tiền chuẩn phía Server (bao gồm Phí vận chuyển)
      const discount = Math.round(rawTotal * (discountPercent / 100));
      const shipFee = Math.max(
        0,
        Math.min(200000, Math.round(parseFloat(checkoutData.PhiVanChuyen) || 0)),
      );
      const tongTien = Math.max(0, rawTotal - discount + shipFee);

      // 6. SINH MÃ ĐƠN HÀNG TỰ ĐỘNG
      const maDonHang =
        "DH" +
        Date.now().toString().slice(-6) +
        Math.floor(10 + Math.random() * 90);

      // 7. CHÈN VÀO BẢNG: donhang
      await client.query(
        `INSERT INTO donhang (madonhang, makh, manguoidung, makho, machinhanh, ngaydat, trangthai, tongtien, ghichu)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)`,
        [
          maDonHang,
          maKhachHang,
          checkoutData.MaNguoiDung || null,
          makho,
          machinhanh,
          "Chờ xử lý",
          tongTien,
          checkoutData.GhiChu || checkoutData.ghichu || "",
        ],
      );

      // 8. CHÈN chitiet_donhang (lưu đúng giamgia từng món) & TRỪ TỒN KHO tonkho + GHI SỔ CÁI giaodichkho
      const insertDetailQuery = `
        INSERT INTO chitiet_donhang (madonhang, masp, soluong, giaban, giamgia)
        VALUES ($1, $2, $3, $4, $5)
      `;
      const updateStockQuery = `
        UPDATE tonkho 
        SET soluongton = soluongton - $1, ngaycapnhat = NOW() 
        WHERE masp = $2 AND makho = $3
      `;
      const insertGDQuery = `
        INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd)
        VALUES ($1, $2, $3, 2, $4, $5, $6, NOW())
      `;

      for (const item of normalizedItems) {
        await client.query(
          `INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu)
           VALUES ($1, $2, 0, 0)
           ON CONFLICT (makho, masp) DO NOTHING`,
          [makho, item.maSP],
        );

        const stockCheck = await client.query(
          `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2 FOR UPDATE`,
          [item.maSP, makho],
        );
        const tonTruoc =
          stockCheck.rows.length > 0
            ? Math.trunc(parseFloat(stockCheck.rows[0].soluongton) || 0)
            : 0;

        if (tonTruoc < item.soLuong) {
          throw createBusinessError(
            `Kho hàng '${makho}' không đủ tồn kho cho '${item.tenSP}'! (Hiện còn: ${tonTruoc}, Yêu cầu: ${item.soLuong})`,
          );
        }

        const tonSau = tonTruoc - item.soLuong;
        const itemDiscount =
          discountPercent > 0
            ? Math.round(item.giaBan * item.soLuong * (discountPercent / 100))
            : 0;

        await client.query(insertDetailQuery, [
          maDonHang,
          item.maSP,
          item.soLuong,
          item.giaBan,
          itemDiscount,
        ]);

        await client.query(updateStockQuery, [item.soLuong, item.maSP, makho]);

        // Sinh mã giao dịch 20 ký tự duy nhất bằng crypto (chống trùng khi đơn có nhiều sản phẩm)
        const maGD = `GD${crypto.randomBytes(9).toString("hex").toUpperCase()}`;
        await client.query(insertGDQuery, [
          maGD,
          item.maSP,
          makho,
          item.soLuong,
          tonTruoc,
          tonSau,
        ]);
      }

      // 9. CHÈN VÀO BẢNG: phieugiaohang
      const maGiaoHang =
        "GH" +
        Date.now().toString().slice(-6) +
        Math.floor(10 + Math.random() * 90);
      await client.query(
        `INSERT INTO phieugiaohang (magiaohang, madonhang, diachi, ngaygiao, trangthai, nguoinhan, sdtnguoinhan)
         VALUES ($1, $2, $3, NOW(), $4, $5, $6)`,
        [
          maGiaoHang,
          maDonHang,
          checkoutData.DiaChi || checkoutData.diachi || "Chưa có địa chỉ",
          "Đang xử lý",
          checkoutData.NguoiNhan || checkoutData.nguoinhan || "Khách mua lẻ",
          checkoutData.SDTNguoiNhan || checkoutData.sdtnguoinhan || "",
        ],
      );

      // 10. CHÈN VÀO BẢNG: thanhtoan
      const maThanhToan =
        "TT" +
        Date.now().toString().slice(-6) +
        Math.floor(10 + Math.random() * 90);
      const phuongThuc =
        checkoutData.PhuongThucThanhToan ||
        checkoutData.phuongthuc ||
        "COD";
      const trangThaiTT =
        phuongThuc.toUpperCase() === "COD"
          ? "Chưa Thanh Toán"
          : "Chờ Xác Nhận";

      await client.query(
        `INSERT INTO thanhtoan (mathanhtoan, madonhang, ngaythanhtoan, sotien, phuongthuc, magiaodich, trangthai)
         VALUES ($1, $2, NOW(), $3, $4, NULL, $5)`,
        [maThanhToan, maDonHang, tongTien, phuongThuc, trangThaiTT],
      );

      await client.query("COMMIT");

      return {
        maDonHang,
        tongTien,
        makho,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = CheckoutModel;
