import mqtt from "mqtt";
import { EventEmitter } from "events";
import Db from "../db";
import { DataReadDoc, IDataRead, isValidDataRead } from "../models/DataRead";
import { logger } from "../shared";

declare interface MqttEvents {
    on(event: "data", listener: (dataReadDoc: DataReadDoc) => void): this;
    on(event: string, listener: Function): this;
}
class MqttEvents extends EventEmitter {}

export const mqttEvents = new MqttEvents();

const client = mqtt.connect(
    process.env.MQTT_BROKER || "mqtt://mqtt.ssh.edu.it"
);

const dataTopic = "amella/esp32/data";

// Buffer
let lastData: IDataRead | null = null;

// Implement getters in order to copy by ref and not by value
// returning the actual latest value
export function getLastData() {
    return lastData;
}

client.on("connect", () => {
    client.subscribe(dataTopic, err => {
        if (err) return logger.error(err);
        logger.info("Subscribed to " + dataTopic);
    });
});

client.on("message", async (topic, msgBuf) => {
    const msg = msgBuf.toString();

    logger.info(`MQTT message "${msg}" on topic "${topic}"`);

    if (topic === dataTopic) {
        let data: Omit<IDataRead, "date">;
        try {
            data = JSON.parse(msg);
            if (!isValidDataRead(data)) {
                throw new Error("Invalid data");
            }

            const dataDB = await Db.saveDataRead(data);
            lastData = dataDB.toObject();

            mqttEvents.emit("data", dataDB.toObject());

            logger.debug("Data read saved to DB");
        } catch (err) {
            logger.error("Error while parsing data:");
            logger.error(err);
        }
    }
    // client.end();
});

client.on("error", err => {
    logger.error("MQTT connection error");
    logger.error(err);

    if (client.disconnected && !client.reconnecting) {
        logger.info("Reconnecting in 5 seconds...");
        setTimeout(client.reconnect, 5000);
    }
    // process.exit(1);
});
