const statisticService = require("../services/statistic.service");

const getAdminStatistics = async (req, res) => {
  try {
    const metaData = await statisticService.getAdminStatistics();

    return res.status(200).json({
      message: "Get admin statistics successfully",
      metaData,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAdminStatistics,
};
