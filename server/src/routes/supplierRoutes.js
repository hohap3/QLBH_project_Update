// src/routes/supplierRoute.js
const express = require("express");
const router = express.Router();
const supplierController = require("../controllers/supplierController");
const { verifyToken, authorizeRoles } = require("../middleware/auth");

// Bảo vệ toàn bộ route Quản lý Nhà cung cấp (Quản trị / Nhân viên)
router.use(verifyToken, authorizeRoles("Admin", "Manager", "Employee", "Staff"));

router.get("/", supplierController.getAllSuppliers);
router.get("/active/list", supplierController.getActiveSuppliers);
router.get("/:id", supplierController.getSupplierById);
router.post("/add", supplierController.createSupplier);
router.put("/update/:id", supplierController.updateSupplier);
router.delete("/delete/:id", supplierController.deleteSupplier);

module.exports = router;
