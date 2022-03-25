import mongoose, { FilterQuery } from "mongoose";
import DataRead, { IDataRead } from "../models/DataRead";
import { logger } from "../shared/logger";

if (!process.env.MONGOOSE_URI) throw new Error("No MONGOOSE_URI env");

export default class Db {
    private static _staticConstructor = (() => {
        mongoose.connect(
            process.env.MONGOOSE_URI as string,
            { connectTimeoutMS: 1000 * 10 },
            err =>
                err ? logger.error(err) : logger.info("Connected to MongoDB")
        );
    })();

    public static async saveDataRead(
        dataRead: IDataRead | Omit<IDataRead, "date">
    ) {
        return await DataRead.create(dataRead);
    }

    public static async findDataRead(
        filter: FilterQuery<IDataRead> = {},
        sort = "date",
        limit = 100,
        skip = 0
    ) {
        return await DataRead.find(filter)
            .limit(limit)
            .sort({ [sort]: -1 })
            .skip(skip)
            .exec();
    }
}
