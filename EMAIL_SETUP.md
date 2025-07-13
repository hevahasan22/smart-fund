# Email Notification Setup Guide

## Overview
The Smart Fund application sends both in-app notifications and email notifications to users for important events like:
- Sponsor requests
- Contract approvals/rejections
- Payment reminders
- Document rejections

## Email Configuration

### 1. Environment Variables
Create a `.env` file in your project root with the following variables:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 2. Gmail Setup (Recommended)

#### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Enable 2-Factor Authentication

#### Step 2: Generate App Password
1. Go to Google Account settings
2. Navigate to Security → App passwords
3. Generate a new app password for "Mail"
4. Use this password as `EMAIL_PASS` in your .env file

#### Step 3: Test Configuration
The application will automatically test the email configuration on startup. Check the console for:
- "Email server is ready to send messages" (success)
- "Email configuration error" (failure)

### 3. Alternative Email Providers

You can modify the email configuration in `services/notificationService.js`:

```javascript
// For Outlook/Hotmail
transporter = nodemailer.createTransport({
  service: 'Outlook',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// For custom SMTP
transporter = nodemailer.createTransport({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

## Notification Types

### 1. Sponsor Request
- **Trigger**: When a borrower creates a contract
- **Recipients**: Both sponsors
- **Content**: Loan details and approval request

### 2. Sponsor Approval
- **Trigger**: When a sponsor approves a contract
- **Recipients**: Approving sponsor, other sponsor, borrower
- **Content**: Approval confirmation and next steps

### 3. Contract Rejection
- **Trigger**: When a sponsor rejects a contract
- **Recipients**: All parties (sponsors and borrower)
- **Content**: Rejection reason and next steps

### 4. Contract Approval
- **Trigger**: When contract processing is complete
- **Recipients**: Borrower and both sponsors
- **Content**: Final approval and loan details

### 5. Payment Reminders
- **Trigger**: When payments are due
- **Recipients**: Borrower
- **Content**: Payment amount and due date

## Testing Notifications

### 1. Test Email Configuration
```javascript
// Add this to your server.js for testing
const notificationService = require('./services/notificationService');

// Test email
notificationService.sendDualNotification(
  'user-id',
  'test',
  'This is a test notification',
  null,
  'Test Email',
  '<p>This is a test email from Smart Fund</p>'
);
```

### 2. Check In-App Notifications
Use the API endpoints to verify in-app notifications:
- `GET /contracts/notifications` - Get user notifications
- `GET /contracts/notification-count` - Get notification counts

## Troubleshooting

### Email Not Sending
1. Check environment variables are set correctly
2. Verify Gmail app password is correct
3. Check console for email configuration errors
4. Ensure 2-Factor Authentication is enabled on Gmail

### In-App Notifications Not Working
1. Check database connection
2. Verify user model has notifications array
3. Check API endpoints are accessible
4. Review server logs for errors

### Both Notifications Failing
1. Check server logs for detailed error messages
2. Verify all required dependencies are installed
3. Test database connectivity
4. Check user authentication

## Security Notes

1. **Never commit .env files** to version control
2. **Use app passwords** instead of regular passwords
3. **Enable 2-Factor Authentication** on email accounts
4. **Regularly rotate** app passwords
5. **Monitor** email sending logs for suspicious activity

## Production Considerations

1. **Rate Limiting**: Implement email rate limiting to prevent spam
2. **Email Templates**: Use professional HTML templates
3. **Unsubscribe**: Include unsubscribe links in emails
4. **Monitoring**: Set up email delivery monitoring
5. **Backup**: Have fallback email providers 