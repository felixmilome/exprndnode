// io.js
// 

export default function setupSocket(io) {
  // In-memory storage for connected users
  // Each user: { email, socketId }


  let users = [];
  const userLocations = new Map();

  console.log(users);

  io.on("connection", (socket) => {

    try{

    console.log("New client connected:", socket.id);

    // Register user with email
    socket.on("register_user", (profile) => {
      try{
      const { email, user_id } = profile;
      if (!email) return;

      const existing = users.find((u) => u?.email === email || u.user_id === user_id);
      console.log({existing});
      if (!existing) {
        users.push({ email, socketId: socket.id, user_id: user_id });
      } else {
        existing.socketId = socket.id; // update socket if reconnecting
      }

      console.log("Registered users:", users);
    }catch(error){
        console.log(error)
      }
    }); 

    // Send hello message to a specific user
    socket.on("send_hello", (email) => {
      try{
      const user = users.find((u) => u?.email === email);
     // console.log({user})
      if (user) {
        io.to(user.socketId).emit("hello", `Hello from ${user?.email}!`);
      }
    }catch(error){
      console.log(error);
    }
    });

    socket.on("driverLocation", ({email, data}) => {
      try{
     // console.log(email, data)
      const user = users.find((u) => u?.email === email);
      io.to(user.socketId).emit("driverLocation", data);
      }catch(error){
        console.log(error)
      }
    });

     // LOCATIONS ============================

     // When client updates location
     socket.on("user:location:update", (data) => { 
      try{
      const { user_id, lat, lng, timestamp } = data;
      userLocations.set(user_id, { lat, lng, timestamp });
      console.log({userLocations})
      // Optionally: broadcast to nearby users
      // io.emit("user:location:broadcast", { user_id, lat, lng });
      }catch(error){
        console.log(error);
      }
    });

      // When a client requests a user's location
    socket.on("get:user:location", ({ user_id }, callback) => {
      try{
      const location = userLocations.get(user_id) || null;
      callback(location); // this is your "return" from socket.emit
      }catch(error){
        console.log(error)
      }
    });  

    // accept ride
    socket.on("accept:ride", (ride) => {
      try{

      const user = users.find((u) => u?.email === email || u.user_id === ride?.user_id);
      if (user) {
        io.to(user.socketId).emit("ride:accepted", ride);
      }
    }catch(error){
      console.log(error);
    }
    }); 

    socket.on("reject:ride", (user_id) => {

      try{

      const user = users.find((u) =>  u.user_id === user_id);
      if (user) {
        io.to(user.socketId).emit("ride:rejected", ride);
      }
    }catch(error){
      console.log(error)
    }
    }); 

    socket.on("rider:waiting", (user_id) => {

   try{
      const user = users.find((u) =>  u.user_id === user_id);
      if (user) { 
        io.to(user.socketId).emit("rider:waiting");
      }
    }catch(error){
      console.log(error)
    }


    }); 

    socket.on("on:ride", (user_id) => {
      try{
 
      const user = users.find((u) =>  u.user_id === user_id);
      if (user) {
        io.to(user.socketId).emit("on:ride");
      }
      }catch(error){
        console.log(error);
      }
    });  

    socket.on("ride:completed", (user_id) => {
      try{
  
      const user = users.find((u) =>  u.user_id === user_id);
      if (user) {
        io.to(user.socketId).emit("ride:completed"); 
      }
    }catch(error){
      console.log(error);
    }
    }); 

    // accept ride
    socket.on("request:ride", (ride) => {
      console.log(ride);
      try{
     
      const user = users.find((u) => u?.email === ride?.user?.email || u.user_id === ride?.user_id);
      console.log({user});
      
      if (user) {
        console.log('sending ride req to', user)
        io.to(user.socketId).emit("ride:requested", ride);
      }
      }catch(error){
        console.log(error);
      }
      
    });

    
  

    //Remove user on disconnect
    socket.on("disconnect", () => {
      try{
      console.log("Client disconnected:", socket.id);
      users = users.filter((u) => u.socketId !== socket.id);
      }catch(error){
        console.log(error);
      }

    });

  }catch(error){
      console.log(error)
    }

   
  
  });

  console.log({userLocations})
}
