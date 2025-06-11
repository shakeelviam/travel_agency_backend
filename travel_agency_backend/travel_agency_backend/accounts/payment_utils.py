import frappe
from frappe import _
import erpnext
from frappe.utils import flt
import json

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

# Override the get_payment_entry function to fix the TypeError
@frappe.whitelist()
def get_payment_entry(dt, dn, party_amount=None, bank_account=None, bank_amount=None):
    """
    Direct replacement for the erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry
    that doesn't pass ignore_permissions parameter
    """
    doc = frappe.get_doc(dt, dn)
    
    if dt == "Sales Order" and doc.get("advance_payment_status") == "Paid":
        frappe.throw(_("Payment Entry already created for this document"))

    party_type = "Customer" if dt in ("Sales Order", "Sales Invoice", "Dunning") else "Supplier"

    party_account = get_party_account(party_type, doc.get(party_type.lower()), doc.company)
    
    if dt in ["Sales Invoice", "Purchase Invoice"] and doc.outstanding_amount <= 0:
        frappe.throw(_("{0} is already paid").format(doc.name))
    
    party_account_currency = doc.get("party_account_currency") or frappe.db.get_value(
        "Account", party_account, "account_currency"
    )
    
    # Get Currency Exchange Rate
    company_currency = erpnext.get_company_currency(doc.company)
    
    if not party_amount:
        if party_account_currency == company_currency:
            party_amount = flt(doc.base_rounded_total) or flt(doc.base_grand_total)
        else:
            party_amount = flt(doc.rounded_total) or flt(doc.grand_total)
    
    party_amount = party_amount or 0
    
    # FIX: Don't pass ignore_permissions parameter
    if bank_account:
        bank_account_dict = frappe.db.get_value(
            "Bank Account", bank_account, ["account", "bank", "bank_account_no"], as_dict=1
        )
    else:
        if hasattr(doc, "bank_account") and doc.bank_account:
            bank_account_dict = frappe.db.get_value(
                "Bank Account", doc.bank_account, ["account", "bank", "bank_account_no"], as_dict=1
            )
        else:
            # FIX: No ignore_permissions parameter here
            bank_account_dict = get_default_bank_account(doc)
    
    # Create a new Payment Entry
    payment = frappe.new_doc("Payment Entry")
    payment.payment_type = "Receive" if dt in ("Sales Order", "Sales Invoice", "Dunning") else "Pay"
    payment.company = doc.company
    payment.posting_date = frappe.utils.nowdate()
    payment.mode_of_payment = doc.get("mode_of_payment")
    payment.party_type = party_type
    payment.party = doc.get(party_type.lower())

    payment.paid_from = party_account if payment.payment_type == "Receive" else bank_account_dict.get("account")
    payment.paid_to = bank_account_dict.get("account") if payment.payment_type == "Receive" else party_account
    payment.paid_from_account_currency = (
        party_account_currency if payment.payment_type == "Receive" else company_currency
    )
    payment.paid_to_account_currency = (
        company_currency if payment.payment_type == "Receive" else party_account_currency
    )
    payment.reference_no = doc.get("bill_no") or doc.get("name")
    payment.reference_date = doc.get("bill_date") or doc.get("posting_date") or doc.get("transaction_date")

    # Fill remaining payment details
    payment.setup_party_account_field()
    payment.set_missing_values()
    
    # Set reference
    reference_appropriate_document(payment, doc, dt, dn, party_amount)
    
    return payment


def reference_appropriate_document(payment, doc, dt, dn, party_amount=None):
    """Set the reference of the payment based on document type"""
    if dt in ("Sales Order", "Purchase Order"):
        payment.append("references", {
            "reference_doctype": dt,
            "reference_name": dn,
            "total_amount": doc.base_grand_total,
            "outstanding_amount": doc.base_grand_total,
            "allocated_amount": party_amount or doc.base_grand_total,
        })
    else:
        payment.append("references", {
            "reference_doctype": dt,
            "reference_name": dn,
            "total_amount": doc.get("grand_total"),
            "outstanding_amount": doc.get("outstanding_amount") or doc.get("grand_total"),
            "allocated_amount": party_amount or doc.get("outstanding_amount") or doc.get("grand_total"),
        })


def get_default_bank_account(doc):
    """Get default bank account for the company without using ignore_permissions parameter"""
    company = doc.company
    payment_type = "Receive" if doc.doctype in ["Sales Order", "Sales Invoice", "Dunning"] else "Pay"
    mode_of_payment = doc.get("mode_of_payment")
    party_type = "Customer" if payment_type == "Receive" else "Supplier"
    party = doc.get(party_type.lower())
    
    # Get from Mode of Payment default account (standard ERPNext behavior)
    if mode_of_payment:
        account = get_bank_cash_account_from_mode(mode_of_payment, company)
        if account:
            return account
    
    # Use default account as fallback
    default_bank_account = frappe.get_cached_value('Company', company, 
                                            'default_bank_account' if payment_type == "Receive" else 'default_cash_account')
    
    if not default_bank_account:
        # Try to find a Bank or Cash account
        filters = {
            "company": company,
            "is_group": 0
        }
        if payment_type == "Receive":
            filters["account_type"] = ["in", ["Bank", "Cash"]]
        else:
            filters["account_type"] = "Bank"
            
        accounts = frappe.get_all("Account", filters=filters, limit=1)
        default_bank_account = accounts[0].name if accounts else None
    
    if not default_bank_account:
        frappe.throw(_("Please setup a default bank account for company {0}").format(company))
    
    return {
        "account": default_bank_account,
        "bank": None,
        "bank_account_no": None
    }


def get_bank_cash_account_from_mode(mode_of_payment, company):
    """Get bank or cash account from Mode of Payment"""
    mode_of_payment_doc = frappe.get_cached_doc("Mode of Payment", mode_of_payment)
    account = None
    
    for account_entry in mode_of_payment_doc.accounts:
        if account_entry.company == company:
            account = account_entry.default_account
            break
    
    if account:
        return {
            "account": account,
            "bank": None,  # We don't have this info from MOP
            "bank_account_no": None  # We don't have this info from MOP
        }
    
    return None


def apply_patches():
    """Apply all necessary patches to fix ERPNext compatibility issues"""
    # Override the problematic function with our fixed version
    import erpnext.accounts.doctype.payment_entry.payment_entry
    erpnext.accounts.doctype.payment_entry.payment_entry.get_payment_entry = get_payment_entry
    frappe.log_error("Payment Entry function completely replaced", "Payment Entry Fix")
