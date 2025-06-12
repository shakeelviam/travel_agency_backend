# Copyright (c) 2025, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from travel_agency_backend.travel_agency_backend.bank_charges.utils import process_bank_charges

def on_submit_payment_entry(doc, method):
    """Apply bank charges when a Payment Entry is submitted
    
    Only applies for payment_type = "Receive"
    """
    if doc.payment_type != "Receive":
        return
        
    process_bank_charges(doc, doc.paid_to, doc.paid_amount)
