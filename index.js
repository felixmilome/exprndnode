import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

import apiRoutes from "./api.js";
import setupSocket from "./io.js";
import os from "os";

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// REST API
app.use("/api", apiRoutes);

// Socket.IO
// Socket.IO
const io = new Server(server, {
  cors: { origin: "*" }
});
setupSocket(io);

// Start server
const PORT = 3000;
 
//local

server.listen(PORT, "0.0.0.0", () => {
  const ifaces = os.networkInterfaces();

  console.log("🚗 Server listening on:");

  // Loop through all network interfaces
  for (const ifaceList of Object.values(ifaces)) {
    ifaceList?.forEach((iface) => {
      // Only IPv4 and non-internal addresses
      if (iface.family === "IPv4" && !iface.internal) {
        console.log(`http://${iface.address}:${PORT}`);
      }
    });
  }
});

//live
// server.listen(PORT, () => {
//   console.log(`🚗 Uber server running on http://localhost:${PORT}`);
// });

