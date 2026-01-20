import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import mockrides from "./mockrides.js";
import mockdrivers from "./mockdrivers.js";

dotenv.config(); // load .env variables

const sql = neon(process.env.DATABASE_URL);
const router = Router();
const userRoute = "/user"
const driverRoute = "/driver"
const rideRoute = "/ride"

router.get(userRoute, async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "Email query parameter is required" });

    const user = await sql`
      SELECT * FROM users WHERE email = ${email};
    `;

    if (!user[0]) return res.status(404).json({ error: "User not found" });

    res.json({ data: user[0] });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal Server Error" });
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
    const { user_id, key, value } = req.body;

    if (!user_id || !key) {
      return res.status(400).json({ error: "user_id and key are required" });
    }

    // Ensure column name is safe
    const safeColumn = key; // In production, validate this against allowed columns

    // Check if user exists
    const existingUser = await sql`
      SELECT * FROM users WHERE user_id = ${user_id};
    `;

    let result;
    if (!existingUser[0]) {
      // Insert if not exists
      result = await sql`
        INSERT INTO users (user_id, ${sql.unsafe(safeColumn)})
        VALUES (${user_id}, ${value})
        RETURNING *;
      `;
    } else {
      // Update existing user
      result = await sql`
        UPDATE users
        SET ${sql.unsafe(safeColumn)} = ${value}
        WHERE user_id = ${user_id}
        RETURNING *;
      `;
    }

    res.json({ data: result[0] });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// ====================  DRIVERS DRIVERS DRIVERS =======================================================


router.get(driverRoute, async (req, res) => {
    try {
    //   const drivers = await sql`
    //     SELECT *
    //     FROM users
    //     WHERE account_type = 'driver'
    //       AND verified = true;
    //   `;
  
    //   if (!drivers[0]) {
    //     return res.status(404).json({ error: "No verified drivers found" });
    //   }

    const drivers = mockdrivers;
  
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
  

export default router;
