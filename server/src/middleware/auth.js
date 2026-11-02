const jwt = require("jsonwebtoken");

// 1. Middleware xác thực Token (Kiểm tra xem đã đăng nhập chưa)
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Không tìm thấy Token. Vui lòng đăng nhập!" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Lưu thông tin user đã giải mã vào request
    req.user = decoded;
    const userId = decoded.id || decoded.mand || decoded.maND;
    req.user.id = userId;
    req.user.mand = userId;
    req.user.maND = userId;

    // 🟢 CẢI TIẾN ĐỒNG BỘ ROLE: Ép về thuộc tính .role chung để dùng cho authorizeRoles
    req.user.role = decoded.role || decoded.mavaitro;

    // Tạo cơ chế fallback: Đảm bảo dù controller dùng req.user.maND hay req.user.mand cũng không bị gãy
    req.user.maND = decoded.maND || decoded.mand;

    // 🟢 CẢI TIẾN MULTI-BRANCH: Gắn organization_id và branch_id
    req.user.organization_id = decoded.organization_id || null;
    req.user.branch_id = decoded.branch_id || null;

    next();
  } catch (error) {
    console.error("JWT Verify Error:", error.message);
    return res
      .status(403)
      .json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
  }
};

// 2. Middleware kiểm tra quyền Manager/Admin
const isAdmin = (req, res, next) => {
  // Lấy quyền linh hoạt từ 'role' hoặc 'mavaitro' phòng trừ lệch chuẩn chữ hoa/thường
  const userRole = req.user ? req.user.role || req.user.mavaitro : null;

  if (!req.user || userRole !== "Manager") {
    return res.status(403).json({
      message: "Truy cập bị từ chối. Yêu cầu quyền Quản trị viên (Manager)!",
    });
  }
  next();
};

// 3. Middleware kiểm tra quyền Nhân viên (Employee)
const isEmployee = (req, res, next) => {
  const userRole = req.user ? req.user.role || req.user.mavaitro : null;

  if (!req.user || userRole !== "Employee") {
    return res.status(403).json({
      message: "Truy cập bị từ chối. Yêu cầu quyền Nhân viên (Employee)!",
    });
  }
  next();
};

// 4. Middleware CẢI TIẾN: Phân quyền linh hoạt theo mảng (Khuyên dùng)
const authorizeRoles = (...allowedRoles) => {
  const normalized = allowedRoles.map((r) => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Không tìm thấy phiên đăng nhập!" });
    }

    let userRole = (req.user.role || req.user.mavaitro || "").toLowerCase();

    // 1. Quyền Admin luôn có toàn quyền trong toàn bộ hệ thống
    if (userRole === "admin") {
      return next();
    }

    // 2. Quyền Manager có toàn quyền quản lý kho hàng, đơn hàng và các tác vụ nhân viên
    if (userRole === "manager") {
      if (
        normalized.includes("manager") ||
        normalized.includes("employee") ||
        normalized.includes("staff")
      ) {
        return next();
      }
    }

    // 3. Quyền Staff và Employee được gộp chung quyền hạn tương đương
    const isStaffOrEmployee = userRole === "staff" || userRole === "employee";
    const allowsStaffOrEmployee =
      normalized.includes("staff") || normalized.includes("employee");

    if (isStaffOrEmployee && allowsStaffOrEmployee) {
      return next();
    }

    // 4. Kiểm tra trực tiếp theo danh sách quyền cho phép
    if (normalized.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      message: "Truy cập bị từ chối. Bạn không có quyền thực hiện hành động này!",
      roleHienTai: userRole,
    });
  };
};

// 5. Middleware kiểm tra truy cập theo Tổ chức (Multi-tenant)
const requireOrganization = (req, res, next) => {
  if (!req.user || !req.user.organization_id) {
    return res.status(403).json({
      message: "Truy cập bị từ chối. Không xác định được tổ chức (Organization)!",
    });
  }
  next();
};

// 6. Middleware kiểm tra truy cập theo Chi nhánh (Multi-branch)
const requireBranch = (req, res, next) => {
  if (!req.user || !req.user.branch_id) {
    return res.status(403).json({
      message: "Truy cập bị từ chối. Không xác định được chi nhánh (Branch)!",
    });
  }
  next();
};

// 7. Middleware kiểm soát phạm vi chi nhánh (Scoped Branch Access)
const scopeBranchAccess = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      req.user.id = decoded.id || decoded.mand || decoded.maND;
      req.user.role = (decoded.role || decoded.mavaitro || "").toUpperCase();
      req.user.machinhanh = decoded.machinhanh || decoded.branch_id || null;
    } catch (err) {
      return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn!" });
    }
  }

  // Nếu không có user đăng nhập
  if (!req.user) {
    if (!req.query.branch) req.query.branch = "ALL";
    return next();
  }

  const role = req.user.role;
  const userBranch = req.user.machinhanh;

  // Quản lý Tổng (ADMIN): Toàn quyền xem mọi chi nhánh và toàn hệ thống
  if (role === "ADMIN") {
    if (!req.query.branch) req.query.branch = "ALL";
    return next();
  }

  // Quản lý Chi nhánh (MANAGER): Chỉ xem chi nhánh của mình
  if (role === "MANAGER") {
    if (!userBranch) {
      return res.status(403).json({
        message: "Tài khoản Quản lý chưa được gán chi nhánh hoạt động!",
      });
    }

    const requestedBranch = (req.query.branch || "").toUpperCase();
    const branchMapping = {
      CN_CHINH: ["CN_CHINH", "KHO_TONG", "MAIN_BRANCH"],
      CN_1: ["CN_1", "KHO_CN1"],
      CN_2: ["CN_2", "KHO_CN2"],
    };
    const allowed = branchMapping[userBranch] || [userBranch];

    // Nếu cố tình gọi chi nhánh khác chi nhánh mình phụ trách
    if (requestedBranch && requestedBranch !== "ALL" && !allowed.includes(requestedBranch)) {
      return res.status(403).json({
        message: `Truy cập bị từ chối! Bạn chỉ có quyền quản lý và xem dữ liệu chi nhánh ${userBranch}.`,
      });
    }

    // Ép buộc gán chi nhánh vào request
    req.branch = userBranch;
    req.query = Object.assign({}, req.query, { branch: userBranch });
    return next();
  }

  // STAFF hoặc vai trò khác không có quyền xem Dashboard
  return res.status(403).json({
    message: "Bạn không có quyền truy cập dữ liệu báo cáo thống kê!",
  });
};

// 8. Middleware chỉ cho phép Quản lý Tổng (Super Admin)
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Không tìm thấy phiên đăng nhập!" });
  }

  const role = (req.user.role || req.user.mavaitro || "").toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({
      message: "Chỉ Quản lý Tổng (Admin) mới có quyền thực hiện thao tác này!",
    });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isEmployee,
  authorizeRoles,
  requireOrganization,
  requireBranch,
  scopeBranchAccess,
  requireSuperAdmin,
};
