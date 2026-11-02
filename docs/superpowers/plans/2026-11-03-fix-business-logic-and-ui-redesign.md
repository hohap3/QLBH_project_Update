# Kế hoạch Triển khai Khắc phục Lỗi Nghiệp vụ & Thiết kế Lại Giao diện HP STORE

> **Dành cho kỹ sư triển khai:** BẮT BUỘC SỬ DỤNG: `superpowers:subagent-driven-development` hoặc `superpowers:executing-plans` để thực thi từng bước trong kế hoạch. Sử dụng cú pháp checkbox (`- [ ]`) để theo dõi tiến độ.

**Mục tiêu:** Khắc phục triệt để 4 lỗ hổng nghiệp vụ cốt lõi (Doanh thu KPI 0đ, Hoàn tồn kho khi hủy đơn, Tích/trừ điểm Smember, Định tuyến kho hàng) và tái thiết kế giao diện đồng bộ thương hiệu CellphoneS Ruby Red (`#d70018`), tối ưu hóa khoảng trắng cho trang Đơn hàng, Chi tiết sản phẩm và Dashboard.

**Kiến trúc:** 
- Backend: Node.js / Express.js giao tiếp cơ sở dữ liệu PostgreSQL (Neon.tech) theo chuẩn ACID Transactions.
- Frontend: Vanilla JS / HTML5 / Bootstrap 5 / Vite với kiến trúc Component tách biệt, đồng bộ dữ liệu Real-time qua REST API và localStorage.
- Bảo mật & Phân quyền: JWT + RBAC (Super Admin, Store Manager, Sales Staff, Member).

**Tech Stack:** Node.js, Express, PostgreSQL (`pg`), Vite, Bootstrap 5, SweetAlert2, FontAwesome 6, Chart.js.

**Spec Tham chiếu:** Yêu cầu người dùng & Báo cáo kiểm định nghiệp vụ `he-thong-nghiep-vu-audit.md`.

## Ràng buộc Toàn cục (Global Constraints)
- **Màu sắc chủ đạo:** Đỏ Ruby CellphoneS/HP STORE (`#d70018`, hover `#b8001f`, nền phụ `#fff1f2`), nền Slate xám thanh lịch (`#f8fafc`).
- **Tên Actor chuẩn:** `👑 Admin Tổng` (`admin`), `🏢 Quản lý CN` (`manager`), `💼 Nhân viên Sales` (`nhanvien`), `👤 Khách hàng` (`khachhang`).
- **An toàn giao dịch kho:** Mọi thao tác xuất/nhập/hoàn kho phải được bọc trong PostgreSQL Transaction (`BEGIN ... COMMIT / ROLLBACK`) với lệnh `FOR UPDATE` chống Race Condition và ghi log vào sổ cái `giaodichkho`.
- **Độ tương thích Client:** Build Vite phải hoàn thành với 0 lỗi cú pháp (`npm run build` trong thư mục `client`).

## Tiêu điểm Đánh giá & Rủi ro Tiềm ẩn (Review Focus)
1. **Lỗi KPI Doanh thu 0đ:** Đơn hàng mới đặt ở trạng thái "Chờ xử lý" hoặc "Đang giao" không được tính vào doanh thu thực tế -> Cần tính cả "Đã giao" & "Thành công", đồng thời cung cấp chỉ số "Doanh thu tạm tính".
2. **Khách hàng vãng lai đặt hàng:** Cột `makh` bị `NULL` khiến hàm đếm `COUNT(DISTINCT makh)` bỏ qua -> Cần đếm theo số điện thoại hoặc định danh đơn để KPI không bị 0 khách.
3. **Thất thoát tồn kho khi Hủy đơn:** Hủy đơn từ dropdown quản lý không hoàn kho -> Phải tự động tăng lại `soluongton` trong `tonkho` và ghi sổ cái `giaodichkho`.
4. **Trừ điểm âm tài khoản:** Khách cố tình hack điểm hoặc số dư không đủ -> Kiểm tra `diemtichluy >= PointsToDeduct` ngay trong transaction DB.
5. **Đơn hàng thất bại do hết hàng ở Kho Tổng:** Kho tổng hết hàng nhưng chi nhánh còn -> Cho phép khách chọn hoặc tự động fallback chi nhánh khả dụng.

---

## Danh sách Task Thực thi Step-by-Step

### Task 1: Khắc phục Logic Thống kê KPI Doanh thu & Khách hàng Dashboard
**Files:**
- Sửa đổi: `server/src/models/thongKeModel.js`
- Sửa đổi: `server/src/controllers/thongKeController.js`
- Test: `server/tests/test_kpi_stats.js`

