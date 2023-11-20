import express, { Application } from "express";
import Server from "./src/index";
import dotenv from 'dotenv';
import { initBot } from "./src/telegram";

dotenv.config();

const app: Application = express();
const server: Server = new Server(app);
const PORT: number = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;

initBot()

app.get('/', (req, res) => {
  res.send('hello world')
})

app
  .listen(PORT, "localhost", function () {
    console.log(`Server is running on port ${PORT}.`);
  })
  .on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.log("Error: address already in use");
    } else {
      console.log(err);
    }
  });
