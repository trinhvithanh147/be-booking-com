const express = require("express");
const userRouter = require("./users.router");
const authRouter = require("./auth.router");

const propertiesRouter = require("./properties.router");
const reviewRouter = require("./review.router");
const roomRouter = require("./room.router");
const bookingRouter = require("./booking.router");
const aiRouter = require("./ai.router");
const conversationRouter = require("./conversations.router");
const messageRouter = require("./messages.router");
const statisticRouter = require("./statistic.router");

const rootRouter = express.Router();

rootRouter.use("/users", userRouter);
rootRouter.use("/auth", authRouter);

rootRouter.use("/properties", propertiesRouter);
rootRouter.use("/review", reviewRouter);
rootRouter.use("/room", roomRouter);
rootRouter.use("/booking", bookingRouter);
rootRouter.use("/ai", aiRouter);
rootRouter.use("/conversations", conversationRouter);
rootRouter.use("/messages", messageRouter);
rootRouter.use("/statistics", statisticRouter);
module.exports = rootRouter;
