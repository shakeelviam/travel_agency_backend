import frappe
from frappe import _

# This is a direct monkey patch for the get_default_bank_cash_account function in ERPNext
# that simply removes the ignore_permissions parameter if it exists

def apply_patches():
    """Apply all necessary patches to fix incompatibility issues with ERPNext"""
    
    # Import the function that needs patching
    from erpnext.accounts.doctype.payment_entry.payment_entry import get_bank_cash_account

    # Store the original function
    original_get_bank_cash_account = get_bank_cash_account
    
    # Create a simple wrapper that handles the ignore_permissions parameter
    def patched_get_bank_cash_account(doc, bank_account=None, **kwargs):
        """
        Simple wrapper that removes the ignore_permissions parameter if present
        and passes all other arguments through to the original function
        """
        # Remove ignore_permissions if it exists in kwargs
        if 'ignore_permissions' in kwargs:
            del kwargs['ignore_permissions']
            
        # Call the original function with all remaining parameters
        return original_get_bank_cash_account(doc, bank_account, **kwargs)
    
    # Apply the patch
    import erpnext.accounts.doctype.payment_entry.payment_entry as payment_entry
    payment_entry.get_bank_cash_account = patched_get_bank_cash_account
    
    frappe.log_error("Payment Entry monkey patch applied", "Payment Entry Fix")
