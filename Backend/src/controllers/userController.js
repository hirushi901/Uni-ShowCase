const User = require('../models/User');
const Project = require('../models/Project');
const { createLiteralSearchRegex } = require('../utils/search');

const getAllUsers = async (req, res) => {
  try {
    const { search, role, isVerified, page, limit, followedOnly } = req.query;
    const query = {};

    const searchRegex = search === undefined ? null : createLiteralSearchRegex(search, 'Search');
    if (searchRegex) {
      query.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    if (role) {
      query.role = role;
    }

    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true';
    }

    // Followed only filter (for Recruiters)
    if (followedOnly === 'true' && req.user) {
      const Follower = require('../models/Follower');
      const recruiterId = req.user._id || req.user.id;
      const follows = await Follower.find({ recruiterId });
      const studentIds = follows.map(f => f.studentId);
      query._id = { $in: studentIds };
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Populate follows status and tech stack dynamically
    const Follower = require('../models/Follower');
    const recruiterId = req.user ? (req.user._id || req.user.id) : null;
    
    let followIdsSet = new Set();
    if (recruiterId) {
      const userIds = users.map(u => u._id);
      const followsList = await Follower.find({ recruiterId, studentId: { $in: userIds } });
      followIdsSet = new Set(followsList.map(f => f.studentId.toString()));
    }

    // Load projects to extract tech stacks
    const usersWithDetails = await Promise.all(users.map(async (u) => {
      const uObj = u.toJSON();
      uObj.isFollowing = followIdsSet.has(u._id.toString());
      
      // Default bio
      uObj.bio = uObj.bio || 'Passionate student developer showcasing portfolio projects at UniShowcase.';
      
      // Extract unique tech stack from user's projects
      const studentProjects = await Project.find({ studentId: u._id, isPublic: true });
      const techsSet = new Set();
      studentProjects.forEach(p => {
        if (p.technologiesUsed) {
          p.technologiesUsed.forEach(tech => {
            if (tech) techsSet.add(tech);
          });
        }
      });
      uObj.techStack = Array.from(techsSet);
      return uObj;
    }));

    return res.status(200).json({
      count: usersWithDetails.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      limit: limitNum,
      users: usersWithDetails
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { role, isVerified } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (role) {
      const validRoles = ['Student', 'Recruiter', 'Admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      user.role = role;
    }

    if (isVerified !== undefined) {
      user.isVerified = isVerified;
    }

    await user.save();
    return res.status(200).json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete all projects created by this user
    await Project.deleteMany({ studentId: user._id });
    await user.deleteOne();

    return res.status(200).json({
      message: 'User and their associated projects deleted successfully',
      id: req.params.id
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAllUsers,
  updateUser,
  deleteUser
};
