import frappe
from frappe import _
from erpnext.accounts.doctype.payment_entry.payment_entry import get_default_bank_cash_account
from typing import Dict, Any, Optional

# Override functions to handle the ignore_permissions parameter issue in ERPNext 15
def fixed_get_bank_cash_account(
    doc, bank_account=None, ignore_permissions=False
) -> Dict[str, Any]:
    """
    Fixed version of get_bank_cash_account that handles the ignore_permissions parameter properly
    for compatibility with ERPNext 15
    """
    if bank_account:
        return frappe.db.get_value("Bank Account", bank_account, ["account", "bank", "bank_account_no"], as_dict=1)

    if hasattr(doc, "bank_account") and doc.bank_account:
        return frappe.db.get_value("Bank Account", doc.bank_account, ["account", "bank", "bank_account_no"], as_dict=1)

    # Use our fixed version of get_default_bank_cash_account that ignores the ignore_permissions parameter
    return fixed_get_default_bank_cash_account(
        doc.company, "Bank", doc.payment_type == "Receive", doc.mode_of_payment, doc.party_type, doc.party
    )

def fixed_get_default_bank_cash_account(
    company: str,
    account_type: str = None,
    account_subtype: str = None,
    mode_of_payment: str = None,
    party_type: Optional[str] = None,
    party: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Fixed version of get_default_bank_cash_account that ignores any unexpected parameters (like ignore_permissions)
    and passes only the expected parameters to the original function
    """
    # Call the original function with only the parameters it expects
    return get_default_bank_cash_account(
        company, account_type, account_subtype, mode_of_payment, party_type, party
    )
