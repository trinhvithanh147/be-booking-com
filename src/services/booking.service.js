const { BadRequestException } = require("../helpers/error.helper");
const bookingModel = require("../models/bookings.model");
const roomsModel = require("../models/rooms.model");
const payOS = require("../config/payos.config");
const activeStatus = ["confirmed"];
const allStatus = ["pending_payment", "confirmed", "completed", "cancelled"];

const parseDate = (value, label) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${label} không hợp lệ`);
  }
  return date;
};

const calculateNights = (checkIn, checkOut) => {
  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const rawNights = Math.ceil((checkOut - checkIn) / millisecondsPerDay);
  return Math.max(1, rawNights);
};

const getStartOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getOverlappingBookedRooms = async ({
  roomId,
  checkIn,
  checkOut,
  excludeBookingId = null,
}) => {
  const query = {
    room_id: roomId,
    status: { $in: activeStatus },
    check_in: { $lt: checkOut },
    check_out: { $gt: checkIn },
  };

  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const overlappingBookings = await bookingModel
    .find(query)
    .select("rooms_count");

  return overlappingBookings.reduce(
    (total, booking) => total + (Number(booking.rooms_count) || 0),
    0,
  );
};

const validateDateRange = (checkIn, checkOut) => {
  const today = getStartOfToday();
  const normalizedCheckIn = new Date(checkIn);
  normalizedCheckIn.setHours(0, 0, 0, 0);

  if (normalizedCheckIn < today) {
    throw new BadRequestException(
      "Ngày check_in không được nhỏ hơn ngày hiện tại",
    );
  }

  if (checkOut <= checkIn) {
    throw new BadRequestException("Ngày check_out phải lớn hơn ngày check_in");
  }
};

const bookingService = {
  getAll: async () => {
    return await bookingModel
      .find()
      .populate("user_id", "full_name email avatar role")
      .populate({
        path: "property_id",
        populate: {
          path: "user_id",
          select: "full_name email avatar role",
        },
      })
      .populate("room_id");
  },
  getByUserId: async (userId) => {
    return await bookingModel
      .find({ user_id: userId })
      .populate("user_id", "full_name email avatar role")
      .populate({
        path: "property_id",
        populate: {
          path: "user_id",
          select: "full_name email avatar role",
        },
      })
      .populate("room_id");
  },
  create: async (data) => {
    const { user_id, property_id, room_id, check_in, check_out } = data;

    const room = await roomsModel.findById(room_id);
    if (!room) {
      throw new BadRequestException("Phong khong ton tai");
    }

    if (
      property_id &&
      room.property_id?.toString() !== property_id.toString()
    ) {
      throw new BadRequestException("Phong khong thuoc cho nghi da chon");
    }

    const roomsCount = Number(data.rooms_count) || 1;
    if (roomsCount < 1) {
      throw new BadRequestException("So luong phong khong hop le");
    }

    const checkInDate = parseDate(check_in, "Ngày check_in");
    const checkOutDate = parseDate(check_out, "Ngày check_out");
    validateDateRange(checkInDate, checkOutDate);

    const bookedRooms = await getOverlappingBookedRooms({
      roomId: room._id,
      checkIn: checkInDate,
      checkOut: checkOutDate,
    });
    const availableRooms = (Number(room.quantity) || 0) - bookedRooms;

    if (availableRooms < roomsCount) {
      throw new BadRequestException("So luong phong khong du");
    }

    const nights = calculateNights(checkInDate, checkOutDate);
    const pricePerNight = Number(room.price) || 0;
    const totalPrice = pricePerNight * nights * roomsCount;
    const maxGuests = (Number(room.capacity) || 1) * roomsCount;

    const requestGuests = Number(data.guests);
    const guests =
      Number.isFinite(requestGuests) && requestGuests > 0
        ? requestGuests
        : maxGuests;

    if (guests > maxGuests) {
      throw new BadRequestException("So khach vuot qua suc chua phong");
    }

    const status = allStatus.includes(data.status)
      ? data.status
      : "pending_payment";

    const booking = await bookingModel.create({
      user_id,
      property_id,
      room_id,
      check_in: checkInDate,
      check_out: checkOutDate,
      guests,
      rooms_count: roomsCount,
      nights: nights,
      price_per_night: pricePerNight,
      total_price: totalPrice,
      status: "pending_payment",
    });

    return booking;
  },
  updateStatus: async (bookingId, status) => {
    const booking = await bookingModel.findById(bookingId);

    if (!booking) {
      throw new BadRequestException("Booking khong ton tai");
    }

    const room = await roomsModel.findById(booking.room_id);

    if (!room) {
      throw new BadRequestException("Phong khong ton tai");
    }

    if (!allStatus.includes(status)) {
      throw new BadRequestException("Trang thai booking khong hop le");
    }

    if (
      !activeStatus.includes(booking.status) &&
      activeStatus.includes(status)
    ) {
      const bookedRooms = await getOverlappingBookedRooms({
        roomId: room._id,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        excludeBookingId: booking._id,
      });
      const availableRooms = (Number(room.quantity) || 0) - bookedRooms;

      if (availableRooms < booking.rooms_count) {
        throw new BadRequestException("So luong phong khong du");
      }
    }

    booking.status = status;
    await booking.save();

    return booking;
  },
  update: async (bookingId, data) => {
    const booking = await bookingModel.findById(bookingId);

    if (!booking) {
      throw new BadRequestException("Booking khong ton tai");
    }

    const nextRoomId = data.room_id || booking.room_id.toString();
    const nextRoomsCount = Number(data.rooms_count ?? booking.rooms_count);
    const nextStatus = data.status || booking.status;
    if (!allStatus.includes(nextStatus)) {
      throw new BadRequestException("Trang thai booking khong hop le");
    }

    const currentRoom = await roomsModel.findById(booking.room_id);
    const nextRoom = await roomsModel.findById(nextRoomId);

    if (!currentRoom || !nextRoom) {
      throw new BadRequestException("Phong khong ton tai");
    }

    if (nextRoomsCount < 1) {
      throw new BadRequestException("So luong phong khong hop le");
    }

    const nextPropertyId = data.property_id || booking.property_id;
    if (
      nextPropertyId &&
      nextRoom.property_id?.toString() !== nextPropertyId.toString()
    ) {
      throw new BadRequestException("Phong khong thuoc cho nghi da chon");
    }

    const nextCheckIn = parseDate(
      data.check_in || booking.check_in,
      "Ngay check_in",
    );
    const nextCheckOut = parseDate(
      data.check_out || booking.check_out,
      "Ngay check_out",
    );
    validateDateRange(nextCheckIn, nextCheckOut);

    if (activeStatus.includes(nextStatus)) {
      const bookedRooms = await getOverlappingBookedRooms({
        roomId: nextRoom._id,
        checkIn: nextCheckIn,
        checkOut: nextCheckOut,
        excludeBookingId: booking._id,
      });
      const availableRooms = (Number(nextRoom.quantity) || 0) - bookedRooms;

      if (availableRooms < nextRoomsCount) {
        throw new BadRequestException("So luong phong khong du");
      }
    }

    const nights = calculateNights(nextCheckIn, nextCheckOut);
    const pricePerNight = Number(nextRoom.price) || 0;
    const totalPrice = pricePerNight * nights * nextRoomsCount;
    const maxGuests = (Number(nextRoom.capacity) || 1) * nextRoomsCount;

    const requestedGuests = Number(data.guests ?? booking.guests);
    const guests =
      Number.isFinite(requestedGuests) && requestedGuests > 0
        ? requestedGuests
        : maxGuests;

    if (guests > maxGuests) {
      throw new BadRequestException("So khach vuot qua suc chua phong");
    }

    booking.user_id = data.user_id || booking.user_id;
    booking.property_id = nextPropertyId;
    booking.room_id = nextRoomId;
    booking.check_in = nextCheckIn;
    booking.check_out = nextCheckOut;
    booking.guests = guests;
    booking.rooms_count = nextRoomsCount;
    booking.nights = nights;
    booking.price_per_night = pricePerNight;
    booking.total_price = totalPrice;
    booking.status = nextStatus;

    await booking.save();

    return await bookingModel
      .findById(bookingId)
      .populate("user_id", "full_name email avatar role")
      .populate({
        path: "property_id",
        populate: {
          path: "user_id",
          select: "full_name email avatar role",
        },
      })
      .populate("room_id");
  },
  createPayOSPayment: async (bookingId) => {
    const booking = await bookingModel
      .findById(bookingId)
      .populate("property_id", "title")
      .populate("room_id", "name");

    if (!booking) {
      throw new BadRequestException("Booking không tồn tại");
    }

    if (booking.payment_status === "paid") {
      throw new BadRequestException("Booking này đã thanh toán");
    }

    const orderCode = Number(`${Date.now()}`.slice(-9));
    const amount = Number(booking.total_price);

    const paymentData = {
      orderCode,
      amount,
      description: `Booking ${orderCode}`,
      items: [
        {
          name: booking.room_id?.name || "Đặt phòng",
          quantity: 1,
          price: amount,
        },
      ],
      returnUrl: `${process.env.FRONTEND_URL}/payment-success?bookingId=${booking._id}`,
      cancelUrl: `${process.env.FRONTEND_URL}/payment-cancel?bookingId=${booking._id}`,
    };

    const paymentLink = await payOS.paymentRequests.create(paymentData);

    booking.order_code = orderCode;
    booking.checkout_url = paymentLink.checkoutUrl;
    booking.status = "pending_payment";
    booking.payment_status = "unpaid";
    booking.payment_method = "payos";

    await booking.save();

    return {
      booking,
      checkoutUrl: paymentLink.checkoutUrl,
    };
  },
  handlePayOSWebhook: async (webhookBody) => {
    const webhookData = payOS.webhooks.verify(webhookBody);

    const orderCode = webhookData.orderCode;
    const booking = await bookingModel.findOne({ order_code: orderCode });

    if (!booking) {
      throw new BadRequestException("Không tìm thấy booking từ orderCode");
    }

    if (booking.payment_status === "paid") {
      return booking;
    }

    booking.payment_status = "paid";
    booking.status = "confirmed";
    booking.paid_at = new Date();

    await booking.save();

    return booking;
  },
  delete: async (bookingId) => {
    const booking = await bookingModel.findById(bookingId);

    if (!booking) {
      throw new BadRequestException("Booking khong ton tai");
    }

    return await bookingModel.findByIdAndDelete(bookingId);
  },
};

module.exports = bookingService;
