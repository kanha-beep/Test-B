// Register authentication and user-management API endpoints.

import { Router } from "express";
import { listUsers, login, me, register, updatePreferences } from "../controllers/authController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.patch("/preferences", requireAuth, asyncHandler(updatePreferences));
router.get("/users", requireAuth, requireAdmin, asyncHandler(listUsers));

export default router;
