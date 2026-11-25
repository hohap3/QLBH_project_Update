const express = require("express");
const router = express.Router();
const ProfileController = require("../controllers/profileController");

// Đường dẫn: GET https://qlbh-project.onrender.com/api/profile/:maND
router.get("/:maND", ProfileController.getProfile);

// Đường dẫn: PUT https://qlbh-project.onrender.com/api/profile/update/:maND
router.put("/update/:maND", ProfileController.updateProfile);

// Đường dẫn: POST https://qlbh-project.onrender.com/api/profile/request-password-otp/:maND
router.post(
  "/request-password-otp/:maND",
  ProfileController.requestPasswordChangeOtp,
);

// Đường dẫn: PUT https://qlbh-project.onrender.com/api/profile/change-password/:maND
router.put("/change-password/:maND", ProfileController.changePassword);

module.exports = router;
