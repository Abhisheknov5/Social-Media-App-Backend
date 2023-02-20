const { response } = require('express')
const User = require('../models/User')
const Post = require('../models/Post')
const { sendEmail } = require('../middlewares/sendEmail')
const crypto = require('crypto')

// Register
exports.register = async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body

    let user = await User.findOne({ email })
    if (user) {
      return res
        .status(400)
        .json({ success: false, message: 'User already exists' })
    }
    user = await User.create({
      name,
      email,
      password,
      avatar: { public_id: 'sample_id', url: 'sampleurl' },
    })

    const token = await user.generateToken()

    const Options = {
      expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    }

    res.status(201).cookie('token', token, Options).json({
      success: true,
      user,
      token,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email }).select('+password')

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User does not exist',
      })
    }
    const isMatch = await user.matchPassword(password)

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password',
      })
    }

    const token = await user.generateToken()

    const Options = {
      expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    }

    res.status(200).cookie('token', token, Options).json({
      success: true,
      user,
      token,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// logOut
exports.logout = async (req, res) => {
  try {
    res
      .status(200)
      .cookie('token', null, { expires: new Date(Date.now()), httpOnly: true })
      .json({
        success: true,
        message: 'Logged out',
      })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Follow User

exports.followUser = async (req, res) => {
  try {
    const userToFollow = await User.findById(req.params.id)
    const loggedInUser = await User.findById(req.user._id)

    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    if (loggedInUser.following.includes(userToFollow._id)) {
      const indexfollowing = loggedInUser.following.indexOf(userToFollow._id)
      const indexfollowers = userToFollow.followers.indexOf(loggedInUser._id)

      loggedInUser.following.splice(indexfollowing, 1)
      userToFollow.followers.splice(indexfollowers, 1)

      await loggedInUser.save()
      await userToFollow.save()

      res.status(200).json({
        success: true,
        message: 'User Unfollowed',
      })
    } else {
      loggedInUser.following.push(userToFollow._id)
      userToFollow.followers.push(loggedInUser._id)

      await loggedInUser.save()
      await userToFollow.save()

      res.status(200).json({
        success: true,
        message: 'User followed',
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Update password

exports.updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+password')

    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide old and new password',
      })
    }
    const isMatch = await user.matchPassword(oldPassword)

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect old password',
      })
    }

    user.password = newPassword
    await user.save()

    res.status(200).json({
      success: true,
      message: 'Password updated ',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Update Profile

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)

    const { name, email } = req.body

    if (name) {
      user.name = name
    }
    if (email) {
      user.email = email
    }
    // User Avatar: TODO

    await user.save()

    res.status(200).json({
      success: true,
      message: 'profile Updated',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// delete Myprofile

exports.deleteMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    const posts = user.posts
    const followers = user.followers
    const following = user.following
    const userId = user._id
    await user.remove()

    // Logout User after deleting Profile

    res.cookie('token', null, {
      expires: new Date(Date.now()),
      httpOnly: true,
    })

    // Delete all posts of the User
    for (let i = 0; i < posts.length; i++) {
      const post = await Post.findById(posts[i])
      await post.remove()
    }

    // Removing User from Followers Following
    for (let i = 0; i < followers.length; i++) {
      const follower = await User.findById(followers[i])

      const index = follower.following.indexOf(userId)
      follower.following.splice(index, 1)
      await follower.save()
    }

    // Removing User from Following's Followers
    for (let i = 0; i < following.length; i++) {
      const follows = await User.findById(following[i])

      const index = follows.followers.indexOf(userId)
      follows.followers.splice(index, 1)
      await follows.save()
    }

    res.status(200).json({
      success: true,
      message: 'Profile Deleted',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// My Profile

exports.myProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('posts')

    res.status(200).json({
      success: true,
      user,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// getUser Profile

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('posts')

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    res.status(200).json({
      success: true,
      user,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// get All User
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({})

    res.status(200).json({
      success: true,
      users,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// Forgot Password

exports.forgotPassword = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'user not found',
      })
    }

    const resetPasswordToken = user.getResetPasswordToken()

    await user.save()

    const resetUrl = `${req.protocol}://${req.get(
      'host',
    )}/api/v1/password/reset/${resetPasswordToken}`

    const message = `Reset Your Password by clicking on the link below: \n\n ${resetUrl}`

    try {
      await sendEmail({
        email: user.email,
        subject: 'Reset Password',
        message,
      })

      res.status(200).json({
        success: true,
        message: `Email sent to ${user.email}`,
      })
    } catch (error) {
      user.resetPasswordToken = undefined
      user.resetPasswordExpire = undefined
      await user.save()

      res.status(500).json({
        success: false,
        message: error.message,
      })
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

exports.resetPassword = async (req, res) => {
  try {
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex')

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    })

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is invalid or has expired',
      })
    }
    user.password = req.body.password

    user.resetPasswordToken = undefined
    user.resetPasswordExpire = undefined
    await user.save()

    res.status(200).json({
      success: true,
      message: 'Password Updated',
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}
