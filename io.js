// io.js
export default function setupSocket(io) {
  // In-memory storage for connected users
  // Each user: { email, socketId }
  let users = [];
  const userLocations = new Map();

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

    socket.on("driverLocation", ({email, data}) => {
     // console.log(email, data)
      const user = users.find((u) => u.email === email);
      io.to(user.socketId).emit("driverLocation", data);
    });

     // LOCATIONS ============================

     // When client updates location
     socket.on("user:location:update", (data) => {
      const { user_id, lat, lng, timestamp } = data;
      userLocations.set(user_id, { lat, lng, timestamp });
      // Optionally: broadcast to nearby users
      // io.emit("user:location:broadcast", { user_id, lat, lng });
    });

      // When a client requests a user's location
    socket.on("get:user:location", ({ user_id }, callback) => {
      const location = userLocations.get(user_id) || null;
      callback(location); // this is your "return" from socket.emit
    });

    // accept ride
    socket.on("accept:ride", (ride) => {
      console.log("Client disconnected:", socket.id);
      const user = users.find((u) => u.email === email || u.user_id === ride?.user_id);
      if (user) {
        io.to(user.socketId).emit("ride:accepted", ride);
      }
    });

    // accept ride
    socket.on("request:ride", (ride) => {
      console.log("Client disconnected:", socket.id);
      const user = users.find((u) => u.email === email || u.user_id === ride?.user_id);
      if (user) {
        io.to(user.socketId).emit("ride:requested", ride);
      }
    });
  

    // Remove user on disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      users = users.filter((u) => u.socketId !== socket.id);

    });

 

   
  
  });
}
