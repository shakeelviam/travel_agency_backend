# Copyright (c) 2025, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt

def get_bank_charges_account(company, mode_of_payment=None):
    """Get the bank charges account for a specific mode of payment or the default
    
    Args:
        company (str): Company
        mode_of_payment (str, optional): Mode of Payment. If specified, will check for
                                        a specific account for this payment method first
    
    Returns:
        str: Bank charges account
    """
    settings = frappe.get_cached_doc("Bank Charges Settings")
    
    # If mode of payment is specified, check if it has a specific account
    if mode_of_payment:
        for row in settings.mode_of_payment_charges:
            if row.mode_of_payment == mode_of_payment and row.bank_charges_account:
                return row.bank_charges_account
    
    # Fall back to default account
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
    if not charge or charge <= 0:
        return False
        
    bank_charges_account = get_bank_charges_account(doc.company, mode_of_payment)
    if not bank_charges_account:
        frappe.msgprint("Bank Charges Account not set in Bank Charges Settings. Skipping bank charges.")
        return False
    
    # Create a Journal Entry for bank charges
    je = frappe.new_doc("Journal Entry")
    je.voucher_type = "Journal Entry"
    je.company = doc.company
    je.posting_date = doc.posting_date
    je.user_remark = f"Bank Charges for {doc.doctype} {doc.name}"
    
    # Debit bank charges account
    je.append("accounts", {
        "account": bank_charges_account,
        "debit_in_account_currency": charge,
        "credit_in_account_currency": 0,
        "reference_type": doc.doctype,
        "reference_name": doc.name
    })
    
    # Credit bank account
    je.append("accounts", {
        "account": bank_account,
        "debit_in_account_currency": 0,
        "credit_in_account_currency": charge,
        "reference_type": doc.doctype,
        "reference_name": doc.name
    })
    
    try:
        je.insert()
        je.submit()
        frappe.msgprint(f"Bank charges of {charge} applied for {mode_of_payment} via Journal Entry {je.name}")
        return True
    except Exception as e:
        frappe.log_error(f"Failed to create bank charges journal entry: {str(e)}")
        frappe.msgprint(f"Failed to apply bank charges: {str(e)}")
        return False
