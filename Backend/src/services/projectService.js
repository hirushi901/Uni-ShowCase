const Project = require('../models/Project');
const eventEmitter = require('../events/emitters');
const { uploadBufferToCloudinary } = require('../utils/cloudinary');

const validateExternalUrl = (value, fieldName) => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw new Error(`${fieldName} must be a URL`);

  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol)) {
      throw new Error('Unsupported URL scheme');
    }
    return url.href;
  } catch (error) {
    throw new Error(`${fieldName} must be a valid HTTP(S) URL`);
  }
};

class ProjectService {
  async createProject(studentId, projectData, files, user) {
    let coverImage = '';
    let additionalImages = [];

    if (files) {
      if (files.coverImage && files.coverImage.length > 0) {
        const f = files.coverImage[0];
        coverImage = await uploadBufferToCloudinary(f.buffer, 'projects/covers', f.originalname);
      }
      if (files.additionalImages && files.additionalImages.length > 0) {
        const uploadPromises = files.additionalImages.map(file =>
          uploadBufferToCloudinary(file.buffer, 'projects/additional', file.originalname)
        );
        additionalImages = await Promise.all(uploadPromises);
      }
    }

    let technologiesUsed = projectData.technologiesUsed;
    if (typeof technologiesUsed === 'string') technologiesUsed = technologiesUsed.split(',').map(tech => tech.trim());

    const project = await Project.create({
      studentId,
      title: projectData.title,
      description: projectData.description,
      technologiesUsed: technologiesUsed || [],
      coverImage: coverImage || projectData.coverImage || '',
      additionalImages: additionalImages.length > 0 ? additionalImages : (projectData.additionalImages || []),
      demoUrl: validateExternalUrl(projectData.demoUrl, 'Demo URL'),
      gitRepoUrl: validateExternalUrl(projectData.gitRepoUrl, 'Git repository URL'),
      // Project approval is a privileged operation. Never accept visibility
      // from a student-controlled create request.
      isPublic: false
    });

    await project.populate('studentId', 'name email role');
    eventEmitter.emit('ProjectCreated', { project, user });
    return project;
  }

