// src/models/checkoutModel.js
const { pool } = require("../config/database");

class CheckoutModel {
  /**
   * Xử lý giao dịch Đặt hàng & Trừ tồn kho Đa chi nhánh (Phase 4)
   * Đảm bảo an toàn Concurrency bằng Transaction & SELECT ... FOR UPDATE
   * @param {Object} checkoutData
   */
  static async saveCheckoutTransaction(checkoutData) {
    // 1. Rút kết nối độc lập từ Connection Pool
    const client = await pool.connect();

    try {
      // 2. BẮT ĐẦU TRANSACTION AN TOÀN
      await client.query("BEGIN");

      // 🟢 Xác định chi nhánh và kho hàng thao tác (Có cơ chế Intelligent Fallback Đa Chi Nhánh)
      let defaultKho = checkoutData.MaKho || checkoutData.makho || "KHO_TONG";
      const candidateWarehouses = [defaultKho, "KHO_TONG", "KHO_CN1", "KHO_CN2"].filter((v, i, a) => a.indexOf(v) === i);
      
      let makho = defaultKho;
      for (const candidateKho of candidateWarehouses) {
        let isEligible = true;
        for (const item of checkoutData.ChiTiet) {
          const maSP = item.MaSP || item.masp;
          const soLuong = parseInt(item.SoLuong || item.soluong, 10) || 0;
          const checkRes = await client.query(
            `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2`,
            [maSP, candidateKho]
          );
          const avail = checkRes.rows.length > 0 ? parseFloat(checkRes.rows[0].soluongton) : 0;
          if (avail < soLuong) {
            isEligible = false;
            break;
          }
        }
        if (isEligible) {
          makho = candidateKho;
          break;
        }
      }

      const machinhanh =
        checkoutData.MaChiNhanh ||
        checkoutData.machinhanh ||
        (makho === "KHO_CN1"
          ? "CN_1"
          : makho === "KHO_CN2"
            ? "CN_2"
            : "CN_CHINH");

      // 🟢 Tìm MaKH từ MaNguoiDung (nếu có tài khoản đăng nhập)
      let maKhachHang = null;
      if (checkoutData.MaNguoiDung) {
        const findCustomerQuery = `SELECT makh, diemtichluy FROM khachhang WHERE mand = $1`;
        const customerResult = await client.query(findCustomerQuery, [
          checkoutData.MaNguoiDung,
        ]);

        if (customerResult.rows && customerResult.rows.length > 0) {
          maKhachHang = customerResult.rows[0].makh;

          // 🟢 TASK 2: Khấu trừ Điểm tích lũy Smember nếu khách chọn dùng điểm
          const pointsToDeduct = parseInt(checkoutData.PointsToDeduct, 10) || 0;
          if (pointsToDeduct > 0) {
            const currentPoints = parseInt(customerResult.rows[0].diemtichluy, 10) || 0;
            if (currentPoints < pointsToDeduct) {
              throw new Error(`Điểm tích lũy khả dụng (${currentPoints}) không đủ để khấu trừ (${pointsToDeduct})!`);
            }
            await client.query(
              `UPDATE khachhang SET diemtichluy = diemtichluy - $1 WHERE makh = $2`,
              [pointsToDeduct, maKhachHang]
            );
          }
        }
      }

      // 3. SINH MÃ ĐƠN HÀNG TỰ ĐỘNG
      const maDonHang = "DH" + Date.now().toString().slice(-8);

      // Tính tổng tiền đơn hàng (đã trừ giảm giá điểm thưởng)
      const rawTotal = checkoutData.ChiTiet.reduce((sum, item) => {
        const giaBan = parseFloat(item.GiaBan || item.giaban) || 0;
        const soLuong = parseInt(item.SoLuong || item.soluong, 10) || 0;
        return sum + giaBan * soLuong;
      }, 0);
      const discount = parseFloat(checkoutData.TongGiamGia) || 0;
      const tongTien = Math.max(0, rawTotal - discount);

      // 4. CHÈN VÀO BẢNG: donhang
      const insertOrderQuery = `
        INSERT INTO donhang (madonhang, makh, manguoidung, makho, machinhanh, ngaydat, trangthai, tongtien, ghichu)
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
      `;
      const orderValues = [
        maDonHang,
        maKhachHang,
        checkoutData.MaNguoiDung || null,
        makho,
        machinhanh,
        "Chờ xử lý",
        tongTien,
        checkoutData.GhiChu || checkoutData.ghichu || "",
      ];
      await client.query(insertOrderQuery, orderValues);

      // 5. CHÈN VÀO BẢNG: chitiet_donhang & TRỪ TỒN KHO tonkho (PHASE 4 ĐA CHI NHÁNH)
      const insertDetailQuery = `
        INSERT INTO chitiet_donhang (madonhang, masp, soluong, giaban, giamgia)
        VALUES ($1, $2, $3, $4, 0)
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

      for (const item of checkoutData.ChiTiet) {
        const maSP = item.MaSP || item.masp;
        const soLuong = parseInt(item.SoLuong || item.soluong, 10) || 0;
        const giaBan = parseFloat(item.GiaBan || item.giaban) || 0;

        if (soLuong <= 0) {
          throw new Error(`Số lượng đặt cho sản phẩm '${maSP}' phải lớn hơn 0!`);
        }

        // 5a. Đảm bảo có dòng tồn kho khởi tạo cho kho này (nếu chưa có)
        await client.query(
          `INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu)
           VALUES ($1, $2, 0, 0)
           ON CONFLICT (makho, masp) DO NOTHING`,
          [makho, maSP],
        );

        // 5b. Khóa dòng tồn kho an toàn bằng FOR UPDATE để loại trừ Race Condition
        const stockCheck = await client.query(
          `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2 FOR UPDATE`,
          [maSP, makho],
        );
        const tonTruoc =
          stockCheck.rows.length > 0
            ? parseFloat(stockCheck.rows[0].soluongton)
            : 0;

        // 5c. Kiểm tra tồn kho khả dụng (Fail-fast để dừng ngay trước khi ghi các bảng khác)
        if (tonTruoc < soLuong) {
          throw new Error(
            `Kho hàng '${makho}' không đủ số lượng xuất cho sản phẩm '${maSP}'! (Hiện còn: ${tonTruoc}, Yêu cầu: ${soLuong})`,
          );
        }

        const tonSau = tonTruoc - soLuong;

        // 5d. Lưu chi tiết đơn hàng
        await client.query(insertDetailQuery, [
          maDonHang,
          maSP,
          soLuong,
          giaBan,
        ]);

        // 5e. Cập nhật số lượng tồn mới vào bảng tonkho
        await client.query(updateStockQuery, [soLuong, maSP, makho]);

        // 5f. Ghi nhận sổ cái biến động kho (Sổ cái Ledger - loaigd = 2: Xuất kho)
        const maGD =
          "GD_DH_" +
          Date.now().toString().slice(-6) +
          Math.floor(Math.random() * 1000);
        await client.query(insertGDQuery, [
          maGD,
          maSP,
          makho,
          soLuong,
          tonTruoc,
          tonSau,
        ]);
      }

      // 6. CHÈN VÀO BẢNG: phieugiaohang
      const maGiaoHang = "GH" + Date.now().toString().slice(-8);
      const insertDeliveryQuery = `
        INSERT INTO phieugiaohang (magiaohang, madonhang, diachi, ngaygiao, trangthai, nguoinhan, sdtnguoinhan)
        VALUES ($1, $2, $3, NOW(), $4, $5, $6)
      `;
      const deliveryValues = [
        maGiaoHang,
        maDonHang,
        checkoutData.DiaChi || checkoutData.diachi || "Chưa có địa chỉ",
        "Đang xử lý",
        checkoutData.NguoiNhan || checkoutData.nguoinhan || "Khách mua lẻ",
        checkoutData.SDTNguoiNhan || checkoutData.sdtnguoinhan || "",
      ];
      await client.query(insertDeliveryQuery, deliveryValues);

      // 7. CHÈN VÀO BẢNG: thanhtoan
      const maThanhToan = "TT" + Date.now().toString().slice(-8);
      const phuongThuc =
        checkoutData.PhuongThucThanhToan ||
        checkoutData.phuongthuc ||
        "COD";
      const trangThaiTT =
        phuongThuc.toUpperCase() === "COD"
          ? "Chưa Thanh Toán"
          : "Chờ Xác Nhận";

      const insertPaymentQuery = `
        INSERT INTO thanhtoan (mathanhtoan, madonhang, ngaythanhtoan, sotien, phuongthuc, magiaodich, trangthai)
        VALUES ($1, $2, NOW(), $3, $4, NULL, $5)
      `;
      const paymentValues = [
        maThanhToan,
        maDonHang,
        tongTien,
        phuongThuc,
        trangThaiTT,
      ];
      await client.query(insertPaymentQuery, paymentValues);

      // 🟢 XÁC NHẬN GIAO DỊCH THÀNH CÔNG
      await client.query("COMMIT");

      return {
        maDonHang: maDonHang,
        tongTien: tongTien,
        makho: makho,
      };
    } catch (error) {
      // 🔴 NẾU CÓ BẤT KỲ LỖI NÀO -> ROLLBACK NGAY ĐỂ BẢO VỆ DATABASE
      await client.query("ROLLBACK");
      throw error;
    } finally {
      // 🟢 TRẢ KẾT NỐI VỀ CONNECTION POOL
      client.release();
    }
  }
}

module.exports = CheckoutModel;
