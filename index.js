import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

import apiRoutes from "./api.js";
import setupSocket from "./io.js";

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// REST API
app.use("/api", apiRoutes);

// Socket.IO
const io = new Server(server, {
  cors: { origin: "*" }
});
setupSocket(io);

// Start server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚗 Uber server running on http://localhost:${PORT}`);
});
