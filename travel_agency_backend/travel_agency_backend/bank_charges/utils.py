# Copyright (c) 2025, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt

def get_bank_charges_account(company):
    """Get the default bank charges account from settings"""
    settings = frappe.get_cached_doc("Bank Charges Settings")
    return settings.default_bank_charges_account

def get_bank_charge(mode_of_payment, amount):
    """Calculate bank charge based on mode of payment and amount
    
    Args:
        mode_of_payment (str): Mode of Payment
        amount (float): Transaction amount
        
    Returns:
        float: Calculated bank charge
    """
    settings = frappe.get_cached_doc("Bank Charges Settings")
    for row in settings.mode_of_payment_charges:
        if row.mode_of_payment == mode_of_payment:
            if row.charge_type == "Fixed":
                return flt(row.charge_value)
            elif row.charge_type == "Percentage":
                return flt(amount) * flt(row.charge_value) / 100
    return 0.0

def process_bank_charges(doc, bank_account, amount):
    """Process bank charges for a payment
    
    Args:
        doc (Document): The Payment Entry or Sales Invoice document
        bank_account (str): Bank account to debit charges from
        amount (float): Amount on which to calculate charges
        
    Returns:
        bool: True if charges were processed, False otherwise
    """
    mode_of_payment = doc.mode_of_payment
    if not mode_of_payment:
        return False
        
    charge = get_bank_charge(mode_of_payment, amount)
    if not charge:
        return False
        
    bank_charges_account = get_bank_charges_account(doc.company)
    if not bank_charges_account:
        frappe.msgprint("Bank Charges Account not set in Bank Charges Settings. Skipping bank charges.")
        return False
        
    # Post GL Entry for bank charges
    gl_entries = [
        {
            "account": bank_charges_account,
            "debit": charge,
            "credit": 0,
            "against": bank_account,
            "remarks": f"Bank Charges for {doc.doctype} {doc.name}",
            "voucher_type": doc.doctype,
            "voucher_no": doc.name,
            "company": doc.company,
            "posting_date": doc.posting_date
        },
        {
            "account": bank_account,
            "debit": 0,
            "credit": charge,
            "against": bank_charges_account,
            "remarks": f"Bank Charges for {doc.doctype} {doc.name}",
            "voucher_type": doc.doctype,
            "voucher_no": doc.name,
            "company": doc.company,
            "posting_date": doc.posting_date
        }
    ]
    
    from erpnext.accounts.general_ledger import make_gl_entries
    make_gl_entries(gl_entries, cancel=0, update_outstanding="No", merge_entries=False)
    
    frappe.msgprint(f"Bank charges of {charge} applied for {mode_of_payment}")
    return True