**Interfaces:**
- Consumes: Bảng `donhang`, `chitiet_donhang`, `sanpham`, `khachhang`
- Produces: `ThongKeModel.getQuickStats(branch, startDate, endDate)` trả về:
  - `doanhthu_nay`: Doanh thu thực tế (đơn có trạng thái `Thành công` hoặc `Đã giao`)
  - `doanhthu_tamtinh`: Doanh thu từ đơn đang chờ xử lý / đang giao
  - `donhang_nay`: Tổng số đơn hàng hợp lệ
  - `khachhang_nay`: Số khách hàng phát sinh đơn (hỗ trợ cả khách vãng lai qua SĐT)
  - `loinhuangop_nay`: Lợi nhuận gộp thực tế

- [ ] **Step 1: Viết test case kiểm tra tính toán KPI đa trạng thái đơn hàng**
- [ ] **Step 2: Chạy test để xác nhận logic cũ bỏ sót đơn "Đang giao" và khách vãng lai**
- [ ] **Step 3: Cập nhật hàm `getQuickStats` trong `server/src/models/thongKeModel.js`**
  - Mở rộng điều kiện lọc doanh thu: `dh.trangthai IN ('Thành công', 'Đã giao')`.
  - Bổ sung trường `doanhthu_choxuly` cho các đơn `'Chờ xử lý'`, `'Chờ xác nhận'`, `'Đang giao'`.
  - Cập nhật đếm khách hàng: `COALESCE(COUNT(DISTINCT d.makh), COUNT(DISTINCT d.sdtnguoinhan))`.
- [ ] **Step 4: Chạy test xác nhận tất cả chỉ số KPI trả về giá trị thực tế hợp lý**
- [ ] **Step 5: Commit thay đổi Task 1**

---

### Task 2: Triển khai Nghiệp vụ Tích điểm & Trừ điểm Thành viên Smember
**Files:**
- Sửa đổi: `server/src/models/checkoutModel.js`
- Sửa đổi: `server/src/controllers/orderController.js`
- Sửa đổi: `client/src/JS/checkout.js`
- Test: `server/tests/test_loyalty_points.js`

**Interfaces:**
- Consumes: Payload `PointsToDeduct`, `MaNguoiDung`, `tongTien` từ checkout
- Produces: 
  - Trừ `diemtichluy` trong bảng `khachhang` khi tạo đơn thành công (1 điểm = 1.000 VNĐ).
  - Tự động cộng 1% giá trị đơn hàng thành điểm thưởng (`tongTien / 100.000`) khi trạng thái đơn chuyển sang `Thành công`.

- [ ] **Step 1: Viết test kiểm tra trừ điểm khi checkout và cộng điểm khi hoàn tất đơn**
- [ ] **Step 2: Cập nhật `server/src/models/checkoutModel.js`**
  - Sau khi chèn `donhang`, kiểm tra nếu `checkoutData.PointsToDeduct > 0` và có `maKhachHang`:
    - Kiểm tra số dư điểm khả dụng bằng `SELECT diemtichluy FROM khachhang WHERE makh = $1 FOR UPDATE`.
    - Thực thi `UPDATE khachhang SET diemtichluy = diemtichluy - $1 WHERE makh = $2`.
- [ ] **Step 3: Cập nhật `server/src/controllers/orderController.js`**
  - Khi đơn hàng chuyển trạng thái sang `'Thành công'`, tự động tính điểm tích lũy mới: `Math.floor(tongtien * 0.01 / 1000)` và cộng vào `khachhang.diemtichluy`.
- [ ] **Step 4: Chạy test xác minh số dư điểm biến động chính xác**
- [ ] **Step 5: Commit thay đổi Task 2**

---

### Task 3: Tự động Hoàn Tồn Kho khi Hủy Đơn trên Trang Quản lý Đơn hàng
**Files:**
- Sửa đổi: `server/src/models/oderModel.js`
- Sửa đổi: `server/src/controllers/orderController.js`
- Test: `server/tests/test_restock_on_cancel.js`

**Interfaces:**
- Consumes: `madonhang`, `TrangThai = 'Đã hủy'` từ Quản lý đơn hàng
- Produces: Hoàn trả số lượng sản phẩm về bảng `tonkho` và ghi giao dịch kho `loaigd = 1 (Nhập hoàn trả)`.

