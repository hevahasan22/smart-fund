# Sponsor Validation Rules

## Overview

The loan contract system implements comprehensive sponsor validation to ensure the integrity and reliability of the lending process. This document outlines all validation rules that are enforced when a user applies for a loan contract.

## Validation Rules

### 1. Active Loan Restriction
**Rule**: Users with active (uncompleted) loans cannot be sponsors for other loans.

**Implementation**:
```javascript
// Check if sponsors have active loans
const [sponsor1ActiveLoans, sponsor2ActiveLoans] = await Promise.all([
  Contract.countDocuments({
    userID: sponsor1._id,
    status: { $in: ['approved', 'active'] }
  }),
  Contract.countDocuments({
    userID: sponsor2._id,
    status: { $in: ['approved', 'active'] }
  })
]);
```

**What counts as an active loan**:
- Contracts with status: `'approved'` or `'active'`
- Only these statuses indicate an ongoing loan obligation

**What does NOT count as an active loan**:
- Contracts with status: `'pending'`, `'rejected'`, `'completed'`
- These statuses do not prevent sponsorship

**Error Response**:
```json
{
  "error": "One or both sponsors have active loans and cannot sponsor other loans",
  "sponsorsWithActiveLoans": ["user@example.com"],
  "details": "Borrowers with active (uncompleted) loans cannot be sponsors for other loans"
}
```

### 2. Self-Sponsorship Prevention
**Rule**: Users cannot sponsor their own loan contracts.

**Implementation**:
```javascript
// Check if sponsors are trying to sponsor their own contract
const selfSponsorshipAttempts = [];
if (sponsor1._id.equals(userId)) selfSponsorshipAttempts.push(sponsorEmail1);
if (sponsor2._id.equals(userId)) selfSponsorshipAttempts.push(sponsorEmail2);
```

**Error Response**:
```json
{
  "error": "You cannot be your own sponsor",
  "selfSponsorshipAttempts": ["user@example.com"],
  "details": "Borrowers cannot sponsor their own loan contracts"
}
```

### 3. Maximum Sponsorship Limit
**Rule**: Users can sponsor a maximum of 2 loans ever, across all loan types.

**Implementation**:
```javascript
// Check total sponsor limit (maximum 2 loans ever, across all loan types)
const [sponsor1TotalCount, sponsor2TotalCount] = await Promise.all([
  Contract.countDocuments({
    $or: [{ sponsorID_1: sponsor1._id }, { sponsorID_2: sponsor1._id }],
    status: { $in: ['approved', 'active'] }
  }),
  Contract.countDocuments({
    $or: [{ sponsorID_1: sponsor2._id }, { sponsorID_2: sponsor2._id }],
    status: { $in: ['approved', 'active'] }
  })
]);
```

**What counts toward the limit**:
- Contracts where the user is either `sponsorID_1` or `sponsorID_2`
- Only contracts with status: `'approved'` or `'active'`
- Counts across ALL loan types (not per loan type)

**Error Response**:
```json
{
  "error": "One or both sponsors have reached their maximum sponsorship limit (2 loans)",
  "sponsorsAtLimit": ["user@example.com"],
  "details": "Sponsors can only sponsor a maximum of 2 loans across all loan types"
}
```

## Validation Order

The validation checks are performed in the following order:

1. **Basic Sponsor Eligibility** - Check if sponsors exist and have eligible status
2. **Active Loan Check** - Ensure sponsors don't have active loans
3. **Self-Sponsorship Check** - Prevent users from sponsoring their own contracts
4. **Total Sponsorship Limit** - Ensure sponsors haven't reached the 2-loan limit
5. **Document Requirements** - Check if documents are required for the loan type

## Contract Status Definitions

### Active Statuses (Prevent Sponsorship)
- `'approved'` - Contract has been approved and loan is active
- `'active'` - Loan is currently active and being paid

### Inactive Statuses (Allow Sponsorship)
- `'pending'` - Contract is pending approval
- `'pending_document_upload'` - Waiting for document upload
- `'pending_sponsor_approval'` - Waiting for sponsor approval
- `'pending_processing'` - Contract is being processed
- `'rejected'` - Contract was rejected
- `'completed'` - Loan has been fully paid and completed

## Examples

### Example 1: Valid Sponsors
```javascript
// User A: No active loans, has sponsored 1 loan
// User B: No active loans, has sponsored 0 loans
// Result: Both users can be sponsors
```

### Example 2: Invalid - Active Loan
```javascript
// User A: Has an active loan (status: 'approved')
// User B: No active loans, has sponsored 1 loan
// Result: User A cannot be a sponsor, User B can
```

### Example 3: Invalid - Self-Sponsorship
```javascript
// Borrower: john@example.com
// Sponsor1: john@example.com (same user)
// Sponsor2: jane@example.com
// Result: Self-sponsorship attempt blocked
```

### Example 4: Invalid - At Limit
```javascript
// User A: No active loans, has sponsored 2 loans
// User B: No active loans, has sponsored 1 loan
// Result: User A cannot sponsor more, User B can
```

## Testing

Use the provided test file to verify all validation rules:

```bash
node test-sponsor-validation-complete.js
```

The test file covers:
- Users with active loans
- Self-sponsorship attempts
- Users at sponsorship limit
- Eligible sponsors
- Edge cases with different contract statuses
- New users without any contracts

## Error Handling

All validation errors return a consistent format:

```json
{
  "error": "Human-readable error message",
  "fieldName": ["list", "of", "problematic", "emails"],
  "details": "Additional explanation of the validation rule"
}
```

## Performance Considerations

- All database queries are performed in parallel using `Promise.all()`
- Queries are optimized to only count relevant contracts
- Validation stops at the first failure to avoid unnecessary processing

## Security Considerations

- All user IDs are validated before database queries
- Email addresses are validated for format and existence
- No sensitive information is exposed in error messages
- All validation rules are enforced server-side

## Future Enhancements

Potential improvements to consider:
1. **Sponsorship History Tracking** - Track sponsorship performance
2. **Dynamic Limits** - Adjust limits based on user credit score
3. **Temporary Bans** - Prevent sponsorship after loan defaults
4. **Sponsorship Preferences** - Allow users to set sponsorship preferences
5. **Notification System** - Alert users when approaching sponsorship limits

## Integration with Notification System

The sponsor validation system integrates with the comprehensive notification system:

- **Sponsorship Request Notifications** - Only sent to eligible sponsors
- **Validation Error Notifications** - Inform borrowers of sponsor issues
- **Sponsorship Limit Warnings** - Alert sponsors approaching their limit

This ensures a seamless user experience while maintaining strict validation rules. 