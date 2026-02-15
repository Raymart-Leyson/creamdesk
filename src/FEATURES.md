# App Features & Differentiation Strategy

This document outlines the current feature set of the CreamDesk application and the differentiation strategy between Free/Top-up users and Monthly Subscribers.

## Core Applications (Available to All Users)
*   **Desktop Environment:** Window management, taskbar, start menu, and themes.
*   **Docs App:** Rich text editor with support for .docx and .pdf imports, export options, and formatting tools.
*   **Drive App:** Cloud file storage and management.
*   **Study App:** AI-powered study companion (Notes, Flashcards, Quizzes).
*   **Productivity Tools:** Calendar, Tasks, Notes.

## Differentiation Strategy

We differentiate users based on **Subscription Status**. A user is considered a **Subscriber** if they have an active token expiration date (provided by Monthly/Semester packs). Users without an expiration date (or expired) are considered **Free/Standard**.

### Feature Matrix

| Feature | Free / Top-up User | Monthly / Semester Subscriber |
| :--- | :--- | :--- |
| **App Access** | **Full Access** to all apps | **Full Access** to all apps |
| **Token Cost** | Standard Check-out Price | **Discounted** (Bulk pricing) |
| **AI Study Notes** | ✅ Unlimited Generation | ✅ Unlimited Generation |
| **AI Flashcards** | ✅ Standard Generation | ✅ Standard Generation |
| **AI Quizzes** | ⚠️ **Limited** (Multiple Choice / Mixed only) | ✅ **Full Access** (Identification, Enumeration unlocked) |
| **Token Validity** | ⏳ No Expiry (Keep forever) | 📅 Monthly Reset (Resets to 100 if > 100) |
| **Storage** | 📦 Standard Limit | ☁️ **Premium Limit** (Higher capability) |
| **Support** | 💬 Standard | ⚡ **Priority Support** |

## Implementation Details

### 1. Shop Page (`src/app/shop/page.tsx`)
A new **"Why Go Monthly?"** comparison table has been added to the Shop page to clearly communicate these benefits to users before purchasing.

### 2. Token System (`src/actions/token-actions.ts`)
*   **`addTokens`**: Updated to support `expiryDays`. This allows Admin tools or Webhooks to grant "Monthly" status by setting an expiration date when a package is purchased.
*   **`getUserTokens`**: Automatically handles the "Use it or lose it" logic (Resets >100 tokens to 100 upon expiration).

### 3. Study App (`src/actions/study-actions.ts`)
*   **Quiz Gating**: The backend now checks for an active subscription before generating **Identification** or **Enumeration** quizzes.
*   **Error Handling**: Free users attempting to generate premium quizzes effectively receive an upgrade prompt via the error message.

## Recommendations for Future Restrictions
To further drive subscriptions, consider implementing:
*   **Flashcard Limits:** Cap Free users to 15 cards per generation.
*   **Storage Quotas:** Enforce the 100MB limit in `DriveApp` using Supabase Storage Policies.
*   **Visual Badging:** Add a "PRO" or "SCHOLAR" badge to the Desktop for subscribers.