- [ ] **Step 1: Viết test kiểm tra số lượng tồn kho trước và sau khi hủy đơn**
- [ ] **Step 2: Cập nhật phương thức `Order.updateStatus` trong `server/src/models/oderModel.js`**
  - Bổ sung logic kiểm tra trạng thái cũ: Nếu trạng thái cũ khác `'Đã hủy'` và trạng thái mới là `'Đã hủy'`:
    - Lấy danh sách sản phẩm từ `chitiet_donhang`.
    - Chạy vòng lặp hoàn trả: `UPDATE tonkho SET soluongton = soluongton + $1 WHERE masp = $2 AND makho = $3`.
    - Ghi nhận `giaodichkho` với loại giao dịch nhập hoàn đơn.
- [ ] **Step 3: Chạy test xác nhận tồn kho tăng trở lại chính xác**
- [ ] **Step 4: Commit thay đổi Task 3**

---

### Task 4: Định tuyến Tồn kho Đa Chi nhánh khi Khách Đặt hàng Online
**Files:**
- Sửa đổi: `server/src/models/checkoutModel.js`
- Sửa đổi: `client/src/JS/checkout.js`
- Sửa đổi: `client/src/pages/checkout.html`

**Interfaces:**
- Consumes: `MaChiNhanh` hoặc vị trí kho từ người dùng, danh sách tồn kho theo chi nhánh
- Produces: Cho phép khách hàng chọn nhận hàng tại chi nhánh gần nhất hoặc tự động fallback sang kho chi nhánh còn hàng khi Kho Tổng thiếu số lượng.

- [ ] **Step 1: Bổ sung ô chọn Chi nhánh xuất hàng / nhận hàng trên `checkout.html`**
  - Chi nhánh Chính (Hà Nội), Chi nhánh 1 (TP.HCM), Chi nhánh 2 (Cầu Giấy, Hà Nội).
- [ ] **Step 2: Cập nhật `client/src/JS/checkout.js` truyền mã kho/chi nhánh tương ứng**
- [ ] **Step 3: Cập nhật `server/src/models/checkoutModel.js` hỗ trợ tự động tìm kho thay thế**
  - Nếu kho yêu cầu không đủ số lượng, tự động kiểm tra xem các kho khác trong hệ thống có đủ hàng không và thông báo gợi ý kho khả dụng.
- [ ] **Step 4: Kiểm thử quy trình đặt hàng thành công không bị nghẽn do thiếu hàng cục bộ**
- [ ] **Step 5: Commit thay đổi Task 4**

---

### Task 5: Đồng bộ Nhận diện Thương hiệu Màu Đỏ Ruby CellphoneS (`#d70018`)
**Files:**
- Sửa đổi: `client/src/styles/login.css`
- Sửa đổi: `client/src/pages/login.html`
- Sửa đổi: `client/src/pages/register.html`
- Sửa đổi: `client/src/styles/register.css`

**Interfaces:**
- Chuẩn hóa toàn bộ nút hành động chính (Primary CTA Buttons) từ màu xanh Teal `#0f766e` sang Đỏ Ruby `#d70018`.
- Nền trang đăng ký/đăng nhập thanh lịch, bo cong 16px, đổ bóng mềm mại theo phong cách CellphoneS.

- [ ] **Step 1: Cập nhật biến CSS màu trong `login.css` và `register.css`**
  - `--hp-primary: #d70018; --hp-primary-dark: #b8001f;`
- [ ] **Step 2: Cập nhật style nút Đăng nhập & Đăng ký sang màu Đỏ Ruby với hiệu ứng hover mượt mà**
- [ ] **Step 3: Kiểm tra hiển thị trên trình duyệt đảm bảo tính đồng bộ thị giác với Header và Topbar**
- [ ] **Step 4: Commit thay đổi Task 5**

---

### Task 6: Tối ưu Khoảng trắng & Thiết kế Bảng Quản lý Đơn hàng Hiện đại
**Files:**
- Sửa đổi: `client/src/pages/don-hang.html`
- Sửa đổi: `client/src/JS/pages/don-hang.js`
- Sửa đổi: `client/src/styles/don-hang.css` (hoặc inline styles hiện hữu)

**Interfaces:**
- Bảng danh sách đơn hàng nhỏ gọn, phân cấp thị giác rõ ràng với Pill Badges sinh động:
  - *Chờ xác nhận / Chờ xử lý:* Nền vàng nhạt `#fef3c7`, chữ nâu hổ phách `#b45309`.
  - *Đang giao:* Nền xanh lam nhạt `#dbeafe`, chữ xanh đậm `#1d4ed8`.
  - *Thành công / Đã giao:* Nền xanh ngọc nhạt `#dcfce7`, chữ xanh lá `#15803d`.
  - *Đã hủy:* Nền đỏ nhạt `#fee2e2`, chữ đỏ thẫm `#b91c1c`.
