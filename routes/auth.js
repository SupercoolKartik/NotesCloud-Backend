import express, { application } from "express";
import { Router } from "express";
import User from "../models/User.js";
import { body, validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fetchuser from "../middleware/fetchuser.js";

const secSign = process.env.SECRET_SIGN;

import bcrypt from "bcrypt";

const router = express.Router();

//ROUTE 1: Create a User using POST api/auth/createuser, (No login required)
router.post(
  "/createuser",
  [
    //Validation Checks
    body("username", "Username must be atleast 3 characters long!").isLength({
      min: 3,
    }),
    body("email", "Enter a valid email!").isEmail(),
    body("password", "Password is required!").isLength({ min: 5 }),
  ],
  async (req, res) => {
    let success = false;
    try {
      const result = validationResult(req);
      ////If there are no errors
      if (result.isEmpty()) {
        //Logic to find out if a user with same email already exists
        let user = await User.findOne({ email: req.body.email }).exec();
        if (user) {
          //400 Bad Request
          return res.status(400).json({ error: "Email is not unique!" });
        }

        // Hashing the password
        const saltRounds = 10;
        const hashedPass = await bcrypt.hash(req.body.password, saltRounds);

        //Creating a new user
        user = await User.create({
          username: req.body.username,
          email: req.body.email,
          password: hashedPass,
        });

        //Sending the Authorisation Token to the user
        const tokenData = {
          user: {
            name: user.username,
            id: user.id,
          },
        };
        const authToken = jwt.sign(tokenData, secSign);
        success = true;
        res.json({ success, authToken });
      }

      ////If there are Validtion errors
      else {
        // 400 Bad Request
        res.status(400).json({ errors: result.array() });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

//ROUTE 2: User Authentication using POST api/auth/login, (No login required)
router.post(
  "/login",
  [
    body("email", "Enter a valid email!").isEmail(),
    body("password", "Password must be at least 5 characters long!").isLength({
      min: 5,
    }),
  ],
  async (req, res) => {
    let success = false;
    try {
      const result = validationResult(req);
      if (result.isEmpty()) {
        let user = await User.findOne({ email: req.body.email }).exec();
        if (!user) {
          //404 User Not Found
          return res.status(404).json({ error: "User not found." });
        }

        const tokenData = {
          user: {
            name: user.username,
            id: user.id,
          },
        };
        const authToken = jwt.sign(tokenData, secSign);
        // Comparing the passwords
        const compareResult = await bcrypt.compare(
          req.body.password,
          user.password
        );

        if (!compareResult) {
          return res.status(401).json({ error: "Passwords don't match!" });
        } else {
          success = true;
          return res.json({
            success,
            msg: "User verified successfully!",
            authToken,
          });
        }
      } else {
        //400 Bad Request
        return res.status(400).json({ errors: result.array() });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: "Internal Server Error" });
    }
  }
);

//ROUTE 3: Fetch Logged in user's data, (Login required)
router.get("/getuserdata", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    res.json(user);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
