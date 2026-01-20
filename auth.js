// auth.js
import jwt from "jsonwebtoken";

const SECRET_KEY = "supersecretkey"; // in prod, use process.env.JWT_SECRET

export function generateToken(payload) {
  return jwt.sign(payload, SECRET_KEY);
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user; 
    next();
  });
}
