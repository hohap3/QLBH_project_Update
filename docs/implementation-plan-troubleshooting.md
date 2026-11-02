# Kế hoạch & Bộ Prompt Chuẩn Hóa Khắc Phục Lỗi Hệ Thống QLBH (Phase 4 & Multi-Branch)

> **Mục tiêu:** Cung cấp lộ trình thực thi (Implementation Plan) từng bước và bộ câu lệnh Prompt mẫu chuẩn chỉnh cho từng giai đoạn, giúp kỹ sư hoặc AI Agent có thể thực thi chính xác, độc lập mà không làm sai lệch kiến trúc CSDL PostgreSQL trên Neon.tech.

---

## 1. TỔNG QUAN CÁC GIAI ĐOẠN

| Giai đoạn | Nội dung xử lý | File tác động chính | Trạng thái |
| :--- | :--- | :--- | :--- |
| **Giai đoạn 1** | Đồng bộ Tồn kho Đa Chi nhánh & Đặt hàng | `server/src/models/checkoutModel.js`, `warehouseModel.js`, `productModel.js` | Backend Model |
| **Giai đoạn 2** | Chuẩn hóa Quản lý Nhân viên & Phân quyền | `server/src/models/employeeModel.js`, `server/src/middleware/auth.js` | Backend Auth & CRUD |
| **Giai đoạn 3** | Đồng bộ Endpoint Môi trường & Auth Guard | `client/src/JS/common/header.js`, `client/src/JS/auth-guard.js`, `login.js` | Frontend Routing |
| **Giai đoạn 4** | Khởi tạo Dữ liệu Mẫu & Kích hoạt Biểu đồ | `server/src/models/thongKeModel.js`, `server/seed_orders_customers.js` | Analytics & Seeder |
| **Giai đoạn 5** | Kiểm thử Tự động E2E & Nghiệm thu | `server/test_full_system.js` | Testing & Verification |

---

## 2. CHI TIẾT TỪNG GIAI ĐOẠN & PROMPT MẪU THỰC THI

### 🟢 GIAI ĐOẠN 1: Đồng bộ Tồn kho Đa Chi nhánh & Đặt hàng

#### Mục tiêu kỹ thuật:
- Chuyển toàn bộ logic trừ kho từ bảng `sanpham` cũ sang bảng `tonkho(makho, masp, soluongton)`.
- Áp dụng Transaction với khóa dòng `SELECT ... FOR UPDATE` để ngăn chặn Race Condition khi nhiều khách hàng cùng đặt một sản phẩm.
- Ghi nhật ký xuất kho vào sổ cái `giaodichkho`.

#### Prompt mẫu Giai đoạn 1:
```markdown
Bạn là lập trình viên Backend Node.js/PostgreSQL chuyên nghiệp. Hãy sửa lỗi logic trừ tồn kho khi đặt hàng trong file `server/src/models/checkoutModel.js` theo kiến trúc Đa Chi Nhánh (Phase 4):

Yêu cầu kỹ thuật:
1. Trong database PostgreSQL, cột `soluongton` không còn nằm ở bảng `sanpham` mà được lưu tại bảng `tonkho(makho, masp, soluongton, soluongtamgiu)`.
2. Trong hàm `saveCheckoutTransaction(checkoutData)`, hãy:
   - Xác định `makho`: Lấy từ `checkoutData.MaKho` hoặc mặc định `'KHO_TONG'`.
   - Đối với mỗi sản phẩm trong `checkoutData.ChiTiet`:
     + Đảm bảo bản ghi tồn tại: Chạy `INSERT INTO tonkho (makho, masp, soluongton, soluongtamgiu) VALUES ($1, $2, 0, 0) ON CONFLICT (makho, masp) DO NOTHING`.
     + Khóa dòng an toàn: `SELECT soluongton FROM tonkho WHERE masp = $1 AND makho = $2 FOR UPDATE`.
     + Cập nhật tồn kho: `UPDATE tonkho SET soluongton = soluongton - $1, ngaycapnhat = NOW() WHERE masp = $2 AND makho = $3`.
     + Ghi nhận sổ cái biến động kho: `INSERT INTO giaodichkho (magd, masp, makho, loaigd, soluong, tontruoc, tonsau, ngaygd) VALUES ($1, $2, $3, 2, $4, $5, $6, NOW())` với `loaigd = 2` (Xuất kho).
3. Đảm bảo toàn bộ thao tác nằm trong Transaction (`BEGIN` ... `COMMIT`), nếu có lỗi thì `ROLLBACK` và giải phóng client về pool (`client.release()`).
```

