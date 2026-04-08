// Handle signup, login, profile lookup, preference saving, and admin user listing.

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

// Handle the signToken logic for this module.
function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: "30d" });
}

// Handle the sanitizeExamPreferences logic for this module.
function sanitizeExamPreferences(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

// Handle the serializeUser logic for this module.
function serializeUser(user) {
  return {
    _id: user._id,
    email: user.email,
    displayName: user.displayName,
    role: user.role || "user",
    preferredExamTypes: user.preferredExamTypes || []
  };
}

// Create a new user account and return a signed auth token.
export async function register(request, response) {
  const email = request.body?.email?.trim().toLowerCase();
  const password = request.body?.password;
  const displayName = request.body?.displayName?.trim();
  const preferredExamTypes = sanitizeExamPreferences(request.body?.preferredExamTypes);

  if (!email || !password || !displayName) {
    return response.status(400).json({ message: "Email, password, and display name are required" });
  }
  if (password.length < 6) {
    return response.status(400).json({ message: "Password must be at least 6 characters" });
  }
  const existing = await User.findOne({ email });
  if (existing) {
    return response.status(409).json({ message: "An account with this email already exists" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    email,
    passwordHash,
    displayName,
    preferredExamTypes,
    role: "user"
  });
  const token = signToken(user._id);

  return response.status(201).json({
    token,
    user: serializeUser(user)
  });
}

// Validate credentials and return a signed auth token for the user.
export async function login(request, response) {
  console.log("1. Login start: ", request.body);
  const email = request.body?.email?.trim().toLowerCase();
  const password = request.body?.password;

  if (!email || !password) {
    return response.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return response.status(401).json({ message: "Invalid email or password" });
  }
  console.log("2. Found User: ", user)
  // Support the current passwordHash field and fail safely if older records are malformed.
  const credentialHash = typeof user.passwordHash === "string" && user.passwordHash.trim() ? user.passwordHash : typeof user.password === "string" && user.password.trim() ? user.password : null;
  console.log("3. Pass match: ", credentialHash)
  if (!credentialHash) {
    return response.status(401).json({ message: "Invalid email or password" });
  }
  console.log("3. Pass match: ", credentialHash)
  const match = await bcrypt.compare(password, credentialHash);
  if (!match) {
    return response.status(401).json({ message: "Invalid email or password" });
  }

  const token = signToken(user._id);

  return response.json({
    token,
    user: serializeUser(user)
  });
}

// Return the currently authenticated user profile.
export async function me(request, response) {
  return response.json({ user: request.user });
}

// Save the preferred exam categories for the authenticated user.
export async function updatePreferences(request, response) {
  const preferredExamTypes = sanitizeExamPreferences(request.body?.preferredExamTypes);
  const user = await User.findByIdAndUpdate(
    request.user._id,
    { preferredExamTypes },
    { new: true }
  ).lean();

  return response.json({ user: serializeUser(user) });
}

// Return the user list for admin dashboard management.
export async function listUsers(_request, response) {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .select("displayName email role preferredExamTypes createdAt")
    .lean();

  return response.json(
    users.map((user) => ({
      _id: user._id,
      displayName: user.displayName,
      email: user.email,
      role: user.role || "user",
      preferredExamTypes: user.preferredExamTypes || [],
      createdAt: user.createdAt
    }))
  );
}