  async getProjects(user, queryParams) {
    const { search, technologies, page, limit, followedOnly, studentId } = queryParams;
    const query = {};

    if (studentId) {
      query.studentId = studentId;
    }

    // Role-based visibility boundaries
    if (user.role === 'Student') {
      query.$or = [{ isPublic: true }, { studentId: user._id || user.id }];
    } else if (user.role === 'Recruiter') {
      query.isPublic = true;
    }

    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ title: { $regex: search, $options: 'i' } }, { description: { $regex: search, $options: 'i' } }]
      });
    }

    if (technologies) {
      const techArray = Array.isArray(technologies) ? technologies : technologies.split(',').map(t => t.trim());
      query.technologiesUsed = { $in: techArray.map(t => new RegExp(t, 'i')) };
    }

    // Followed only filter (for Recruiters)
    if (followedOnly === 'true' && user.role === 'Recruiter') {
      const Follower = require('../models/Follower');
      const recruiterId = user._id || user.id;
      const follows = await Follower.find({ recruiterId });
      const studentIds = follows.map(f => f.studentId);
      query.studentId = { $in: studentIds };
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await Project.countDocuments(query);
    const projects = await Project.find(query)
      .populate('studentId', 'name email profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Compute userLiked and likesCount
    const Like = require('../models/Like');
    const userId = user._id || user.id;
    const projectIds = projects.map(p => p._id);
    
    const userLikes = await Like.find({ userId, projectId: { $in: projectIds } });
    const likedIdsSet = new Set(userLikes.map(l => l.projectId.toString()));

    const allLikes = await Like.aggregate([
      { $match: { projectId: { $in: projectIds } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } }
    ]);
    const likesMap = {};
    allLikes.forEach(item => {
      likesMap[item._id.toString()] = item.count;
    });

    const projectsWithLikes = projects.map(p => {
      const pObj = p.toJSON();
      pObj.userLiked = likedIdsSet.has(p._id.toString());
      pObj.likesCount = likesMap[p._id.toString()] || 0;
      return pObj;
    });

    return { projects: projectsWithLikes, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
  }

  async getProjectById(projectId, user) {
    const project = await Project.findById(projectId).populate('studentId', 'name email profilePicture');
    if (!project) throw new Error('Project not found');

    const projectOwnerId = project.studentId._id || project.studentId;
    const isOwner = projectOwnerId.toString() === (user._id || user.id).toString();
    const isAdmin = user.role === 'Admin';
    if (!project.isPublic && !isOwner && !isAdmin) {
      throw new Error('Access denied: Private project');
    }
    return project;
  }

  async updateProject(projectId, updateData, files, user) {
    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    const isOwner = project.studentId.toString() === (user._id || user.id).toString();
    const isAdmin = user.role === 'Admin';
    if (!isOwner && !isAdmin) throw new Error('Forbidden: Only the project owner or an admin can edit this project');

    let coverImage = project.coverImage;
    if (files && files.coverImage && files.coverImage.length > 0) {
      const f = files.coverImage[0];
      coverImage = await uploadBufferToCloudinary(f.buffer, 'projects/covers', f.originalname);
    }

    let additionalImages = [];
    if (updateData.additionalImages) {
      try {
        additionalImages = typeof updateData.additionalImages === 'string'
          ? JSON.parse(updateData.additionalImages)
          : updateData.additionalImages;
      } catch (e) {
        additionalImages = Array.isArray(updateData.additionalImages) 
          ? updateData.additionalImages 
          : [updateData.additionalImages];
      }
    } else {
      additionalImages = project.additionalImages || [];
    }

    if (files && files.additionalImages && files.additionalImages.length > 0) {
      const uploadPromises = files.additionalImages.map(file =>
        uploadBufferToCloudinary(file.buffer, 'projects/additional', file.originalname)
      );
      const newUploadedImages = await Promise.all(uploadPromises);
      additionalImages = [...additionalImages, ...newUploadedImages];
    }

    let technologiesUsed = updateData.technologiesUsed;
    if (typeof technologiesUsed === 'string') {
      technologiesUsed = technologiesUsed.split(',').map(t => t.trim());
    }

    project.title = updateData.title !== undefined ? updateData.title : project.title;
    project.description = updateData.description !== undefined ? updateData.description : project.description;
    project.technologiesUsed = technologiesUsed !== undefined ? technologiesUsed : project.technologiesUsed;
    project.coverImage = coverImage;
    project.additionalImages = additionalImages;
    project.demoUrl = updateData.demoUrl !== undefined
      ? validateExternalUrl(updateData.demoUrl, 'Demo URL')
      : project.demoUrl;
    project.gitRepoUrl = updateData.gitRepoUrl !== undefined
      ? validateExternalUrl(updateData.gitRepoUrl, 'Git repository URL')
      : project.gitRepoUrl;
    // Visibility changes are handled only by updateVisibility, which requires
    // the Recruiter or Admin role. Ignore any isPublic value in normal edits.

    await project.save();
    return project;
  }

  async getLikedProjects(user, queryParams) {
    const { page, limit } = queryParams;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const Like = require('../models/Like');
    const userId = user._id || user.id;
    const likes = await Like.find({ userId });
    const projectIds = likes.map(like => like.projectId);

    const query = { _id: { $in: projectIds } };
    
    // Private projects are visible only to their owner and administrators.
    if (user.role === 'Recruiter') {
      query.isPublic = true;
    } else if (user.role === 'Student') {
      query.$or = [{ isPublic: true }, { studentId: userId }];
    }

    const total = await Project.countDocuments(query);
    const projects = await Project.find(query)
      .populate('studentId', 'name email profilePicture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Compute userLiked (always true for this list) and likesCount
    const projectIdsInList = projects.map(p => p._id);
    const allLikes = await Like.aggregate([
      { $match: { projectId: { $in: projectIdsInList } } },
      { $group: { _id: '$projectId', count: { $sum: 1 } } }
    ]);
    const likesMap = {};
    allLikes.forEach(item => {
      likesMap[item._id.toString()] = item.count;
    });

    const projectsWithLikes = projects.map(p => {
      const pObj = p.toJSON();
      pObj.userLiked = true;
      pObj.likesCount = likesMap[p._id.toString()] || 0;
      return pObj;
    });

    return { projects: projectsWithLikes, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) };
  }

  async deleteProject(projectId, user) {
    const project = await Project.findById(projectId);
    if (!project) throw new Error('Project not found');

    const isOwner = project.studentId.toString() === (user._id || user.id).toString();
    const isAdmin = user.role === 'Admin';
    if (!isOwner && !isAdmin) throw new Error('Forbidden: Only the project owner or an admin can delete this project');

    await project.deleteOne();
    return { id: projectId };
  }

  async updateVisibility(projectId, isPublic, user) {
    if (user.role !== 'Recruiter' && user.role !== 'Admin') throw new Error('Forbidden: Only recruiters or admins can update public visibility status');
    const project = await Project.findById(projectId).populate('studentId', 'name email');
    if (!project) throw new Error('Project not found');

    const wasPrivate = !project.isPublic;
    const becomingPublic = isPublic === true || isPublic === 'true';

    project.isPublic = isPublic !== undefined ? becomingPublic : true;
    await project.save();

    // Emit notification only on private → public transition
    if (wasPrivate && project.isPublic) {
      eventEmitter.emit('ProjectMadePublic', { project, adminUser: user });
    }

    return project;
  }
}

module.exports = new ProjectService();