---

### 🟢 GIAI ĐOẠN 2: Chuẩn hóa Quản lý Nhân viên & Phân quyền

#### Mục tiêu kỹ thuật:
- Chuẩn hóa cột khóa chính `mand` trong bảng `nguoidung` kiểu `UUID`, tránh lỗi ép kiểu khi controller sinh chuỗi `NV...`.
- Tương thích vai trò `mavaitro` giữa `STAFF` và `Employee`.
- Chuẩn hóa trường trạng thái `trangthai` sang `VARCHAR` (`'HOAT_DONG'` / `'KHOA'`).

#### Prompt mẫu Giai đoạn 2:
```markdown
Bạn là lập trình viên Backend Node.js/PostgreSQL. Hãy sửa lỗi Model Quản lý Nhân viên trong `server/src/models/employeeModel.js` và Middleware `server/src/middleware/auth.js`:

Yêu cầu kỹ thuật:
1. Trong `server/src/models/employeeModel.js`:
   - Câu lệnh truy vấn danh sách (`getAllEmployees`, `countEmployees`, `getEmployeeById`): Lọc nhân viên theo điều kiện `mavaitro IN ('STAFF', 'Employee')` và ép kiểu ID so sánh `mand::text = $1`.
   - Khi tạo nhân viên mới (`createEmployee`): Sử dụng `crypto.randomUUID()` để sinh UUID hợp lệ cho cột `mand`. Gán `mavaitro = 'STAFF'` và `trangthai = 'HOAT_DONG'`.
   - Khi cập nhật trạng thái (`toggleStatus`): Chuyển giá trị boolean thành chuỗi `'HOAT_DONG'` hoặc `'KHOA'`.
2. Trong `server/src/middleware/auth.js`:
   - Chuẩn hóa hàm `authorizeRoles`: Chuyển đổi toàn bộ mảng role và `req.user.role` thành chữ thường (`toLowerCase()`).
   - Tự động map tương đương: Nếu user có role `admin` hoặc `manager` thì có toàn quyền quản lý; `staff` và `employee` được gộp chung quyền hạn.
```

---

### 🟢 GIAI ĐOẠN 3: Đồng bộ Endpoint Môi trường & Auth Guard

#### Mục tiêu kỹ thuật:
- Xóa bỏ tình trạng hardcoded URL Cloud Render (`https://qlbh-project.onrender.com/api`) ở client.
- Tự động nhận diện localhost (`http://localhost:5000/api`) khi chạy dev và Render khi chạy production.
- Đảm bảo các request API được gắn kèm Header `Authorization: Bearer <token>`.