- Modal Chi tiết đơn hàng: Bố cục 2 cột (Cột 1: Thông tin khách + địa chỉ + phương thức thanh toán; Cột 2: Danh sách sản phẩm + Tạm tính + Điểm trừ + Tổng thanh toán).

- [ ] **Step 1: Tối ưu padding và lề trong `don-hang.html` loại bỏ các khoảng trống thừa**
- [ ] **Step 2: Cập nhật hàm render badge trạng thái trong `client/src/JS/pages/don-hang.js`**
- [ ] **Step 3: Thiết kế lại giao diện Modal xem chi tiết đơn hàng sang phong cách phẳng sáng màu**
- [ ] **Step 4: Kiểm thử hiển thị danh sách đơn và mở Modal chi tiết**
- [ ] **Step 5: Commit thay đổi Task 6**

---

### Task 7: Làm giàu Thông tin Chi tiết Sản phẩm & Tối ưu Kính lúp (Magnifier)
**Files:**
- Sửa đổi: `client/src/pages/product-detail.html`
- Sửa đổi: `client/src/JS/pages/product-detail.js`
- Sửa đổi: `client/src/styles/product-detail.css`

**Interfaces:**
- Đổ dữ liệu thông số kỹ thuật dạng bảng 2 cột rõ nét (CPU, RAM, Màn hình, Pin, Camera, Trọng lượng).
- Tạo khối "Đặc điểm nổi bật" với các bullet point công nghệ và bài viết đánh giá chi tiết sản phẩm.
- Tinh chỉnh hiệu ứng Kính lúp (Magnifier Lens Zoom) mượt mà, zoom góc cạnh sắc nét không bị vỡ bố cục khi di chuột.

- [ ] **Step 1: Bổ sung khung thông số kỹ thuật chuẩn CellphoneS trong `product-detail.html`**
- [ ] **Step 2: Cập nhật `product-detail.js` đổ dữ liệu chi tiết từ trường `thongsokythuat` và `mota`**
- [ ] **Step 3: Tối ưu script Kính lúp: Zoom 2.5x khi hover vào ảnh sản phẩm, ẩn kính lúp khi chuột rời khỏi vùng ảnh**
- [ ] **Step 4: Kiểm tra hiển thị trên sản phẩm mẫu (iPhone 15 Pro Max, Laptop Gaming, Phụ kiện)**
- [ ] **Step 5: Commit thay đổi Task 7**

---

### Task 8: Bộ lọc Thời gian thực & Khóa Phân quyền Chi nhánh trên Topbar Dashboard
**Files:**
- Sửa đổi: `client/src/pages/dashboard.html`
- Sửa đổi: `client/src/JS/dashboard.js`
- Sửa đổi: `client/src/JS/pages/tong-quat.js`

**Interfaces:**
- Lắng nghe sự kiện `change` trên ô `#startDate` và `#endDate` ở Topbar, tự động tải lại KPI và biểu đồ theo khoảng ngày.
- Tự động nhận diện vai trò người dùng:
  - Nếu là `ADMIN`: Mở toàn quyền chọn Tất cả chi nhánh (`ALL`, `CN_CHINH`, `CN_1`, `CN_2`).
  - Nếu là `MANAGER` (ví dụ quản lý `CN_1`): Tự động chọn và vô hiệu hóa (`disabled`) dropdown chi nhánh để đảm bảo an toàn phân quyền chi nhánh.

- [ ] **Step 1: Viết hàm gắn sự kiện ngày tháng trong `dashboard.js`**
- [ ] **Step 2: Truyền `startDate` và `endDate` vào query params khi gọi API tổng quan**
- [ ] **Step 3: Bổ sung logic khóa bộ lọc chi nhánh theo vai trò của `localStorage.hpstore_user`**
- [ ] **Step 4: Kiểm tra đăng nhập bằng tài khoản `admin` và tài khoản `manager` để xác minh phân quyền**
- [ ] **Step 5: Commit thay đổi Task 8**

---

## Tiêu chí Nghiệm thu Tổng thể (Definition of Done)
1. **Nghiệp vụ:** KPI Dashboard hiển thị số liệu doanh thu thực tế, khách hàng thực tế; Hủy đơn hàng tự động hoàn tồn kho; Đặt hàng có trừ và tích điểm thành viên Smember.
2. **Giao diện:** Toàn bộ hệ thống đồng bộ màu Đỏ Ruby `#d70018`; Bảng đơn hàng có badge màu sống động; Chi tiết sản phẩm có bài viết & bảng thông số kỹ thuật đầy đủ; Kính lúp zoom mượt mà.
3. **Hiệu năng & Build:** `npm run build` trong `client/` đạt 100% thành công, không cảnh báo lỗi runtime.

