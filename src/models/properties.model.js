const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
  {
    title: String,
    slug: { type: String, unique: true },

    address: String,
    city: {
      type: String,
      enum: ["da-lat", "da-nang", "ha-noi", "ho-chi-minh", "vung-tau"],
    },
    location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },

    type: {
      type: String,
      enum: ["hotel"],
      default: "hotel",
    },

    description: String,
    amenities: {
      outdoor_pool: Boolean,
      free_wifi: Boolean,
      airport_shuttle: Boolean,
      non_smoking_room: Boolean,
      room_service: Boolean,
      restaurant: Boolean,
      free_parking: Boolean,
      family_room: Boolean,
      bar: Boolean,
      breakfast: Boolean,
    },

    main_image_url: {
      type: String,
      default: "",
    },
    main_image_public_id: {
      type: String,
      default: "",
    },
    gallery_images: [
      {
        url: { type: String, default: "" },
        public_id: { type: String, default: "" },
      },
    ],
    is_preferred: Boolean,

    max_stay_days: {
      type: Number,
      default: 30,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Property", propertySchema);