#### Prompt mẫu Giai đoạn 3:
```markdown
Bạn là lập trình viên Frontend chuyên về JavaScript SPA. Hãy tái cấu trúc cấu hình Endpoint API và Auth Guard trong thư mục `client/src/JS/`:

Yêu cầu kỹ thuật:
1. Tại `client/src/JS/common/header.js`, định nghĩa và xuất khẩu biến `BASE_URL` động:
   ```javascript
   export const BASE_URL =
     typeof window !== "undefined" &&
     (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
       ? "http://localhost:5000/api"
       : "https://qlbh-project.onrender.com/api";
   ```
2. Thay thế toàn bộ các biến cục bộ `const BASE_URL = "https://qlbh-project.onrender.com/api"` ở các file sau thành lệnh import:
   - `client/src/JS/login.js`
   - `client/src/JS/homepage.js`
   - `client/src/JS/product-detail.js`
   - `client/src/JS/register.js`
   - `client/src/JS/hoso.js`
   - `client/src/JS/order-history.js`
3. Tại `client/src/JS/auth-guard.js`:
   - Sử dụng `${BASE_URL}/auth/verify-role` thay vì link Render cố định.
   - Tránh việc token đăng nhập local bị gửi lên Cloud Render dẫn đến bị kick văng ra trang Login.
```

---

### 🟢 GIAI ĐOẠN 4: Khởi tạo Dữ liệu Mẫu & Kích hoạt Biểu đồ

#### Mục tiêu kỹ thuật:
- Ngăn chặn lỗi chia cho số 0 trong tính toán % tăng trưởng doanh thu/đơn hàng.
- Trả về đủ mảng 12 tháng từ database kể cả khi tháng đó chưa có phát sinh đơn hàng.
- Xây dựng kịch bản Seed Data nạp đơn hàng trải dài qua các tháng để biểu đồ Chart.js hiển thị số liệu thực tế.

#### Prompt mẫu Giai đoạn 4:
```markdown
Bạn là kỹ sư dữ liệu và Backend Node.js. Hãy tối ưu API Thống kê trong `server/src/models/thongKeModel.js` và tạo script nạp dữ liệu mẫu `server/seed_orders_customers.js`:

Yêu cầu kỹ thuật:
1. Trong `server/src/models/thongKeModel.js`:
   - Bọc lót an toàn cho hàm tính phần trăm: Nếu số liệu tháng trước = 0, nếu tháng này > 0 thì trả về 100%, ngược lại 0%.
   - Trong `getRevenueByMonth` và `getOrdersByMonth`: Đảm bảo trả về mảng đầy đủ từ T1 đến tháng hiện tại, các tháng không có dữ liệu gán mặc định `value: 0`.
2. Tạo script `server/seed_orders_customers.js`:
   - Thêm 2-3 khách hàng mẫu vào bảng `khachhang`.
   - Thêm các đơn hàng có trạng thái `'Thành công'` phân bổ vào: Tháng hiện tại (T10), Tháng trước (T9), Tháng trước nữa (T8).
   - Thêm chi tiết đơn hàng tương ứng vào `chitiet_donhang`, phiếu giao hàng vào `phieugiaohang`, thanh toán vào `thanhtoan`.
   - Chạy script độc lập: `node server/seed_orders_customers.js` đảm bảo dữ liệu hiển thị tức thì trên 4 biểu đồ của `tong-quan.html`.
```

---

### 🟢 GIAI ĐOẠN 5: Kiểm thử Tự động E2E & Nghiệm thu

#### Mục tiêu kỹ thuật:
- Tạo script kiểm thử tự động toàn bộ luồng nghiệp vụ không cần thao tác tay.

#### Prompt mẫu Giai đoạn 5:
```markdown
Hãy viết một script Node.js kiểm thử tích hợp (Integration Test) `server/test_full_system.js` để kiểm tra toàn bộ hệ thống sau khi sửa lỗi:

Kịch bản kiểm thử:
1. Đăng nhập: Gọi POST `/api/auth/login` với `admin` / `123456`, kiểm tra nhận về Token.
2. Kiểm tra Thống kê: Gọi GET `/api/thongke/overview`, kiểm tra các trường `DoanhThu`, `TongDonHang`, `LoiNhuanGop` không bị null/NaN.
3. Kiểm tra Biểu đồ: Gọi GET `/api/thongke/monthly-revenue` và `/monthly-orders`, kiểm tra độ dài mảng tháng khớp với tháng hiện tại.
4. Kiểm tra Kho hàng: Gọi POST `/api/warehouse/transaction` thực hiện 1 giao dịch nhập kho 5 cái và 1 giao dịch xuất kho 2 cái. Kiểm tra số tồn cuối khớp.
5. Kiểm tra Đặt hàng: Gọi POST `/api/checkout/process` với sản phẩm vừa tạo. Kiểm tra tồn kho bị trừ đúng và mã đơn hàng sinh ra thành công.
6. In ra màn hình console báo cáo Pass/Fail chi tiết cho từng bước kiểm thử.
```
