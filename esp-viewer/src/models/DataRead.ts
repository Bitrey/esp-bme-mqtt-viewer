import mongoose, { Document, Schema } from "mongoose";

export interface IDataRead {
    temp: number;
    pres: number;
    hum: number;
    date: Date;
}

export type DataReadDoc = IDataRead & Document;

const dataReadSchema = new Schema<IDataRead>({
    temp: { type: Number, required: true },
    pres: { type: Number, required: true },
    hum: { type: Number, required: true },
    date: { type: Date, required: true, default: Date.now }
});

export function isValidDataRead(
    data: unknown
): data is Omit<IDataRead, "date"> {
    if (!data || typeof data !== "object") return false;

    const obj = data as IDataRead;
    return (
        typeof obj.temp === "number" &&
        typeof obj.pres === "number" &&
        typeof obj.hum === "number"
        // obj.date instanceof Date
    );
}

const DataRead = mongoose.model<IDataRead>("DataRead", dataReadSchema);
export default DataRead;
