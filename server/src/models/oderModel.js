const { poolPromise } = require("../config/database");

const Order = {
  // 1. Lấy danh sách đơn hàng kèm theo phân trang bằng LIMIT và OFFSET
  getWithPagination: async (page = 1, limit = 10, trangThaiFilter = null) => {
    try {
      const pool = await poolPromise;
      const offset = (page - 1) * limit;

      // Khởi tạo các biến xây dựng câu lệnh SQL động
      let whereClause = "";
      const dataParams = [limit, offset];

      // Nếu có chọn trạng thái cụ thể (khác "Tất cả")
      if (
        trangThaiFilter !== null &&
        trangThaiFilter !== undefined &&
        trangThaiFilter !== ""
      ) {
        whereClause = "WHERE dh.trangthai = $3";
        dataParams.push(trangThaiFilter);
      }

      const dataQuery = `
        SELECT 
          dh.madonhang,
          kh.hoten AS tenkhachhang,
          kh.email AS emailkhachhang,
          dh.ngaydat,
          dh.tongtien,
          dh.trangthai,
          dh.makho,
          dh.machinhanh,
          (SELECT COUNT(*)::INT FROM chitiet_donhang ct WHERE ct.madonhang = dh.madonhang) AS soluongsanpham
        FROM donhang dh
        LEFT JOIN khachhang kh ON dh.makh = kh.makh
        ${whereClause}
        ORDER BY dh.ngaydat DESC
        LIMIT $1 OFFSET $2
      `;
      const dataResult = await pool.query(dataQuery, dataParams);

      // Đếm tổng số bản ghi
      let countQuery = "SELECT COUNT(*) FROM donhang dh";
      const countParams = [];

      if (whereClause) {
        countQuery += ` ${whereClause}`;
        countParams.push(trangThaiFilter);
        countQuery = countQuery.replace("$3", "$1");
      }

      const countResult = await pool.query(countQuery, countParams);
      const totalRecords = parseInt(countResult.rows[0].count, 10);

      return {
        orders: dataResult.rows,
        totalRecords: totalRecords,
        totalPages: Math.ceil(totalRecords / limit),
      };
    } catch (error) {
      throw error;
    }
  },

  // 2. Lấy chi tiết một đơn hàng bao gồm các mặt hàng đã mua
  getDetails: async (maDonHang) => {
    try {
      const pool = await poolPromise;
      const query = `
        SELECT 
          dh.madonhang,
          dh.makh,
          dh.makho,
          dh.machinhanh,
          kh.mand,
          dh.ngaydat,
          dh.trangthai,
          dh.tongtien,
          dh.ghichu,
          kh.hoten AS hotenkhachhang, 
          kh.sdt AS sdtkhachhang, 
          kh.email AS emailkhachhang, 
          kh.diachi AS diachikhachhang,
          nd.tendangnhap AS tendangnhap,
          ct.masp, 
          sp.tensp,
          sp.hinhanh,
          ct.soluong, 
          ct.giaban, 
          ct.giamgia
        FROM donhang dh
        LEFT JOIN khachhang kh ON dh.makh = kh.makh
        LEFT JOIN nguoidung nd ON kh.mand = nd.mand 
        LEFT JOIN chitiet_donhang ct ON dh.madonhang = ct.madonhang
        LEFT JOIN sanpham sp ON ct.masp = sp.masp
        WHERE dh.madonhang = $1
      `;
      const result = await pool.query(query, [maDonHang]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // 3. Cập nhật trạng thái đơn hàng (Dành cho Admin/Nhân viên duyệt đơn) kèm Tích điểm (Task 2) & Hoàn tồn kho (Task 3)
  updateStatus: async (maDonHang, trangThai) => {
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Lấy thông tin đơn hàng hiện tại
      const orderRes = await client.query(
        `SELECT madonhang, makh, makho, trangthai, tongtien FROM donhang WHERE madonhang = $1 FOR UPDATE`,
        [maDonHang]
      );

      if (orderRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return { rowCount: 0 };
      }

      const currentOrder = orderRes.rows[0];
      const oldStatus = currentOrder.trangthai;

      // 2. Cập nhật trạng thái mới
      await client.query(
        `UPDATE donhang SET trangthai = $1 WHERE madonhang = $2`,
        [trangThai, maDonHang]
      );

      // 3. TASK 2: TÍCH ĐIỂM KHI ĐƠN HÀNG 'Thành công' (1% giá trị, 1000đ = 1 điểm)
      if (trangThai === "Thành công" && oldStatus !== "Thành công" && currentOrder.makh) {
        const tongTien = parseFloat(currentOrder.tongtien) || 0;
        const pointsEarned = Math.floor((tongTien * 0.01) / 1000);
        if (pointsEarned > 0) {
          await client.query(
            `UPDATE khachhang SET diemtichluy = COALESCE(diemtichluy, 0) + $1 WHERE makh = $2`,
            [pointsEarned, currentOrder.makh]
          );
        }
      }

      // 4. TASK 3: HOÀN TỒN KHO KHI ĐƠN HÀNG 'Đã hủy'
      if (trangThai === "Đã hủy" && oldStatus !== "Đã hủy") {
        const makho = currentOrder.makho || "KHO_TONG";
        const itemsRes = await client.query(
          `SELECT masp, soluong FROM chitiet_donhang WHERE madonhang = $1`,
          [maDonHang]
        );

        for (const item of itemsRes.rows) {
          const soLuong = parseInt(item.soluong, 10) || 0;
          if (soLuong > 0) {
            const stockRes = await client.query(
              `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2 FOR UPDATE`,
              [item.masp, makho]
            );
            const tonTruoc = stockRes.rows.length > 0 ? parseFloat(stockRes.rows[0].soluongton) : 0;
            const tonSau = tonTruoc + soLuong;

            await client.query(
              `UPDATE tonkho SET soluongton = soluongton + $1, ngaycapnhat = NOW() WHERE masp = $2 AND makho = $3`,
              [soLuong, item.masp, makho]
            );

            const maGD = "GD_HUY_" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
            await client.query(
              `INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd)
               VALUES ($1, $2, $3, 1, $4, $5, $6, NOW())`,
              [maGD, item.masp, makho, soLuong, tonTruoc, tonSau]
            );
          }
        }
      }

      await client.query("COMMIT");
      return { rowCount: 1 };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // 4. Tìm thông tin cơ bản phục vụ check quyền hủy đơn
  getOrderByCode: async (madonhang) => {
    try {
      const pool = await poolPromise;
      const query = `
        SELECT dh.madonhang, dh.makho, kh.mand, dh.trangthai 
        FROM donhang dh
        LEFT JOIN khachhang kh ON dh.makh = kh.makh
        WHERE dh.madonhang = $1
      `;
      const result = await pool.query(query, [madonhang]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  },

  // 5. Lấy danh sách sản phẩm phục vụ hoàn kho
  getOrderDetailsForCancel: async (madonhang) => {
    try {
      const pool = await poolPromise;
      const query = `SELECT masp, soluong FROM chitiet_donhang WHERE madonhang = $1`;
      const result = await pool.query(query, [madonhang]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  },

  // 6. TRANSACTION: Hủy đơn + Hoàn kho đa chi nhánh (Phase 4 chuẩn bảng tonkho)
  processCancelAndRestoreStock: async (madonhang, productsList) => {
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Lấy thông tin kho xuất của đơn hàng
      const orderRes = await client.query(`SELECT makho FROM donhang WHERE madonhang = $1`, [madonhang]);
      const makho = (orderRes.rows.length > 0 && orderRes.rows[0].makho) ? orderRes.rows[0].makho : "KHO_TONG";

      const updateOrderQuery = `UPDATE donhang SET trangthai = 'Đã hủy' WHERE madonhang = $1`;
      await client.query(updateOrderQuery, [madonhang]);

      if (productsList && productsList.length > 0) {
        for (const item of productsList) {
          const soLuong = parseInt(item.soluong, 10) || 0;
          if (soLuong > 0) {
            const stockRes = await client.query(
              `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2 FOR UPDATE`,
              [item.masp, makho]
            );
            const tonTruoc = stockRes.rows.length > 0 ? parseFloat(stockRes.rows[0].soluongton) : 0;
            const tonSau = tonTruoc + soLuong;

            await client.query(
              `UPDATE tonkho SET soluongton = soluongton + $1, ngaycapnhat = NOW() WHERE masp = $2 AND makho = $3`,
              [soLuong, item.masp, makho]
            );

            const maGD = "GD_HUY_" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
            await client.query(
              `INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd)
               VALUES ($1, $2, $3, 1, $4, $5, $6, NOW())`,
              [maGD, item.masp, makho, soLuong, tonTruoc, tonSau]
            );
          }
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // 7. Cập nhật trạng thái hàng loạt (HỦY hoặc DUYỆT)
  processBulkStatusUpdate: async (orderIds, actionType) => {
    const pool = await poolPromise;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const id of orderIds) {
        if (actionType === "CANCEL") {
          // Lấy kho hàng của đơn
          const orderRes = await client.query(`SELECT makho FROM donhang WHERE madonhang = $1`, [id]);
          const makho = (orderRes.rows.length > 0 && orderRes.rows[0].makho) ? orderRes.rows[0].makho : "KHO_TONG";

          // Lấy chi tiết sản phẩm của từng đơn để hoàn kho
          const detailsQuery = `SELECT masp, soluong FROM chitiet_donhang WHERE madonhang = $1`;
          const detailsRes = await client.query(detailsQuery, [id]);

          for (const item of detailsRes.rows) {
            const soLuong = parseInt(item.soluong, 10) || 0;
            if (soLuong > 0) {
              const stockRes = await client.query(
                `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2 FOR UPDATE`,
                [item.masp, makho]
              );
              const tonTruoc = stockRes.rows.length > 0 ? parseFloat(stockRes.rows[0].soluongton) : 0;
              const tonSau = tonTruoc + soLuong;

              await client.query(
                `UPDATE tonkho SET soluongton = soluongton + $1, ngaycapnhat = NOW() WHERE masp = $2 AND makho = $3`,
                [soLuong, item.masp, makho]
              );

              const maGD = "GD_HUY_" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
              await client.query(
                `INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd)
                 VALUES ($1, $2, $3, 1, $4, $5, $6, NOW())`,
                [maGD, item.masp, makho, soLuong, tonTruoc, tonSau]
              );
            }
          }

          // Chuyển trạng thái đơn sang Đã hủy
          await client.query(
            `UPDATE donhang SET trangthai = 'Đã hủy' WHERE madonhang = $1`,
            [id]
          );
        } else if (actionType === "APPROVE") {
          const orderQuery = `SELECT trangthai, makh, tongtien FROM donhang WHERE madonhang = $1`;
          const orderRes = await client.query(orderQuery, [id]);

          if (orderRes.rows.length > 0) {
            const currentStatus = orderRes.rows[0].trangthai;
            let nextStatus = currentStatus;

            switch (currentStatus) {
              case "Chờ xác nhận":
              case "Chờ xử lý":
                nextStatus = "Đang xử lý";
                break;
              case "Đang xử lý":
                nextStatus = "Đang giao";
                break;
              case "Đang giao":
                nextStatus = "Đã giao";
                break;
              case "Đã giao":
                nextStatus = "Thành công";
                break;
            }

            if (nextStatus !== currentStatus) {
              await client.query(
                `UPDATE donhang SET trangthai = $1 WHERE madonhang = $2`,
                [nextStatus, id]
              );

              // Tích điểm nếu đạt 'Thành công'
              if (nextStatus === "Thành công" && orderRes.rows[0].makh) {
                const tongTien = parseFloat(orderRes.rows[0].tongtien) || 0;
                const pointsEarned = Math.floor((tongTien * 0.01) / 1000);
                if (pointsEarned > 0) {
                  await client.query(
                    `UPDATE khachhang SET diemtichluy = COALESCE(diemtichluy, 0) + $1 WHERE makh = $2`,
                    [pointsEarned, orderRes.rows[0].makh]
                  );
                }
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

module.exports = Order;
