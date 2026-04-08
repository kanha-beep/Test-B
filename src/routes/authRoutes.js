// Register authentication and user-management API endpoints.

import { Router } from "express";
import { listUsers, login, me, register, updatePreferences } from "../controllers/authController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);
router.patch("/preferences", requireAuth, updatePreferences);
router.get("/users", requireAuth, requireAdmin, listUsers);

export default router;
