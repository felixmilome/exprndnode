import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

import apiRoutes from "./api.js";
import setupSocket from "./io.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// REST API
app.use("/api", apiRoutes);

// Use the same HTTP server for Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  path: "/io",          // explicitly set path
  cors: {
    origin: "*",         // change to your frontend URL if needed
    methods: ["GET", "POST"]
  },
  transports: ["websocket"] // more stable on Fly
});

setupSocket(io);

// Listen on Fly port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚗 Uber server running on port ${PORT}`);
});
