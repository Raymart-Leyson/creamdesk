# Payment System Implementation Guide

## Overview
The payment system has been implemented using InstaPay (Philippines) with manual verification via Facebook.

## Pricing Structure (1 USD = 60 PHP)

| Package | Tokens | Price (PHP) | Price (USD) |
|---------|--------|-------------|-------------|
| Starter Pack | 100 | ₱300 | ~$5 |
| Pro Pack | 250 | ₱600 | ~$10 |
| Premium Pack | 500 | ₱1,080 | ~$18 |
| Ultimate Pack | 1000 | ₱1,800 | ~$30 |

## Customer Flow

1. **Browse Packages**: Users visit `/shop` to see available token packages
2. **Select Package**: Click on desired package to see payment instructions
3. **Pay via InstaPay**: Scan QR code and send exact amount
4. **Send Proof**: Message Facebook page with:
   - Payment screenshot
   - CreamDesk account email
   - Package name purchased
5. **Receive Tokens**: Admin verifies and adds tokens (usually within 24 hours)

## International Payments (Wise / PayPal)

For customers outside the Philippines:
1. Select "International" toggle on the shop page to see USD pricing
2. Message the Facebook page to request Wise or PayPal payment details
3. Send payment and proof via Facebook
4. Admin manually verifies and adds tokens

## Admin Flow

1. **Receive Payment Proof**: Customer messages Facebook page
2. **Verify Payment**: Check InstaPay transaction
3. **Add Tokens**: Go to `/admin/tokens`
4. **Enter Details**:
   - Customer's email address
   - Token amount (based on package purchased)
5. **Submit**: Tokens are instantly added to customer's account

## Important Files

### Customer-Facing
- `/src/app/shop/page.tsx` - Token shop page
- `/public/instapay-qr.png` - **YOU NEED TO ADD YOUR QR CODE IMAGE HERE**

### Admin
- `/src/app/admin/tokens/page.tsx` - Admin panel for adding tokens
- `/src/actions/token-actions.ts` - Server actions for token management

### UI Updates
- `/src/components/desktop/MenuBar.tsx` - Added "Buy Tokens" button

## Setup Required

### 1. Add QR Code Image
Copy your InstaPay QR code image to:
```
c:\Users\Drayley\OneDrive\Documents\Business Shop\connectorhub\public\instapay-qr.png
```

### 2. Access Admin Panel
Navigate to: `http://localhost:3000/admin/tokens` (or your production URL)

### 3. Facebook Page
Your Facebook page for payment verification:
https://www.facebook.com/profile.php?id=61588058491528

## Security Notes

- Admin page has no authentication (you should add this!)
- Consider adding password protection or IP whitelist
- All token operations use server actions for security
- Supabase RLS policies protect user data

## Recommended Next Steps

1. **Add Authentication to Admin Panel**
   - Use environment variable for admin password
   - Or restrict by IP address
   - Or use Supabase auth with admin role

2. **Add Payment Tracking**
   - Create a `payments` table to log all transactions
   - Track pending vs completed payments
   - Store payment screenshots

3. **Automate Notifications**
   - Email user when tokens are added
   - Send receipt/confirmation

4. **Add Discount System**
   - Implement promo codes
   - Track referrals from Facebook followers

## Testing

1. Test the shop page: `http://localhost:3000/shop`
2. Test admin panel: `http://localhost:3000/admin/tokens`
3. Verify "Buy Tokens" button appears in MenuBar
4. Test adding tokens with a real user email

## Support

Customers should message your Facebook page with payment proof:
https://www.facebook.com/profile.php?id=61588058491528
