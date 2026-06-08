const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const passport = require("passport");

const app = express();

const rootRouter = require("./src/routes/rootRouter.router");
const { DATABASE_URL, CLIENT_URL } = require("./src/constants/app.constant");
const { handleError } = require("./src/helpers/error.helper");
const conversationModel = require("./src/models/conversation.model");
const messageModel = require("./src/models/message.model");

require("./src/config/passport.config");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://vietstayhub.com",
      "http://vietstayhub.com",
    ],
    credentials: true,
  }),
);

app.use(express.json());
app.use(passport.initialize());

mongoose.connect(DATABASE_URL);

mongoose.connection.on("connected", () => {
  console.log("MongoDB connected");
});

app.use("/images", express.static("src/images"));
app.use("/", rootRouter);
app.use(handleError);

// Tạo HTTP server từ Express app
const server = http.createServer(app);

// Gắn Socket.IO vào HTTP server
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

// Socket events
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
  });
  socket.on("leave_conversation", (conversationId) => {
    socket.leave(conversationId);
    console.log(`Socket ${socket.id} left conversation ${conversationId}`);
  });
  socket.on("send_message", async (data) => {
    try {
      const { conversationId, senderId, receiverId, content } = data;

      if (!conversationId || !senderId || !receiverId || !content?.trim()) {
        return;
      }

      const newMessage = await messageModel.create({
        conversation_id: conversationId,
        sender_id: senderId,
        receiver_id: receiverId,
        content: content.trim(),
      });

      await conversationModel.findByIdAndUpdate(conversationId, {
        last_message: content.trim(),
        last_message_at: new Date(),
      });

      const populatedMessage = await messageModel
        .findById(newMessage._id)
        .populate("sender_id", "full_name email avatar")
        .populate("receiver_id", "full_name email avatar");

      io.to(conversationId).emit("receive_message", populatedMessage);

      io.emit("conversation_updated", {
        conversation_id: conversationId,
        last_message: content.trim(),
        last_message_at: new Date(),
      });
    } catch (error) {
      console.log("send_message error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Chạy server bằng http server, không dùng app.listen nữa
server.listen(3000, () => {
  console.log("Server online at http://localhost:3000");
});
