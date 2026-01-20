// io.js
export default function setupSocket(io) {
  // In-memory storage for connected users
  // Each user: { email, socketId }
  let users = [];

  console.log(users);
  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Register user with email
    socket.on("register_user", (profile) => {
      const { email } = profile;
      if (!email) return;

      const existing = users.find((u) => u.email === email);
      if (!existing) {
        users.push({ email, socketId: socket.id });
      } else {
        existing.socketId = socket.id; // update socket if reconnecting
      }

      console.log("Registered users:", users);
    }); 

    // Send hello message to a specific user
    socket.on("send_hello", (email) => {
      const user = users.find((u) => u.email === email);
      console.log({user})
      if (user) {
        io.to(user.socketId).emit("hello", `Hello from ${user?.email}!`);
      }
    });

    // Remove user on disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      users = users.filter((u) => u.socketId !== socket.id);
    });
  });
}
