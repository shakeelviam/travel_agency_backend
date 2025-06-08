import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class BSPReconciliationEntry(Document):
    def validate(self):
        self.validate_amounts()
    
    def validate_amounts(self):
        """Validate and calculate difference"""
        self.difference = flt(self.bsp_amount) - flt(self.system_amount)
        
        # Auto-determine status based on difference
        if abs(self.difference) < 0.01:  # Consider as matched if difference is less than 0.01
            self.status = "Matched"
        else:
            self.status = "Discrepancy"
    
    def after_insert(self):
        """Update BSP Entry status after reconciliation"""
        if self.bsp_entry:
            frappe.db.set_value("BSP Entry", self.bsp_entry, "reconciliation_status", self.status)
            frappe.db.set_value("BSP Entry", self.bsp_entry, "trip_booking", self.trip_booking or "")
    
    def update_payment_status(self):
        """Update payment status based on Purchase Invoice"""
        if not self.purchase_invoice:
            self.payment_status = "Not Invoiced"
            return
            
        pi_status = frappe.db.get_value("Purchase Invoice", self.purchase_invoice, "status")
        
        if pi_status == "Paid":
            self.payment_status = "Paid"
        elif pi_status == "Unpaid":
            self.payment_status = "Unpaid"
        elif pi_status == "Partly Paid":
            self.payment_status = "Partially Paid"
        else:
            self.payment_status = "Not Invoiced"


@frappe.whitelist()
def update_entry_status(entry_name, status, notes=None):
    """Update reconciliation entry status"""
    if not entry_name or not status:
        return False
        
    valid_statuses = ["Matched", "Discrepancy", "Ignored"]
    if status not in valid_statuses:
        frappe.throw(_("Invalid status. Must be one of: {0}".format(", ".join(valid_statuses))))
    
    entry = frappe.get_doc("BSP Reconciliation Entry", entry_name)
    entry.status = status
    
    if notes:
        entry.notes = notes
    
    entry.save()
    
    # Update related BSP Entry
    if entry.bsp_entry:
        frappe.db.set_value("BSP Entry", entry.bsp_entry, "reconciliation_status", status)
    
    return True
