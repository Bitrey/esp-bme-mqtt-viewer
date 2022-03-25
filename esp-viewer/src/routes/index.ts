import { Router } from "express";

import frontendRoutes from "./frontend";
import apiRoutes from "./api";

const router = Router();

router.use("/", frontendRoutes);
router.use("/api", apiRoutes);

export default router;
