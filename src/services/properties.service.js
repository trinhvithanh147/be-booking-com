const { BadRequestException } = require("../helpers/error.helper");
const propertiesModel = require("../models/properties.model");
const cloudinary = require("../config/cloudinary.config");
const streamifier = require("streamifier");

const propertiesService = {
  getAll: async () => {
    return await propertiesModel
      .find()
      .populate("user_id", "full_name email avatar role");
  },
  getBySlug: async (slug, city) => {
    return await propertiesModel
      .findOne({ slug: slug, city: city })
      .populate("user_id", "full_name email avatar role");
  },
  getCity: async (city, page = 1, limit = 10) => {
    const skip = (page - 1) * limit;

    const properties = await propertiesModel
      .find({ city })
      .skip(skip)
      .limit(limit)
      .populate("user_id", "full_name email avatar role");

    const total = await propertiesModel.countDocuments({ city });

    return {
      properties,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
  create: async (data) => {
    const {
      title,
      slug,
      address,
      city,
      location,

      type,
      description,
      amenities,
      main_image_url,
      main_image_public_id,
      gallery_images,
      is_preferred,
      max_stay_days,
      user_id,
    } = data;
    const properties = await propertiesModel.create({
      title: title,
      slug: slug,
      address: address,
      city: city,
      location: location,

      type: type,
      description: description,
      amenities: amenities,
      main_image_url: main_image_url,
      main_image_public_id: main_image_public_id,
      gallery_images: gallery_images,
      is_preferred: is_preferred,
      max_stay_days: max_stay_days,
      user_id: user_id,
    });
    return properties;
  },
  update: async (id, data) => {
    const properties = await propertiesModel.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    return properties;
  },
  delete: async (id) => {
    return await propertiesModel.findByIdAndDelete(id);
  },
  uploadMainImageLocal: async (id, file) => {
    if (!file) {
      throw new BadRequestException("Vui long gui file bang key image");
    }

    const properties = await propertiesModel.findById(id);
    if (!properties) {
      throw new BadRequestException("Khong tim thay property");
    }

    properties.main_image_url = `/images/properties/${id}/main/${file.filename}`;
    properties.main_image_public_id = "";
    await properties.save();

    return properties;
  },
  uploadMainImageCloud: async (id, file) => {
    if (!file) {
      throw new BadRequestException("Vui long gui file bang key image");
    }

    const properties = await propertiesModel.findById(id);
    if (!properties) {
      throw new BadRequestException("Khong tim thay property");
    }

    if (properties.main_image_public_id) {
      await cloudinary.uploader.destroy(properties.main_image_public_id);
    }

    const uploaded = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `properties/${id}/main`, resource_type: "image" },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });

    properties.main_image_url = uploaded.secure_url;
    properties.main_image_public_id = uploaded.public_id;
    await properties.save();

    return properties;
  },
  uploadGalleryCloud: async (id, files) => {
    if (!files || files.length === 0) {
      throw new BadRequestException("Vui long gui file bang key images");
    }

    const properties = await propertiesModel.findById(id);
    if (!properties) {
      throw new BadRequestException("Khong tim thay property");
    }

    const uploadedFiles = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
              { folder: `properties/${id}/gallery`, resource_type: "image" },
              (error, result) => {
                if (error) return reject(error);
                resolve({
                  url: result.secure_url,
                  public_id: result.public_id,
                });
              },
            );

            streamifier.createReadStream(file.buffer).pipe(uploadStream);
          }),
      ),
    );

    properties.gallery_images = [
      ...(properties.gallery_images || []),
      ...uploadedFiles,
    ];
    await properties.save();

    return properties;
  },
};
module.exports = propertiesService;
