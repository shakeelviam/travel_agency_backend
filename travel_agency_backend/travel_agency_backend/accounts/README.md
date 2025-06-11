# Payment Handling

## Important Note

**DO NOT MODIFY ERPNEXT PAYMENT FUNCTIONALITY**

The standard ERPNext payment mechanisms should be used without any modifications or overrides. ERPNext already has built-in functionality to:

1. Create payment entries from Sales Invoices
2. Create payment entries from Purchase Invoices 
3. Handle payment workflows through the standard UI

Our travel agency backend app should only be concerned with:
- Creating Trip Bookings
- Managing services within Trip Bookings
- Creating Sales and Purchase Invoices from Trip Bookings

Payment processing should always be left to the standard ERPNext functionality with no overrides or custom code.

## Troubleshooting

If you encounter payment-related errors, check:

1. Make sure Mode of Payment is correctly set up with appropriate accounts
2. Ensure your Company has default bank and cash accounts properly configured
3. Check that no custom code in this app is trying to override ERPNext payment methods
