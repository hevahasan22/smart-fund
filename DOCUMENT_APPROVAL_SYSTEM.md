# Document Approval System Guide

## Overview

The Smart Fund application now includes a comprehensive document approval system where admins manually review and approve documents before contracts can proceed to the sponsor approval stage. This ensures document quality and compliance before processing contracts.

## System Flow

### 1. Document Upload Process
1. **User uploads documents** during contract creation or separately
2. **Documents are stored** with `pending` status
3. **Admin receives notification** about new documents pending review
4. **Admin reviews documents** and approves/rejects them
5. **User receives notification** about document status
6. **Contract proceeds** to sponsor approval only after all documents are approved

### 2. Contract Status Flow
```
Contract Created → pending_document_approval → pending_sponsor_approval → pending_processing → approved/rejected
```

## API Endpoints

### User Endpoints

#### Upload Document
```http
POST /api/documents/upload
Content-Type: multipart/form-data

{
  "contractID": "contract_id",
  "typeID": "document_type_id",
  "documentFile": "file"
}
```

#### Get Documents by Contract
```http
GET /api/documents/contract/:contractID
```

#### Get Single Document
```http
GET /api/documents/:id
```

#### Delete Document
```http
DELETE /api/documents/:id
```

### Admin Endpoints

#### Review Document
```http
PUT /api/documents/review/:id
Content-Type: application/json

{
  "status": "approved|rejected",
  "rejectionReason": "reason if rejected",
  "adminNotes": "optional admin notes"
}
```

#### Get Pending Documents
```http
GET /api/documents/admin/pending?page=1&limit=20&contractId=optional
```

#### Get Document Statistics
```http
GET /api/documents/admin/stats
```

## Document Model Schema

```javascript
{
  typeID: ObjectId,           // Reference to document type
  contractID: ObjectId,       // Reference to contract
  documentFile: {
    url: String,              // Cloudinary URL
    public_id: String         // Cloudinary public ID
  },
  uploadedBy: ObjectId,       // User who uploaded
  uploadedAt: Date,           // Upload timestamp
  status: String,             // 'pending', 'approved', 'rejected'
  rejectionReason: String,    // Reason if rejected
  reviewedBy: ObjectId,       // Admin who reviewed
  reviewedAt: Date,           // Review timestamp
  adminNotes: String          // Optional admin notes
}
```

## Notification System

### Document Upload
- **Admin Notification**: All admins receive notification about new pending documents
- **Email**: Admin receives email with document details

### Document Review
- **Approval**: User receives notification that document is approved
- **Rejection**: User receives notification with rejection reason
- **Email**: User receives email notification for both cases

### Contract Processing
- **Document Completion**: User notified when all documents are approved and contract proceeds
- **Email**: User receives email about contract status change

## Admin Dashboard Features

### 1. Pending Documents Queue
- View all documents pending review
- Filter by contract ID
- Pagination support
- Document details and preview

### 2. Document Review Interface
- View document file
- Approve or reject with reason
- Add admin notes
- Bulk review options

### 3. Statistics Dashboard
- Total documents count
- Pending/Approved/Rejected counts
- Recent activity (uploads/reviews)
- Percentage breakdowns

## Implementation Details

### Document Validation
- File type validation
- Size limits
- Required field validation
- Contract access validation

### Security Features
- Admin-only review access
- User can only access their own documents
- Contract participants can view documents
- Secure file storage with Cloudinary

### Error Handling
- Comprehensive error messages
- Graceful failure handling
- Logging for debugging
- User-friendly error responses

## Usage Examples

### Frontend Integration

#### Upload Document
```javascript
const formData = new FormData();
formData.append('contractID', contractId);
formData.append('typeID', documentTypeId);
formData.append('documentFile', file);

const response = await fetch('/api/documents/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

#### Admin Review Document
```javascript
const response = await fetch(`/api/documents/review/${documentId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  },
  body: JSON.stringify({
    status: 'approved',
    adminNotes: 'Document looks good'
  })
});
```

#### Get Pending Documents (Admin)
```javascript
const response = await fetch('/api/documents/admin/pending?page=1&limit=20', {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
```

## Best Practices

### For Users
1. **Upload clear, readable documents**
2. **Follow document type requirements**
3. **Check document status regularly**
4. **Respond to rejection reasons promptly**

### For Admins
1. **Review documents promptly**
2. **Provide clear rejection reasons**
3. **Use admin notes for internal communication**
4. **Monitor document statistics regularly**

### For Developers
1. **Implement proper error handling**
2. **Add comprehensive logging**
3. **Test notification system thoroughly**
4. **Monitor system performance**

## Troubleshooting

### Common Issues

#### Document Upload Fails
- Check file size limits
- Verify file type is supported
- Ensure user has contract access
- Check Cloudinary configuration

#### Admin Can't Review Documents
- Verify admin role permissions
- Check authentication token
- Ensure document exists and is pending

#### Notifications Not Sending
- Check email configuration
- Verify notification service is running
- Check user email addresses are valid

#### Contract Not Proceeding
- Verify all required documents are approved
- Check contract status flow
- Review document completion logic

## Configuration

### Environment Variables
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
```

### File Upload Limits
- Maximum file size: 10MB
- Supported formats: PDF, JPG, PNG, DOC, DOCX
- Cloudinary folder: 'documents'

## Monitoring and Maintenance

### Regular Tasks
1. **Monitor pending document queue**
2. **Review document statistics**
3. **Check notification delivery**
4. **Clean up rejected documents**
5. **Update document type requirements**

### Performance Optimization
1. **Index database queries**
2. **Optimize file uploads**
3. **Cache document metadata**
4. **Monitor Cloudinary usage**

This document approval system ensures quality control and compliance while providing a smooth user experience and comprehensive admin tools for document management. 