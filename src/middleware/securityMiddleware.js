// Configure reusable security middleware for rate limiting, slowing, and headers.

import hpp from "hpp";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

// Reusable message keeps limiter responses consistent.
const defaultMessage = {
  message: "Too many requests. Please try again in a moment."
};

// Global limiter protects the whole API from bursts and scraping.
// Handle the createGlobalLimiter logic for this module.
export function createGlobalLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (request) => request.path === "/api/health",
    message: defaultMessage
  });
}

// Auth endpoints need a much tighter limit to reduce brute-force attempts.
// Handle the createAuthLimiter logic for this module.
export function createAuthLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: "Too many authentication attempts. Please wait and try again."
    }
  });
}

// Gradually slow repeated auth requests before hard blocking them.
// Handle the createAuthSlowDown logic for this module.
export function createAuthSlowDown() {
  return slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 8,
    delayMs: (hits) => Math.min((hits - 8) * 500, 4000),
    validate: { delayMs: false }
  });
}

// Moderate slow-down on the API helps with bursts without hurting normal use.
// Handle the createApiSlowDown logic for this module.
export function createApiSlowDown() {
  return slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 120,
    delayMs: (hits) => Math.min((hits - 120) * 100, 2000),
    validate: { delayMs: false }
  });
}

// Helmet enables common secure HTTP headers with CSP disabled for this SPA/API mix.
// Handle the createHelmet logic for this module.
export function createHelmet() {
  return helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
  });
}

// HPP prevents query-string parameter pollution attacks.
// Handle the createHpp logic for this module.
export function createHpp() {
  return hpp();
}
