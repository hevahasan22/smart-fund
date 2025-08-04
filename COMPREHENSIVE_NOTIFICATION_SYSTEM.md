# Comprehensive Notification System

## Overview

This document outlines the implementation of a pro-level notification system that guides users, sponsors, and admins through every stage of the loan contract lifecycle. The system ensures timely, appropriate alerts that enhance user experience and operational efficiency.

## System Architecture

### Core Components

1. **Notification Service** (`services/notificationService.js`)
   - Centralized notification management
   - Dual delivery (in-app + email)
   - Lifecycle-specific notification functions
   - Error handling and fallback mechanisms

2. **Integration Points**
   - Contract Controller: Contract lifecycle events
   - Payment Controller: Payment-related events
   - Document Controller: Document review events
   - User Authentication: Login status checks

## Notification Matrix

| Event | Recipient | In-App | Email | Message Contains |
|-------|-----------|--------|-------|------------------|
| Contract Submitted | Borrower | ✅ | ✅ | Loan type + term |
| | Admin | ✅ | ✅ | Loan type + term |
| Documents Approved | Borrower | ✅ | ❌ | Loan type + term |
| Documents Rejected | Borrower | ✅ | ✅ | Loan type + term + reason |
| Sponsorship Request | Sponsors | ✅ | ✅ | Borrower name + loan details |
| Sponsor Approved | Borrower | ✅ | ❌ | Loan type + term |
| | Other Sponsors | ✅ | ✅ | Borrower name + loan details |
| Sponsor Rejected | Borrower | ✅ | ✅ | Loan type + term |
| | Other Sponsors | ✅ | ❌ | Borrower name + loan type |
| Contract Activated | Borrower | ✅ | ✅ | Loan type + term + payment date |
| | Sponsors | ✅ | ✅ | Borrower name + loan details |
| | Admin | ✅ | ✅ | Borrower name + loan type |
| Contract Rejected | Borrower | ✅ | ✅ | Loan type + term + reason |
| | Sponsors | ✅ | ❌ | Borrower name + loan type |
| Payment Reminder | Borrower | ✅ | ✅ | Loan type + term + amount |
| Payment Confirmed | Borrower | ✅ | ✅ | Loan type + term + next date |
| Late Payment | Borrower | ✅ | ✅ | Loan type + term + penalty |
| Loan Completed | Borrower | ✅ | ✅ | Loan type + term |
| | Sponsors | ✅ | ✅ | Borrower name + loan details |
| | Admin | ✅ | ✅ | Borrower name + loan type |

## Implementation Guide

### Step 1: User Login - Red Badge Check

```javascript
// Check for pending actions when user logs in
const pendingActions = await notificationService.checkPendingActions(userId);
if (pendingActions.hasPendingActions) {
  // Show red badge in UI
  // Display count: pendingActions.unreadNotifications + pendingActions.pendingApprovals
}
```

### Step 2: Contract Application Submitted

```javascript
// In contractController.js - createContract function
await notificationService.sendContractSubmissionNotification(userId, contract._id);
await notificationService.sendNewApplicationNotification(contract._id);
```

### Step 3: Document Review (Admin)

```javascript
// When documents are approved
await notificationService.sendDocumentApprovalNotification(borrowerId, contractId);

// When documents are rejected
await notificationService.sendDocumentRejectionNotification(borrowerId, contractId, reason);

// Notify sponsors when documents are approved
await notificationService.sendSponsorshipRequestNotification(sponsorId, borrowerId, contractId);
```

### Step 4: Sponsor Approval Phase

```javascript
// When a sponsor approves
await notificationService.sendSponsorApprovalNotification(borrowerId, contractId, sponsorName, remainingSponsors);

// Remind other sponsors
await notificationService.sendSponsorReminderNotification(sponsorId, borrowerId, contractId, approvedCount, totalCount);

// When a sponsor rejects
await notificationService.sendSponsorRejectionNotification(borrowerId, contractId, sponsorName);
await notificationService.sendSponsorRejectionUpdateNotification(sponsorId, borrowerId, contractId);
```

### Step 5: Contract Finalization

```javascript
// When contract is activated
await notificationService.sendContractActivationNotification(borrowerId, contractId, firstPaymentDate);
await notificationService.sendSponsorActivationNotification(sponsorId, borrowerId, contractId, firstPaymentDate);
await notificationService.sendAdminActivationNotification(contractId, borrowerId);

// When contract is rejected
await notificationService.sendContractRejectionNotification(borrowerId, contractId, reason);
await notificationService.sendSponsorRejectionUpdateNotification(sponsorId, borrowerId, contractId);
```

### Step 6: Payment Cycle

```javascript
// 3-day payment reminder (automated via cron)
await notificationService.sendPaymentReminderNotification(borrowerId, loanId, amount, dueDate);

// Payment confirmation
await notificationService.sendPaymentConfirmationNotification(borrowerId, loanId, amount, nextPaymentDate);

// Late payment notification
await notificationService.sendLatePaymentNotification(borrowerId, loanId, amount, penalty);
```

### Step 7: Loan Completion

```javascript
// When loan is fully paid
await notificationService.sendLoanCompletionNotification(borrowerId, loanId);
await notificationService.sendSponsorCompletionNotification(sponsorId, borrowerId, loanId);
await notificationService.sendAdminCompletionNotification(loanId, borrowerId);
```

## Integration Points

### Contract Controller Integration

The contract controller has been updated to include notification calls at key lifecycle stages:

1. **Contract Creation**: Notifies borrower and admin
2. **Document Approval**: Notifies borrower and sponsors
3. **Sponsor Approval**: Notifies all parties appropriately
4. **Contract Activation**: Notifies all parties with payment details
5. **Contract Rejection**: Notifies all parties with reasons

