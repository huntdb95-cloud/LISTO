# Bookkeeping Page Rebuild Summary

## Overview
Rebuilt the Bookkeeping page from a payroll/employee management tool into a 1099 laborer tracking system with document upload capabilities (W-9 and COI).

## Changes Made

### 1. **bookkeeping/bookkeeping.html**
**Complete rebuild:**
- Removed old payroll/employee tabs structure
- Added summary cards showing:
  - Total Paid (date range)
  - Laborers Paid count
  - YTD Total Paid
- Added date range filter (from/to dates with reset button)
- Created two-column layout:
  - Left: Laborers list with search
  - Right: Laborer detail panel
- Laborer detail includes:
  - Form fields (displayName, type, phone, email, address, tinLast4, notes, isArchived)
  - Documents section with W-9 upload (all laborers) and COI upload (subcontractors only)
  - Payments section with add payment form and payments table
- Fully responsive CSS with mobile breakpoints
- All styles scoped with `bookkeeping-` prefix to prevent conflicts

### 2. **bookkeeping/bookkeeping.js**
**Complete rebuild with new data model:**

**Data Collections:**
- `users/{uid}/laborers/{laborerId}` - Laborer records
- `users/{uid}/payments/{paymentId}` - Payment records linked to laborers

**Laborer Fields:**
- `displayName` (required)
- `laborerType` (required): "Worker" or "Subcontractor"
- `phone`, `email`, `address`, `tinLast4`, `notes` (optional)
- `isArchived` (boolean)
- `documents` (object with `w9` and `coi` metadata)
- `createdAt`, `updatedAt` (timestamps)

**Payment Fields:**
- `laborerId` (required, links to laborer)
- `datePaid` (required)
- `amount` (required)
- `method` (required): "Cash", "Check", "Zelle", "ACH", "Other"
- `memo` (optional)
- `createdAt` (timestamp)

**Key Functions:**
- `loadLaborers()` - Load all laborers from Firestore
- `loadPayments()` - Load all payments from Firestore
- `saveLaborer()` - Create or update laborer
- `selectLaborer()` - Select laborer and show detail view
- `renderLaborersList()` - Render laborers list with search filtering
- `renderLaborerDetail()` - Render laborer form and documents
- `renderPayments()` - Render payments table for selected laborer
- `uploadDocument(docType)` - Upload W-9 or COI document
- `removeDocument(docType)` - Remove document (deletes from Storage and Firestore)
- `addPayment()` - Add payment for selected laborer
- `deletePayment()` - Delete payment
- `updateSummaries()` - Calculate and display summary statistics
- `updateDateRange()` - Filter payments by date range

**Document Upload Implementation:**
- W-9: Required for all laborers
- COI: Only shown/uploadable for Subcontractors
- File validation: PDF, JPG, PNG only
- Size limit: 15MB client-side validation
- Storage path: `users/{uid}/laborers/{laborerId}/documents/{docType}/{timestamp}_{filename}`
- Metadata stored in laborer document under `documents.w9` and `documents.coi`
- Each document metadata includes: fileName, contentType, size, storagePath, downloadURL, uploadedAt, updatedAt

### 3. **storage.rules**
**Added rules for laborer documents:**
```
// Laborer W-9: users/{uid}/laborers/{laborerId}/documents/w9/*
// Laborer COI: users/{uid}/laborers/{laborerId}/documents/coi/*
```
- 15MB max file size
- PDF and images allowed
- User must own the path (authenticated, matching UID)

### 4. **firestore.rules**
**Added rules for laborers and payments collections:**
- `users/{uid}/laborers/{laborerId}` - Laborer records with validation
- `users/{uid}/payments/{paymentId}` - Payment records with validation
- Updated `isValidMethod()` to include "ACH" and "Other" payment methods

## Features Implemented

✅ **Laborers Management**
- Create, read, update laborers
- Archive/unarchive laborers (soft delete)
- Search laborers by name
- Display laborer type (Worker/Subcontractor)

✅ **Documents (W-9 & COI)**
- W-9 upload for all laborers
- COI upload only for Subcontractors (UI hidden for Workers)
- View/Download uploaded documents
- Replace existing documents
- Remove documents (with confirmation)
- File validation (PDF, images, 15MB limit)
- Progress indicators and error handling

✅ **Payments Tracking**
- Add payments linked to laborers
- Delete payments (with confirmation)
- Filter payments by date range
- Display payments in table format
- Calculate totals and statistics

✅ **Summary Statistics**
- Total paid in date range
- Number of laborers paid in date range
- YTD total paid (year-to-date)

✅ **Responsive Design**
- Desktop: Two-column layout (list + detail)
- Mobile: Stacked layout, full-width components
- All breakpoints tested (640px, 1024px)

✅ **Security & Validation**
- All operations require authentication
- User can only access their own data
- File type and size validation
- Firestore rules enforce data structure

## Data Model

### Laborer Document Structure
```javascript
{
  displayName: string (required, 1-200 chars),
  laborerType: "Worker" | "Subcontractor" (required),
  phone: string | null,
  email: string | null,
  address: string | null,
  tinLast4: string | null (4 digits),
  notes: string | null,
  isArchived: boolean,
  documents: {
    w9: {
      fileName: string,
      contentType: string,
      size: number,
      storagePath: string,
      downloadURL: string,
      uploadedAt: number (timestamp),
      updatedAt: number (timestamp)
    } | null,
    coi: { ... } | null  // Only for Subcontractors
  },
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Payment Document Structure
```javascript
{
  laborerId: string (required),
  datePaid: string (required, ISO date format),
  amount: number (required, > 0),
  method: "Cash" | "Check" | "Zelle" | "ACH" | "Other" (required),
  memo: string | null,
  createdAt: timestamp
}
```

## Testing Checklist

✅ Add laborer → saves to Firestore
✅ Edit laborer → updates Firestore
✅ Archive laborer → hides from list
✅ Search laborers → filters list
✅ Upload W-9 → stores in Storage + metadata in Firestore
✅ Upload COI (Subcontractor) → stores in Storage + metadata
✅ Change type from Subcontractor to Worker → COI section hides (data preserved)
✅ View/Download documents → opens in new tab
✅ Replace document → deletes old, uploads new
✅ Remove document → deletes from Storage + Firestore
✅ Add payment → saves to Firestore, updates summaries
✅ Delete payment → removes from Firestore, updates summaries
✅ Date range filter → filters payments correctly
✅ Summaries update → correct totals shown
✅ Mobile layout → responsive and usable
✅ No console errors → clean execution

## Files Changed

1. **bookkeeping/bookkeeping.html** - Complete rebuild
2. **bookkeeping/bookkeeping.js** - Complete rebuild
3. **storage.rules** - Added laborer documents rules
4. **firestore.rules** - Added laborers and payments rules

## Notes

- All CSS is scoped with `bookkeeping-` prefix to prevent global conflicts
- Documents are stored with timestamp prefix to prevent overwrites
- COI metadata is preserved when laborer type changes from Subcontractor to Worker (just hidden in UI)
- All file operations include proper error handling and user feedback
- Date range defaults to current month on load
- Payment date defaults to today




