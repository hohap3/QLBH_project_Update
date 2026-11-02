// src/controllers/thongKeController.js
const ThongKeModel = require("../models/thongKeModel");

const ThongKeController = {
  getStatsCategory: async (req, res) => {
    try {
      const branch = req.branch || req.query?.branch;
      const data = await ThongKeModel.getSanPhamTheoDanhMuc(branch);
      res.status(200).json({
        success: true,
        data: data,
      });
    } catch (error) {
      console.error("Lỗi lấy thống kê danh mục:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy dữ liệu biểu đồ danh mục",
      });
    }
  },

  getDashboardOverview: async (req, res) => {
    try {
      const branch = req.branch || req.query?.branch;
      const stats = await ThongKeModel.getQuickStats(branch);
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("CHI TIẾT LỖI OVERVIEW:", error.message);
      res.status(500).json({
        success: false,
        message:
          "Lỗi hệ thống khi lấy số liệu tổng quan kèm so sánh tăng trưởng",
      });
    }
  },

  getTopProducts: async (req, res) => {
    try {
      const branch = req.branch || req.query?.branch;
      const data = await ThongKeModel.getTopSellingProducts(branch);

      const formattedData = data.map((item) => ({
        label: item.label,
        totalQty: item.totalqty,
        totalRevenue: item.totalrevenue,
      }));

      res.status(200).json({ success: true, data: formattedData });
    } catch (error) {
      console.error("Lỗi lấy top sản phẩm:", error);
      res
        .status(500)
        .json({ success: false, message: "Lỗi hệ thống khi lấy top sản phẩm" });
    }
  },

  getMonthlyStats: async (req, res) => {
    try {
      const branch = req.branch || req.query?.branch;
      const dbData = await ThongKeModel.getOrdersByMonth(branch);
      const currentMonth = new Date().getMonth() + 1;

      const formattedData = Array.from({ length: currentMonth }, (_, index) => {
        const monthNum = index + 1;
        const matched = dbData.find((item) => Number(item.month) === monthNum);
        return {
          label: `T${monthNum}`,
          value: matched ? parseInt(matched.ordercount) : 0,
        };
      });

      res.status(200).json({ success: true, data: formattedData });
    } catch (error) {
      console.error("Lỗi lấy thống kê đơn hàng theo tháng:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy thống kê đơn hàng theo tháng",
      });
    }
  },

  getMonthlyRevenue: async (req, res) => {
    try {
      const branch = req.branch || req.query?.branch;
      const dbData = await ThongKeModel.getRevenueByMonth(branch);
      const currentMonth = new Date().getMonth() + 1;

      const formattedData = Array.from({ length: currentMonth }, (_, index) => {
        const monthNum = index + 1;
        const matched = dbData.find((item) => Number(item.month) === monthNum);
        return {
          label: `T${monthNum}`,
          value: matched ? parseFloat(matched.totalrevenue) : 0,
        };
      });

      res.status(200).json({
        success: true,
        data: formattedData,
      });
    } catch (error) {
      console.error("Lỗi lấy thống kê doanh thu theo tháng:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy thống kê doanh thu theo tháng",
      });
    }
  },

  getCustomerAnalytics: async (req, res) => {
    try {
      const branch = req.branch || req.query?.branch;
      const data = await ThongKeModel.getCustomerAnalytics(branch);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("Lỗi lấy Customer Analytics:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy phân tích khách hàng",
      });
    }
  },

  getInventoryAnalytics: async (req, res) => {
    try {
      const branch = req.branch || req.query?.branch;
      const data = await ThongKeModel.getInventoryAnalytics(branch);
      res.status(200).json({ success: true, data });
    } catch (error) {
      console.error("Lỗi lấy Inventory Analytics:", error);
      res.status(500).json({
        success: false,
        message: "Lỗi hệ thống khi lấy phân tích kho hàng",
      });
    }
  },
};

module.exports = ThongKeController;
