import { Router } from "express";
import { join } from "path";
import { cwd } from "process";

const router = Router();

router.get("/", (req, res) => {
    res.sendFile(join(cwd(), "index.html"));
});

export default router;
