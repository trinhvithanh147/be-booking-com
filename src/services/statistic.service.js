const userModel = require("../models/users.model");
const proPertiesModel = require("../models/properties.model");
const roomModel = require("../models/rooms.model");
const bookingModel = require("../models/bookings.model");
const reviewModel = require("../models/reviews.model");

const getAdminStatistics = async () => {
  const [
    totalUsers,
    totalProperties,
    totalRooms,
    totalBookings,
    totalReviews,
    monthlyRevenue,
    bookingsByMonth,
    propertiesByCity,
    bookingsByStatus,
  ] = await Promise.all([
    userModel.countDocuments(),
    proPertiesModel.countDocuments(),
    roomModel.countDocuments(),
    bookingModel.countDocuments(),
    reviewModel.countDocuments(),

    bookingModel.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: {
            $sum: {
              $ifNull: ["$total_price", "$total_amount"],
            },
          },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: "$_id.month" },
              "/",
              { $toString: "$_id.year" },
            ],
          },
          revenue: 1,
        },
      },
    ]),

    bookingModel.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          bookings: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
        },
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: "$_id.month" },
              "/",
              { $toString: "$_id.year" },
            ],
          },
          bookings: 1,
        },
      },
    ]),

    proPertiesModel.aggregate([
      {
        $group: {
          _id: "$city",
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          city: "$_id",
          total: 1,
        },
      },
      {
        $sort: {
          total: -1,
        },
      },
    ]),

    bookingModel.aggregate([
      {
        $group: {
          _id: "$status",
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: { $ifNull: ["$_id", "unknown"] },
          total: 1,
        },
      },
    ]),
  ]);

  const totalRevenue = monthlyRevenue.reduce(
    (sum, item) => sum + Number(item.revenue || 0),
    0,
  );

  return {
    overview: {
      totalUsers,
      totalProperties,
      totalRooms,
      totalBookings,
      totalReviews,
      totalRevenue,
    },
    charts: {
      monthlyRevenue,
      bookingsByMonth,
      propertiesByCity,
      bookingsByStatus,
    },
  };
};

module.exports = {
  getAdminStatistics,
};
