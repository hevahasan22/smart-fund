const { User } = require('../models/user');

exports.list = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const user = await User.findById(req.user._id).select('notifications');
    const notifications = (user?.notifications || [])
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

exports.unreadCount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');
    const count = (user?.notifications || []).filter(n => !n.isRead).length;
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await User.updateOne(
      { _id: req.user._id, 'notifications._id': id },
      { $set: { 'notifications.$.isRead': true } }
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { 'notifications.$[].isRead': true } }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
};

exports.clearAll = async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $set: { notifications: [] } });
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
}; 