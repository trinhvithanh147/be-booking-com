const express = require("express");
const statisticController = require("../controllers/statistic.controller");

const statisticRouter = express.Router();

statisticRouter.get("/admin", statisticController.getAdminStatistics);

module.exports = statisticRouter;
