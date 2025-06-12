# Copyright (c) 2025, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from travel_agency_backend.bank_charges.utils import process_bank_charges

def on_submit_sales_invoice(doc, method):
    """Apply bank charges when a Sales Invoice is submitted with is_paid checked
    
    Only applies when is_paid is checked and mode_of_payment is set
    """
    # Only if Is Paid is checked and no Payment Entry is made
    if not doc.is_paid or doc.outstanding_amount != 0:
        return
        
    # Get the mode of payment and account from the payment entry table
    # In ERPNext, when is_paid is checked, there should be an entry in the payments table
    if not doc.payments or len(doc.payments) == 0:
        return
        
    # Get the first payment entry (usually there's only one when is_paid is checked)
    payment = doc.payments[0]
    mode_of_payment = payment.mode_of_payment
    account = payment.account
    
    if not mode_of_payment or not account:
        return
        
    # Store the mode_of_payment in doc for the process_bank_charges function
    doc.mode_of_payment = mode_of_payment
    
    # Process bank charges using the payment account and grand total
    process_bank_charges(doc, account, doc.rounded_total or doc.grand_total)
