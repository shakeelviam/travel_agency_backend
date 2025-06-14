# Copyright (c) 2025, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from travel_agency_backend.travel_agency_backend.bank_charges.utils import process_bank_charges

def on_submit_sales_invoice(doc, method):
    """Apply bank charges when a Sales Invoice is submitted with payments
    
    Only applies when there are payments in the payments table and mode_of_payment is set
    """
    # Skip if outstanding amount is not zero (invoice not fully paid)
    if doc.outstanding_amount != 0:
        return
        
    # Get the mode of payment and account from the payment entry table
    if not doc.payments or len(doc.payments) == 0:
        return
        
    # Get the first payment entry
    payment = doc.payments[0]
    mode_of_payment = payment.mode_of_payment
    account = payment.account
    
    if not mode_of_payment or not account:
        return
        
    # Store the mode_of_payment in doc for the process_bank_charges function
    doc.mode_of_payment = mode_of_payment
    
    # Process bank charges using the payment account and grand total
    process_bank_charges(doc, account, doc.rounded_total or doc.grand_total)
