import express from "express";
import {  login, register } from "./users.service.js";

const router = express.Router();

router.post("/register", async (request, response) => {
  try {
    const { firstName, lastName, userName ,country,role, email, password } = request.body;
    const { statusCode, data } = await register({
      firstName,
      lastName,
      userName,
      country,
      role,
      email,
      password,
    });
    response.status(statusCode).json(data);
  } catch {
    response.status(500).send("something went wrong");
  }
});

router.post("/login", async (request, response) => {
  try {
    const { email, password } = request.body;
    const { statusCode, data } = await login({ email, password });
    response.status(statusCode).json(data);
  } catch {
    response.status(500).send("something went wrong");
  }
});



export default router;
