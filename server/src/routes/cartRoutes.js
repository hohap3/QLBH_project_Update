const express = require("express");
const router = express.Router();
const CartController = require("../controllers/cartController");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

router.get("/", CartController.getMyCart);
router.post("/add", CartController.addItem);
router.put("/item/:maSP", CartController.updateItem);
router.delete("/item/:maSP", CartController.removeItem);
router.post("/merge", CartController.mergeCart);

module.exports = router;
