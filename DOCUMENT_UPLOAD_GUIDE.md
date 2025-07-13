# Document Upload Guide

## Overview
Documents are **required** for all loan contracts. The system will reject incomplete applications that don't include all required documents.

## How to Upload Documents

### 1. Check Required Documents First
Before creating a contract, check what documents are required for your loan type:

```bash
GET /api/contracts/required-documents/:loanTypeId
```

**Example Response:**
```json
{
  "loanTypeId": "507f1f77bcf86cd799439011",
  "typeTermId": "507f1f77bcf86cd799439012",
  "requiredDocuments": [
    {
      "id": "507f1f77bcf86cd799439013",
      "name": "National ID",
      "description": "Valid government-issued identification",
      "isRequired": true
    },
    {
      "id": "507f1f77bcf86cd799439014", 
      "name": "Proof of Income",
      "description": "Salary certificate or bank statements",
      "isRequired": true
    }
  ],
  "totalRequired": 2
}
```

### 2. Prepare Your Files
- **Supported formats**: PDF, JPG, PNG, DOC, DOCX
- **File size limit**: 10MB per file
- **File names**: Use descriptive names (e.g., "national_id.pdf", "salary_certificate.pdf")

### 3. Upload Documents with Contract Creation

**Endpoint:** `POST /api/contracts/apply`

**Content-Type:** `multipart/form-data`

**Required Fields:**
- All contract fields (loanType, loanTerm, loanAmount, etc.)
- **Document files** with specific field names

**Field Naming Convention:**
```
doc_[documentTypeId]
```

**Example:**
If you have a document type with ID `507f1f77bcf86cd799439013` named "National ID", use:
```
doc_507f1f77bcf86cd799439013
```

### 4. Complete Example

**Using cURL:**
```bash
curl -X POST http://localhost:4000/api/contracts/apply \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "loanType=Medical" \
  -F "loanTerm=12 months" \
  -F "loanAmount=5000" \
  -F "loanTermMonths=12" \
  -F "employmentStatus=employed" \
  -F "sponsorEmail1=sponsor1@example.com" \
  -F "sponsorEmail2=sponsor2@example.com" \
  -F "doc_507f1f77bcf86cd799439013=@/path/to/national_id.pdf" \
  -F "doc_507f1f77bcf86cd799439014=@/path/to/salary_certificate.pdf"
```

**Using JavaScript/Fetch:**
```javascript
const formData = new FormData();
formData.append('loanType', 'Medical');
formData.append('loanTerm', '12 months');
formData.append('loanAmount', '5000');
formData.append('loanTermMonths', '12');
formData.append('employmentStatus', 'employed');
formData.append('sponsorEmail1', 'sponsor1@example.com');
formData.append('sponsorEmail2', 'sponsor2@example.com');

// Add documents
formData.append('doc_507f1f77bcf86cd799439013', nationalIdFile);
formData.append('doc_507f1f77bcf86cd799439014', salaryCertificateFile);

const response = await fetch('/api/contracts/apply', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Using HTML Form:**
```html
<form action="/api/contracts/apply" method="POST" enctype="multipart/form-data">
  <input type="hidden" name="loanType" value="Medical">
  <input type="hidden" name="loanTerm" value="12 months">
  <input type="hidden" name="loanAmount" value="5000">
  <input type="hidden" name="loanTermMonths" value="12">
  <input type="hidden" name="employmentStatus" value="employed">
  <input type="hidden" name="sponsorEmail1" value="sponsor1@example.com">
  <input type="hidden" name="sponsorEmail2" value="sponsor2@example.com">
  
  <label>National ID:</label>
  <input type="file" name="doc_507f1f77bcf86cd799439013" required>
  
  <label>Proof of Income:</label>
  <input type="file" name="doc_507f1f77bcf86cd799439014" required>
  
  <button type="submit">Submit Application</button>
</form>
```

## Error Handling

### Missing Documents Error
```json
{
  "error": "Missing required document: National ID",
  "message": "All required documents must be uploaded to complete your application",
  "missingDocument": {
    "id": "507f1f77bcf86cd799439013",
    "name": "National ID",
    "description": "Valid government-issued identification"
  },
  "requiredDocuments": [
    {
      "id": "507f1f77bcf86cd799439013",
      "name": "National ID",
      "description": "Valid government-issued identification",
      "provided": false
    },
    {
      "id": "507f1f77bcf86cd799439014",
      "name": "Proof of Income", 
      "description": "Salary certificate or bank statements",
      "provided": true
    }
  ],
  "instructions": {
    "fieldName": "doc_507f1f77bcf86cd799439013",
    "howToUpload": "Send files using multipart/form-data with the correct field names"
  }
}
```

### No Files Provided Error
```json
{
  "error": "Documents are required for this loan type",
  "message": "Please upload all required documents to complete your application",
  "requiredDocuments": [
    {
      "id": "507f1f77bcf86cd799439013",
      "name": "National ID",
      "description": "Valid government-issued identification"
    }
  ],
  "instructions": {
    "howToUpload": "Send files using multipart/form-data with field names like \"doc_[documentTypeId]\"",
    "example": "For document type National ID, use field name \"doc_507f1f77bcf86cd799439013\""
  }
}
```

## Common Document Types

### Personal Documents
- **National ID**: Government-issued identification
- **Passport**: Valid passport (if applicable)
- **Birth Certificate**: Official birth certificate

### Financial Documents
- **Proof of Income**: Salary certificate, pay stubs, or bank statements
- **Bank Statements**: Last 3-6 months of bank statements
- **Tax Returns**: Recent tax return documents

### Employment Documents
- **Employment Certificate**: Letter from employer confirming employment
- **Contract**: Employment contract or agreement
- **Business License**: For self-employed individuals

### Property Documents (if applicable)
- **Property Deed**: Ownership documents
- **Rental Agreement**: Current rental contract
- **Utility Bills**: Recent utility bill statements

## Best Practices

1. **Check Requirements First**: Always check what documents are required before starting
2. **Use Correct Field Names**: Ensure document field names match the required format
3. **File Quality**: Ensure documents are clear and readable
4. **File Size**: Keep files under 10MB for faster upload
5. **File Format**: Use PDF when possible for better compatibility
6. **Descriptive Names**: Use meaningful file names for easier identification

## Troubleshooting

### "Missing required document" Error
1. Check the required documents list for your loan type
2. Ensure all required documents are uploaded
3. Verify field names match the document type IDs
4. Check file format and size

### Upload Failures
1. Check file size (max 10MB)
2. Verify file format is supported
3. Check internet connection
4. Try uploading one file at a time

### Processing Errors
1. Check server logs for detailed error messages
2. Verify all documents are properly uploaded
3. Ensure contract data is complete and valid 