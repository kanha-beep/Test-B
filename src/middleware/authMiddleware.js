import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

function extractToken(request) {
  const header = request.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }
  return token;
}

function mapUser(user) {
  return {
    _id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role || "user",
    preferredExamTypes: user.preferredExamTypes || []
  };
}

export async function optionalAuth(request, _response, next) {
  const token = extractToken(request);
  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).lean();
    if (user) {
      request.user = mapUser(user);
    }
  } catch {
    // invalid token - ignore
  }

  next();
}

export async function requireAuth(request, response, next) {
  const token = extractToken(request);
  if (!token) {
    return response.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).lean();
    if (!user) {
      return response.status(401).json({ message: "Invalid session" });
    }
    request.user = mapUser(user);
    return next();
  } catch {
    return response.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireAdmin(request, response, next) {
  if (!request.user || request.user.role !== "admin") {
    return response.status(403).json({ message: "Admin access required" });
  }

  return next();
}
