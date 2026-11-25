const express = require("express");
const router = express.Router();
const WishlistController = require("../controllers/wishlistController");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

router.get("/", WishlistController.getMyWishlist);
router.post("/toggle", WishlistController.toggleWishlist);
router.post("/merge", WishlistController.mergeWishlist);

module.exports = router;
