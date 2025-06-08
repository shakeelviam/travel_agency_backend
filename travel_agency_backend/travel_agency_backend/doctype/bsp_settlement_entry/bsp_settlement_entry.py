import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class BSPSettlementEntry(Document):
    def validate(self):
        self.validate_amount()
    
    def validate_amount(self):
        """Validate settlement amount"""
        if flt(self.amount) <= 0:
            frappe.throw(_("Settlement amount must be greater than zero"))
    
    def update_status(self, status):
        """Update entry status"""
        valid_statuses = ["Pending", "Settled", "Disputed", "Cancelled"]
        if status not in valid_statuses:
            frappe.throw(_("Invalid status. Must be one of: {0}".format(", ".join(valid_statuses))))
        
        self.status = status
        self.save()
        
        # Update related reconciliation entry if available
        if self.reconciliation:
            frappe.db.set_value("BSP Reconciliation Entry", self.reconciliation, "payment_status", 
                               "Paid" if status == "Settled" else "Pending")


@frappe.whitelist()
def update_settlement_entry_status(entries, status):
    """Update multiple settlement entries status"""
    if not entries or not status:
        return False
    
    if isinstance(entries, str):
        import json
        entries = json.loads(entries)
    
    updated = 0
    for entry_name in entries:
        try:
            entry = frappe.get_doc("BSP Settlement Entry", entry_name)
            entry.update_status(status)
            updated += 1
        except Exception as e:
            frappe.log_error(f"Failed to update BSP Settlement Entry {entry_name}: {str(e)}", 
                           "BSP Settlement Update Error")
    
    return updated
