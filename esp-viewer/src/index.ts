import express from "express";
import morgan from "morgan";
import dotenv from "dotenv";
import { Server } from "socket.io";

dotenv.config();

import { logger, LoggerStream } from "./shared";
import routes from "./routes";

import "./mqtt";
import "./db";
import { mqttEvents } from "./mqtt";

const app = express();

app.use(express.static("public"));

app.use(morgan("dev", { stream: new LoggerStream() }));

app.use("/", routes);

const server = app.listen(process.env.PORT || 3000, () =>
    logger.info("Server started")
);

const io = new Server(server);

io.on("connection", socket => {
    logger.debug("Nuovo socket: " + socket.id);
});

mqttEvents.on("data", data => io.emit("data", data));
