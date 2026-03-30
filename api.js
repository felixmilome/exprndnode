import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import mockrides from "./mockrides.js";
import mockdrivers from "./mockdrivers.js";
import { isSafeIdentifier } from "./functions.js";

dotenv.config(); // load .env variables


const sql = neon(process.env.AHC_DATABASE_URL);
const router = Router();
const authRoute = "/auth"
const userRoute = "/user"
const driverRoute = "/driver"
const rideRoute = "/ride"
const reviewsRoute = "/reviews" 
const locationRoute = "/location"
const messagesRoute = "/messages"  


// login

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;
// const OTP_SECRET = process.env.OTP_SECRET;

router.post(authRoute + "/signup", async (req, res) => {
  try {
    const { email, password, account_type, hospital_name, name, hospital_code } = req.body;
    console.log(req.body);  
 
    //1. Validate body
    if (!email?.length>0 || !password?.length>0 || !name?.length>0 || account_type === undefined) {
      return res.status(201).json({ success:false, message: "email, password and account_type are required" });
    }
 
    if (account_type === 2 && !hospital_name?.length>0) {
      return res.status(201).json({ success:false, message: "Hospital name is required" });
    }

    // // 2. Check if email exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email};
    `;

    // 3. If exists return error
    if (existingUser.length > 0) {
      return res.status(201).json({
        message: `Account ${email} already exists`,
        success:false,
        statuscode: 409
      });
    }

    // 4. Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // 5. Create 5 character hexadecimal OTP
   const otp = crypto.randomBytes(3).toString("hex").slice(0, 5).toUpperCase(); // e.g. "A3F9C"

    // 6. Sign OTP JWT (for verification later)
    const otp_token = jwt.sign({ email }, otp, { expiresIn: "10m" });

    // 7. Store user in users table
    const insertedUser = await sql`
      INSERT INTO users (email, name, password_hash, account_type, otp_token)
      VALUES (${email}, ${name}, ${password_hash}, ${account_type}, ${otp_token})
      RETURNING id, email;
    `;

    const user = insertedUser[0];

    // 8 & 9 & 10. Create related records based on account_type
    if (account_type === 2) {
      // Hospital account
      await sql`
        INSERT INTO hospitals (user_id, name)
        VALUES (${user.id}, ${hospital_name});
      `;
    } else if (account_type === 1) {
      // Sample collector account
        if (hospital_code?.length > 0) {
          const hosId = parseInt(hospital_code, 10)
          await sql`
              INSERT INTO ambulances (user_id, hospital_id)
              VALUES (${user.id}, ${hosId});
            `;
          } else {
            await sql`
              INSERT INTO ambulances (user_id)
              VALUES (${user.id});
            `;
          }
    }
    // account_type 0 => do nothing
  
    // 11. Send Email OTP (placeholder)
    // TODO: integrate nodemailer / resend / sendgrid
    console.log(`OTP for ${email}: ${otp}`);

    // 12. Create session token (NOT stored in DB) NOT USED UNTIL VERIFY
    // const session_token = jwt.sign(
    //   { user_id: user.id, email: user.email, account_type },
    //   JWT_SECRET,
    //   // { expiresIn: "7d" }
    // );

    // 13. Return response
    return res.status(201).json({
      success:true, 
      email: user.email,
      //session_token,
      statuscode: 201
    });

  } catch (error) {
    console.error("Signup error:", error);
    return res.status(201).json({
      error: "Internal Server Error",
      success:false,
      message:"Internal Server Error"
    });
  }
});

router.post(authRoute + "/verify-signup", async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Validate input
    if (!email?.length>0 || !otp?.length>0) {
      return res.status(201).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // 2. Fetch user by email
    const users = await sql`
      SELECT id, email, account_type, otp_token FROM users WHERE email = ${email};
    `;

    if (users.length === 0) {
      return res.status(201).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    // 3. Verify OTP JWT
    try {
      // jwt.verify throws if invalid or expired
      jwt.verify(user.otp_token, otp); // OTP is used as the secret
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(201).json({
          success: false,
          message: "OTP expired",
        });
      } else if (err.name === "JsonWebTokenError") {
        return res.status(201).json({
          success: false,
          message: "Invalid OTP",
        });
      } else {
        return res.status(201).json({
          success: false,
          message: "OTP verification failed",
        });
      }
    }

    // 4. Create session JWT
    const session_token = jwt.sign(
      { user_id: user.id, email: user.email, account_type: user.account_type },
      JWT_SECRET
    );

    // 5. Optionally, you can delete or invalidate OTP token from DB here
    await sql`
      UPDATE users SET otp_token = NULL WHERE id = ${user.id};
    `;

    // 6. Return success
    return res.status(201).json({
      success: true,
      message: "OTP verified successfully",
      session_token,
      email:user?.email
    });
  } catch (error) {
    console.error("OTP verify error:", error);
    return res.status(201).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});

router.post(authRoute + "/login", async (req, res) => { 
  try {
    const { email, password } = req.body;
    console.log(req.body)

    // 1. Validate input
    if (!email?.length || !password?.length) {
      return res.status(201).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // 2. Fetch user by email
    const users = await sql`
      SELECT id, email, password_hash, account_type FROM users WHERE email = ${email};
    `;
    console.log({users})

    if (users.length === 0) {
      return res.status(201).json({
        success: false,
        message: "Wrong Credentials",
      });
    }

    const user = users[0];

    // 3. Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(201).json({
        success: false,
        message: "Invalid Credentials",
      });
    }

    // 4. Create session JWT
    const session_token = jwt.sign(
      { user_id: user.id, email: user.email, account_type: user.account_type },
      JWT_SECRET
    );
 

    // 5. Return success
    return res.status(201).json({
      success: true,
      message: "Login successful",
      email: user.email,
      session_token,
      statuscode: 201,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(201).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});


router.post(authRoute + "/change-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);  
 
    //1. Validate body
    if (!email?.length>0 || !password?.length>0 ) {
      return res.status(201).json({ success:false, message: "email, password and account_type are required" });
    }


    // // 2. Check if email exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email};
    `;

    // 3. If exists return error
    if (!existingUser.length > 0) {
      return res.status(201).json({
        message: `Account ${email} doesn't exists`,
        success:false,
        statuscode: 409
      });
    }

    // 4. Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // 5. Create 5 character hexadecimal OTP
   const otp = crypto.randomBytes(3).toString("hex").slice(0, 5).toUpperCase(); // e.g. "A3F9C"

    // 6. Sign OTP JWT (for verification later)
    const otp_token = jwt.sign({ email, password_hash }, otp, { expiresIn: "10m" });

    // 7. Store user in users table
    const updatedUser = await sql`
      UPDATE users
      SET otp_token = ${otp_token}
      WHERE email = ${email}
      RETURNING id, email;
    `;

    const user = updatedUser[0];


    console.log(`OTP for ${email}: ${otp}`);


    // 13. Return response
    return res.status(201).json({
      success:true, 
      email: user.email,
      //session_token,
      statuscode: 201
    });

  } catch (error) {
    console.error("Signup error:", error);
    return res.status(201).json({
      error: "Internal Server Error",
      success:false,
      message:"Internal Server Error"
    });
  }
});

