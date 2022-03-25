import { Router } from "express";
import moment from "moment-timezone";
import Db from "../db";
import ExcelJS from "exceljs";
import DataRead from "../models/DataRead";
import { logger } from "../shared";

const router = Router();

router.get("/", async (req, res) => {
    // setTimeout(async () => {
    const { maxResults, fromDate, toDate } = req.query;
    try {
        res.json({
            dataReads: await Db.findDataRead(
                {
                    date: {
                        $lte: toDate || new Date("01/01/2100"),
                        $gte: fromDate || new Date("01/01/1970")
                    }
                },
                "date",
                Number(maxResults) || 100
            )
        });
    } catch (err) {
        logger.error(err);
        res.status(500).json({ err });
    }
    // }, 10000);
});

router.get("/xlsx", async (req, res) => {
    const fileName = `Amella_IoT_Full_Export_${moment()
        .tz("Europe/Rome")
        .format("YYYY_MM_DD_HH_mm_ss")}.xlsx`;

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=" + fileName);

    const workbook = new ExcelJS.Workbook();

    workbook.creator = "Amella";
    workbook.lastModifiedBy = "Amella";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.lastPrinted = new Date();

    workbook.calcProperties.fullCalcOnLoad = true;

    workbook.views = [
        {
            x: 0,
            y: 0,
            width: 10000,
            height: 20000,
            firstSheet: 0,
            activeTab: 1,
            visibility: "visible"
        }
    ];

    const docs = await DataRead.find({}).sort({ date: 1 }).exec();
    const days = [
        ...new Set(docs.map(e => moment(e.date).format("DD-MM-YYYY")))
    ];

    for (const day of days) {
        const ws = workbook.addWorksheet(day);
        ws.columns = [
            { header: "Orario", key: "date" },
            { header: "Temperatura", key: "temp" },
            { header: "Umidita'", key: "hum" },
            { header: "Pressione", key: "pres" }
        ];

        const reads = docs.filter(
            e => moment(e.date).format("DD-MM-YYYY") === day
        );

        for (const read of reads) {
            ws.addRow({
                date: moment(read.date).tz("Europe/Rome").format("HH:mm:ss"),
                // date: read.date,
                temp: read.temp,
                hum: read.hum,
                pres: read.pres / 100
            });
        }
    }

    await workbook.xlsx.write(res);

    res.end();
});

export default router;
