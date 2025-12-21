# Firebase Security Rules

This directory contains the security rules for your Firebase project.

## Files

- **firestore.rules** - Firestore database security rules
- **storage.rules** - Firebase Storage security rules

## Deployment

To deploy these rules to your Firebase project, use:

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage:rules

# Or deploy both at once
firebase deploy --only firestore:rules,storage:rules
```

## Security Model

All rules enforce user authentication and ownership. Users can only access their own data under `/users/{uid}/...` paths.

### Firestore Collections

- `/users/{uid}/employees/{employeeId}` - Employee records
- `/users/{uid}/payrollEntries/{entryId}` - Payroll entries
- `/users/{uid}/private/prequal` - Pre-qualification status
- `/users/{uid}/private/profile` - User profile (logo, email, etc.)
- `/users/{uid}/private/w9` - W-9 form data
- `/users/{uid}/private/agreement` - Agreement data
- `/users/{uid}/profile/main` - Signup profile document
- `/users/{uid}/invoices/{invoiceId}` - Invoice records
- `/users/{uid}/audit/current` - Audit questionnaire and metadata

### Storage Paths

- `users/{uid}/profile/logo_*` - Profile logos (5MB max, images only)
- `users/{uid}/coi/*` - COI documents (10MB max, PDF/images)
- `users/{uid}/audit/*` - Audit documents (10MB max, PDF/images)
- `users/{uid}/contracts/*` - Contract files (20MB max, PDF/images/HEIC)

## Important Notes

1. All paths require authentication (`request.auth != null`)
2. Users can only access paths matching their own UID
3. File size limits are enforced in Storage rules
4. Content type validation is enforced for Storage uploads
5. Firestore rules include validation for payroll data (dates, amounts, methods)