router.post(authRoute + "/verify-password", async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Validate input
    if (!email || !otp) {
      return res.status(201).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // 2. Fetch user by email
    const users = await sql`
      SELECT id, email, otp_token FROM users WHERE email = ${email};
    `;

    if (users.length === 0) {
      return res.status(201).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    if (!user.otp_token) {
      return res.status(201).json({
        success: false,
        message: "No OTP request found",
      });
    }

    let decoded;

    // 3. Verify OTP + decode token
    try {
      decoded = jwt.verify(user.otp_token, otp); 
      // payload should contain { password_hash }
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(201).json({
          success: false,
          message: "OTP expired",
        });
      }

      return res.status(201).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const password_hash = decoded && decoded.password_hash;

    if (!password_hash) {
      return res.status(201).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    // 4. Update password + clear OTP
    await sql`
      UPDATE users
      SET password_hash = ${password_hash},
          otp_token = NULL
      WHERE id = ${user.id};
    `;

    // 5. Success
    return res.status(201).json({
      success: true,
      message: "Password updated successfully",
      email: user.email
    });

  } catch (error) {
    console.error("Verify-password error:", error);
    return res.status(201).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});
 

router.get(userRoute, async (req, res) => {
  try {
    const email = req.query.email;

    if (!email || !email.length) {
      return res.status(400).json({
        success: false,
        message: "Email query parameter is required",
      });
    }

    // 1️⃣ Fetch user (only safe fields)
    const users = await sql`
      SELECT 
        id,
        email,
        phone,
        created_at,
        image_slug,
        conduct_image_slug,
        id_image_slug,
        account_type,
        name,
        rating
      FROM users
      WHERE email = ${email};
    `;

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    // 2️⃣ account_type 0 → just user
    if (user.account_type === 0) {
      return res.json({
        success: true,
        data: { user },
      });
    }

    // 3️⃣ account_type 1 → ambulance
 if (user.account_type === 1) {
  const ambulances = await sql`
    SELECT * FROM ambulances
    WHERE user_id = ${user.id};
  `;

  const ambulance = ambulances[0] || null;

  let hospital = null;

      if (ambulance?.hospital_id) {
        const hospitals = await sql`
          SELECT * FROM hospitals
          WHERE id = ${ambulance.hospital_id};
        `;
        hospital = hospitals[0] || null;
      }

      return res.json({
        success: true,
        data: {
          user,
          ambulance,
          hospital,
        },
      });
    }

    // 4️⃣ account_type 2 → hospital
    if (user.account_type === 2) {
      const hospitals = await sql`
        SELECT *
        FROM hospitals
        WHERE user_id = ${user.id};
      `;

      return res.json({
        success: true,
        data: {
          user,
          hospital: hospitals[0] || null,
        },
      });
    }

  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
});
router.post(userRoute, async (req, res) => {
  try {
    const { name, email, clerkId } = req.body;

    if (!name || !email || !clerkId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const response = await sql`
      INSERT INTO users (name, email, clerk_id)
      VALUES (${name}, ${email}, ${clerkId})
      RETURNING *;
    `;

    res.status(201).json({ data: response[0] });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch(userRoute, async (req, res) => {
  try {
    const { id, key, value, type } = req.body;

    if (!id || !key || type === undefined) {
      return res.status(400).json({ error: "id, key and type are required" });
    }

    // Map type to table
    let tableName;
    switch (Number(type)) {
      case 0: tableName = "users"; break;
      case 1: tableName = "ambulances"; break;
      case 2: tableName = "hospitals"; break;
      default: return res.status(400).json({ error: "Invalid type" });
    }

    // Sanitize column/table names
    if (!isSafeIdentifier(tableName) || !isSafeIdentifier(key)) {
      return res.status(400).json({ error: "Invalid table or column name" });
    }

    // Check if record exists
    const existing = await sql`
      SELECT * FROM ${sql.unsafe(tableName)}
      WHERE id = ${id};
    `;

    let result;
    if (!existing[0]) {
      // Insert if not exists
      result = await sql`
        INSERT INTO ${sql.unsafe(tableName)} (id, ${sql.unsafe(key)})
        VALUES (${id}, ${value})
        RETURNING *;
      `;
    } else {
      // Update existing
      result = await sql`
        UPDATE ${sql.unsafe(tableName)}
        SET ${sql.unsafe(key)} = ${value}
        WHERE id = ${id}
        RETURNING *;
      `;
    }

    res.json({ data: result[0] });

  } catch (error) {
    console.error("Error updating record:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ====================  DRIVERS DRIVERS DRIVERS =======================================================


router.get(driverRoute, async (req, res) => {
    try {
      const drivers = await sql`
            SELECT 
              u.id,
              u.email,
              u.phone,
              u.image_slug,
              u.account_type,
              u.name,
              u.id_image_slug,
              u.conduct_image_slug,
              u.rating,
              u.created_at,
              u.current_latitude,
              u.current_longitude,
              u.current_address,

              jsonb_strip_nulls(
                jsonb_build_object(
                  'id', a.id,
                  'profession', a.profession,
                  'vehicle_type', a.vehicle_type,
                  'user_id', a.user_id,
                  'number_plate', a.number_plate,
                  'colour', a.colour,
                  'model', a.model,
                  'description', a.description,
                  'current_latitude', u.current_latitude,
                  'current_longitude', u.current_longitude,
                  'status', a.status,
                  'hospital_id', a.hospital_id,
                  'hospital_name', h.name,   -- will be null if hospital not found
                  'verified', a.verified,
                  'id_image_slug', a.id_image_slug,
                  'rating', a.rating,
                  'created_at', a.created_at
                )
              ) AS ambulance_data

            FROM users u
            JOIN ambulances a ON u.id = a.user_id
            LEFT JOIN hospitals h ON a.hospital_id = h.id;
          `;
      
  
      if (!drivers[0]) {
        return res.status(404).json({ error: "No verified drivers found" });
      }
 
     //const drivers = mockdrivers;
    // console.log('dere'); 
   // console.log({drivers});
  
      res.json({ data: drivers });
    } catch (error) {
      console.error("Error fetching verified drivers:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

 

  // RIDES ===================================================================

  router.get(rideRoute + "/:id", async (req, res) => {
    const userId = req.params.id;
  
    if (!userId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
  
    try {
      // const rides = await sql `SELECT * from rides WHERE rides.user_id = ${userId} 
      // ORDER BY rides.created_at DESC;`
      // const rides = await sql`
      //   SELECT 
      //       rides.ride_id,
      //       rides.origin_address,
      //       rides.destination_address,
      //       rides.origin_latitude,
      //       rides.origin_longitude,
      //       rides.destination_latitude,
      //       rides.destination_longitude,
      //       rides.ride_time,
      //       rides.fare_price,
      //       rides.payment_status,
      //       rides.created_at,
      //       'driver', json_build_object(
      //           'driver_id', drivers.id,
      //           'first_name', drivers.first_name,
      //           'last_name', drivers.last_name,
      //           'profile_image_url', drivers.profile_image_url,
      //           'car_image_url', drivers.car_image_url,
      //           'car_seats', drivers.car_seats,
      //           'rating', drivers.rating
      //       ) AS driver
      //   FROM rides
      //   INNER JOIN drivers ON rides.driver_id = drivers.id
      //   WHERE rides.user_id = ${userId}
      //   ORDER BY rides.created_at DESC;
      // `;
  
      // if (!rides[0]) {
      //   return res.status(404).json({ error: "No rides found for this user" });
      // }

       const rides = mockrides
  
      res.json({ data: rides });
    } catch (error) {
      console.error("Error fetching recent rides:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }); 
  
router.post(rideRoute, async (req, res) => {
  try {
    const ride = req.body;

    if (!ride) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Prepare DB object by removing frontend-only nested fields and id
    const dbRide = (({ client_data, driver_data, id, ...rest }) => rest)(ride);

    const keys = Object.keys(dbRide);
    const values = Object.values(dbRide);

    // Create placeholders $1, $2, ...
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

    // Build update string fodr conflict (exclude primary key if needed)
    const updates = keys.map((key, i) => `${key} = $${i + 1}`).join(", ");

    // Assuming 'id' is your unique identifier
    const query = `
      INSERT INTO rides (${keys.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE
      SET ${updates}
      RETURNING *;
    `;

    const response = await sql.query(query, values);

    return res.status(201).json({ data: response[0] });
  } catch (error) {
    console.error("Error creating/updating ride:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

  router.patch(rideRoute, async (req, res) => {
    try {
      const { ride_id, key, value } = req.body;
  
      if (!ride_id || !key) {
        return res.status(400).json({ error: "ride_id and key are required" });
      }
  
      // Ensure column name is safe
      const safeColumn = key; // In production, validate this against allowed columns
  
      // Check if user exists
      const existingRide = await sql`
        SELECT * FROM rides WHERE ride_id = ${ride_id};
      `;
  
      let result;
      if (!existingRide[0]) {
        // Insert if not exists
        result = await sql`
          INSERT INTO rides (ride_id, ${sql.unsafe(safeColumn)})
          VALUES (${ride_id}, ${value})
          RETURNING *;
        `;
      } else {
        // Update existing ride
        result = await sql`
          UPDATE rides
          SET ${sql.unsafe(safeColumn)} = ${value}
          WHERE ride_id = ${ride_id}
          RETURNING *;
        `;
      }
      res.json({ data: result[0] });
    }catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });


  //REVIEWS ++++++++++++++++++++++++

router.post(reviewsRoute, async (req, res) => {
  try {
    const review = req.body;

    const requiredFields = ["ride_id", "rating", "comment", "rater_id", "rated_id"];
    for (const field of requiredFields) {
      if (!review[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    // Dynamically remove any frontend-only fields if needed
    const dbReview = (({ id, ...rest }) => rest)(review);

    const keys = Object.keys(dbReview);
    const values = Object.values(dbReview);
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");

    const query = `
      INSERT INTO reviews (${keys.join(", ")})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const response = await sql.query(query, values);

    return res.status(201).json({ data: response[0] });
  } catch (error) {
    console.error("Error inserting review:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Location ======================================
  
 router.post(locationRoute + "/update", async (req, res) => {
  try {
    const { user_id, deviceLocation } = req.body;
    //console.log({user_id, deviceLocation})

    if (!user_id || !deviceLocation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { latitude, longitude, address } = deviceLocation;

    const response = await sql`
      UPDATE users
      SET 
        current_latitude = ${latitude},
        current_longitude = ${longitude},
        current_address = ${address}
      WHERE id = ${user_id}
      RETURNING *;
    `;

    res.status(200).json({ data: response[0] });

  } catch (error) {
    console.error("Error updating user location:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// MESSAGES ================================================

router.post("/messages", async (req, res) => {
  try {
    const {
      ride_id,
      sender_id,
      receiver_id,
      text,
      type = 0,
    } = req.body;

    // Basic validation
    if (!ride_id || !sender_id || !receiver_id || !text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Check if chat already exists for this ride
    const chatResult = await sql.query(
      `SELECT * FROM chats WHERE ride_id = $1 LIMIT 1`,
      [ride_id]
    );

    let chat;

    // 2. If chat exists, use it
    if (chatResult.length > 0) {
      chat = chatResult[0];
    } 
    // 3. Otherwise create a new chat
    else {
      const newChatResult = await sql.query(
        `INSERT INTO chats (participant_one_id, participant_two_id, ride_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [sender_id, receiver_id, ride_id]
      );

      chat = newChatResult[0];
    }

    // 4. Insert message with chat_id
    const messageResult = await sql.query(
      `INSERT INTO messages 
        (chat_id, sender_id, receiver_id, text, type, ride_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [chat.id, sender_id, receiver_id, text, type, ride_id]
    );

    return res.status(201).json({
      message: messageResult[0],
    });

  } catch (error) {
    console.error("Error creating message:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
