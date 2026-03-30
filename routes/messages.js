var express = require("express");
var router = express.Router();
let mongoose = require("mongoose");

let messageModel = require("../schemas/messages");
let userModel = require("../schemas/users");
let { checkLogin } = require("../utils/authHandler.js");

router.get("/", checkLogin, async function (req, res, next) {
  try {
    let currentUserId = new mongoose.Types.ObjectId(req.userId);

    let conversations = await messageModel.aggregate([
      {
        $match: {
          $or: [{ from: currentUserId }, { to: currentUserId }],
        },
      },
      {
        $addFields: {
          partnerId: {
            $cond: [{ $eq: ["$from", currentUserId] }, "$to", "$from"],
          },
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
      {
        $group: {
          _id: "$partnerId",
          lastMessage: {
            $first: "$$ROOT",
          },
        },
      },
      {
        $replaceRoot: {
          newRoot: "$lastMessage",
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);

    let populatedConversations = await messageModel.populate(conversations, [
      { path: "from", select: "username fullName avatarUrl" },
      { path: "to", select: "username fullName avatarUrl" },
    ]);

    res.send(populatedConversations);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.get("/:userId", checkLogin, async function (req, res, next) {
  try {
    let currentUserId = req.userId;
    let otherUserId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).send({ message: "userID khong hop le" });
    }

    let messages = await messageModel
      .find({
        $or: [
          { from: currentUserId, to: otherUserId },
          { from: otherUserId, to: currentUserId },
        ],
      })
      .sort({ createdAt: 1 })
      .populate("from", "username fullName avatarUrl")
      .populate("to", "username fullName avatarUrl");

    res.send(messages);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.post("/:userId", checkLogin, async function (req, res, next) {
  try {
    let to = req.params.userId;
    let from = req.userId;
    let { messageContent } = req.body;

    if (!mongoose.Types.ObjectId.isValid(to)) {
      return res.status(400).send({ message: "userID khong hop le" });
    }

    let receiver = await userModel.findOne({ _id: to, isDeleted: false });
    if (!receiver) {
      return res.status(404).send({ message: "Nguoi nhan khong ton tai" });
    }

    if (!messageContent || !messageContent.type || !messageContent.text) {
      return res.status(400).send({
        message: "Can gui messageContent gom type va text",
      });
    }

    if (!["file", "text"].includes(messageContent.type)) {
      return res.status(400).send({
        message: "type chi duoc la file hoac text",
      });
    }

    let newMessage = new messageModel({
      from,
      to,
      messageContent: {
        type: messageContent.type,
        text: messageContent.text,
      },
    });

    let result = await newMessage.save();
    result = await result.populate("from", "username fullName avatarUrl");
    result = await result.populate("to", "username fullName avatarUrl");

    res.status(201).send(result);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
