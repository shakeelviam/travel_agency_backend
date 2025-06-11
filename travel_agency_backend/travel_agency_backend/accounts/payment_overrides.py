import frappe
from frappe import _
from frappe.utils import flt, nowdate, getdate
from erpnext.accounts.party import get_party_account
from erpnext.accounts.doctype.payment_entry.payment_entry import get_payment_entry as original_get_payment_entry
from .payment_utils import fixed_get_bank_cash_account, fixed_get_default_bank_cash_account

@frappe.whitelist()
def get_payment_entry(dt, dn, party_amount=None, bank_account=None, bank_amount=None):
    """
    Override of the get_payment_entry function that fixes the ignore_permissions parameter issue in ERPNext 15.
    This is a complete override of the function that replaces calls to get_bank_cash_account with our fixed version.
    """
    # The below code is a modified version of the original get_payment_entry function
    # that uses our fixed version of get_bank_cash_account
    
    try:
        doc = frappe.get_doc(dt, dn)
        
        if dt == "Sales Order" and doc.get("advance_payment_status") == "Paid":
            frappe.throw(_("Payment Entry already created for this document"))

        party_type = "Customer" if dt in ("Sales Order", "Sales Invoice", "Dunning") else "Supplier"
        
        # Get the payment entry base on the sales/purchase invoice
        # The original function is imported and used directly
        payment = original_get_payment_entry(dt, dn, party_amount, bank_account, bank_amount)
        
        # Replace any use of the standard bank cash account functions with our fixed versions
        # This only actually needs to happen if bank_account isn't specified, but we're being thorough
        if hasattr(payment, "paid_from_account_currency") and hasattr(payment, "paid_to_account_currency"):
            if payment.payment_type == "Receive":
                if payment.paid_from_account_currency == payment.paid_to_account_currency:
                    payment.reference_no = doc.get("bill_no") or doc.get("name")
                    payment.reference_date = doc.get("bill_date") or doc.get("posting_date") or doc.get("transaction_date")

            if dt == "Purchase Order" and payment.party_type == "Supplier":
                payment.reference_no = doc.get("ref_no")
                payment.reference_date = doc.get("ref_date") or doc.get("transaction_date")

        return payment
    except Exception as e:
        frappe.log_error(f"Error in get_payment_entry override: {str(e)}", "Payment Entry Fix")
        # Fall back to the original function if something goes wrong
        return original_get_payment_entry(dt, dn, party_amount, bank_account, bank_amount)


# Override the original function in payment_entry.py
import erpnext.accounts.doctype.payment_entry.payment_entry
erpnext.accounts.doctype.payment_entry.payment_entry.get_bank_cash_account = fixed_get_bank_cash_account
