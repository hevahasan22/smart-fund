// Example frontend code for handling notifications
// This is a reference for implementing the notification system in your frontend

class NotificationService {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  // Get user notifications
  async getNotifications(limit = 50, unreadOnly = false) {
    const response = await fetch(
      `${this.baseURL}/contracts/notifications?limit=${limit}&unreadOnly=${unreadOnly}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }

  // Mark notification as read
  async markAsRead(notificationId) {
    const response = await fetch(
      `${this.baseURL}/contracts/notifications/${notificationId}/read`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }

  // Mark all notifications as read
  async markAllAsRead() {
    const response = await fetch(
      `${this.baseURL}/contracts/notifications/read-all`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }

  // Get pending approvals (for sponsors)
  async getPendingApprovals() {
    const response = await fetch(
      `${this.baseURL}/contracts/pending-approvals`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }

  // Get notification count for header badge
  async getNotificationCount() {
    const response = await fetch(
      `${this.baseURL}/contracts/notification-count`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }

  // Approve contract as sponsor
  async approveContract(contractId) {
    const response = await fetch(
      `${this.baseURL}/contracts/${contractId}/approve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.json();
  }

  // Reject contract as sponsor
  async rejectContract(contractId, reason) {
    const response = await fetch(
      `${this.baseURL}/contracts/${contractId}/reject`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      }
    );
    return response.json();
  }
}

// Example usage:
/*
const notificationService = new NotificationService('http://localhost:3000/api', 'your-jwt-token');

// Get notifications
const { notifications, unreadCount } = await notificationService.getNotifications();

// Get pending approvals
const { pendingApprovals } = await notificationService.getPendingApprovals();

// Mark notification as read
await notificationService.markAsRead('notification-id');

// Approve a contract
await notificationService.approveContract('contract-id');

// Reject a contract
await notificationService.rejectContract('contract-id', 'Unable to sponsor at this time');
*/

// Example React component for notification dropdown
/*
function NotificationDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const data = await notificationService.getNotifications();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
  };

  const handleMarkAsRead = async (notificationId) => {
    await notificationService.markAsRead(notificationId);
    loadNotifications(); // Reload to update counts
  };

  return (
    <div className="notification-dropdown">
      <div className="notification-header">
        <h3>Notifications ({unreadCount} unread)</h3>
        <button onClick={() => notificationService.markAllAsRead()}>
          Mark all as read
        </button>
      </div>
      <div className="notification-list">
        {notifications.map(notification => (
          <div 
            key={notification._id} 
            className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
            onClick={() => handleMarkAsRead(notification._id)}
          >
            <p>{notification.message}</p>
            <small>{new Date(notification.createdAt).toLocaleDateString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
*/ 