### Payment Controller Integration

The payment controller now includes:

1. **Automated Reminders**: 3-day payment reminders via cron
2. **Payment Confirmation**: Immediate confirmation with next payment date
3. **Late Payment Alerts**: Automatic late fee notifications
4. **Loan Completion**: Celebration notifications for all parties

### Document Controller Integration

Document review notifications are integrated into the document approval workflow:

1. **Document Upload**: Notifies admins of pending reviews
2. **Document Approval**: Notifies borrower (in-app only)
3. **Document Rejection**: Notifies borrower with reasons (dual notification)

## Configuration

### Email Setup

Ensure the following environment variables are set:

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
JWT_SECRET=your-jwt-secret
```

### Cron Job Setup

The payment reminder system uses node-cron for scheduling:

```javascript
// Runs daily at 9 AM
cron.schedule('0 9 * * *', () => {
  checkUpcomingPayments();
  checkLatePayments();
});
```

## Error Handling

The notification system includes comprehensive error handling:

1. **Email Failures**: Fallback to in-app notifications only
2. **Database Errors**: Graceful degradation
3. **Timeout Protection**: 10-second email timeout
4. **Logging**: Detailed error logging for debugging

## Testing

### Manual Testing

Test each notification type manually:

```javascript
// Test contract submission notification
await notificationService.sendContractSubmissionNotification(userId, contractId);

// Test payment reminder
await notificationService.sendPaymentReminderNotification(userId, loanId, 1000, '2024-01-15');

// Test loan completion
await notificationService.sendLoanCompletionNotification(userId, loanId);
```

### Automated Testing

Create test cases for each notification type:

```javascript
describe('Notification System', () => {
  test('Contract submission notification', async () => {
    // Test implementation
  });
  
  test('Payment reminder notification', async () => {
    // Test implementation
  });
  
  test('Loan completion notification', async () => {
    // Test implementation
  });
});
```

## Performance Considerations

1. **Batch Processing**: Notifications are sent in parallel where possible
2. **Database Optimization**: Efficient queries for notification data
3. **Email Rate Limiting**: Built-in timeout protection
4. **Memory Management**: Proper cleanup of notification objects

## Monitoring

### Key Metrics

1. **Notification Delivery Rate**: Track successful vs failed deliveries
2. **Email Delivery Rate**: Monitor email service reliability
3. **User Engagement**: Track notification read rates
4. **System Performance**: Monitor notification processing times

### Logging

The system includes comprehensive logging:

```javascript
console.log(`In-app notification created for user ${userId}: ${type}`);
console.log(`Email sent to ${user.email}: ${emailSubject}`);
console.error('Error sending dual notification:', error);
```

## Future Enhancements

1. **Push Notifications**: Mobile app integration
2. **SMS Notifications**: Critical alerts via SMS
3. **Notification Preferences**: User-configurable notification settings
4. **Advanced Scheduling**: More sophisticated reminder timing
5. **Analytics Dashboard**: Notification performance metrics

## Troubleshooting

### Common Issues

1. **Email Not Sending**: Check EMAIL_USER and EMAIL_PASS environment variables
2. **Notifications Not Appearing**: Verify database connection and user ID
3. **Duplicate Notifications**: Check for race conditions in notification creation
4. **Performance Issues**: Monitor database query performance

### Debug Mode

Enable debug logging by setting:

```javascript
process.env.NODE_ENV = 'development';
```

This will provide detailed error stack traces and additional logging information.

## Security Considerations

1. **User Authorization**: All notifications verify user permissions
2. **Data Privacy**: Sensitive information is not included in notifications
3. **Rate Limiting**: Built-in protection against notification spam
4. **Audit Trail**: All notification activities are logged

## API Reference

### Core Functions

```javascript
// Create in-app notification only
await notificationService.createNotification(userId, type, message, contractId);

// Send dual notification (in-app + email)
await notificationService.sendDualNotification(userId, type, message, contractId, emailSubject, emailHtml);

// Send in-app only notification
await notificationService.sendInAppOnly(userId, type, message, contractId);

// Check pending actions
const pendingActions = await notificationService.checkPendingActions(userId);

// Mark notification as read
await notificationService.markNotificationAsRead(userId, notificationId);

// Get user notifications
const notifications = await notificationService.getUserNotifications(userId, limit);

// Get unread count
const unreadCount = await notificationService.getUnreadNotificationCount(userId);
```

### Lifecycle Functions

```javascript
// Contract lifecycle
await notificationService.sendContractSubmissionNotification(borrowerId, contractId);
await notificationService.sendContractActivationNotification(borrowerId, contractId, firstPaymentDate);
await notificationService.sendContractRejectionNotification(borrowerId, contractId, reason);

// Sponsor lifecycle
await notificationService.sendSponsorshipRequestNotification(sponsorId, borrowerId, contractId);
await notificationService.sendSponsorApprovalNotification(borrowerId, contractId, sponsorName, remainingSponsors);
await notificationService.sendSponsorRejectionNotification(borrowerId, contractId, sponsorName);

// Payment lifecycle
await notificationService.sendPaymentReminderNotification(borrowerId, loanId, amount, dueDate);
await notificationService.sendPaymentConfirmationNotification(borrowerId, loanId, amount, nextPaymentDate);
await notificationService.sendLatePaymentNotification(borrowerId, loanId, amount, penalty);

// Completion lifecycle
await notificationService.sendLoanCompletionNotification(borrowerId, loanId);
await notificationService.sendSponsorCompletionNotification(sponsorId, borrowerId, loanId);
await notificationService.sendAdminCompletionNotification(loanId, borrowerId);
```

This comprehensive notification system ensures that all parties are kept informed throughout the loan lifecycle, enhancing user experience and operational efficiency. 