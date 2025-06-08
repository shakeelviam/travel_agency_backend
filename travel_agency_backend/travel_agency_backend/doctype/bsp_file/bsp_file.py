import frappe
from frappe import _
from frappe.model.document import Document
import csv
import io
import os
import datetime
from frappe.utils import flt, cint, getdate, get_datetime


class BSPFile(Document):
    def validate(self):
        self.validate_dates()
    
    def validate_dates(self):
        if self.from_date and self.to_date and getdate(self.from_date) > getdate(self.to_date):
            frappe.throw(_("From Date cannot be after To Date"))
    
    def before_submit(self):
        # Check if entries exist
        if not self.entries or len(self.entries) == 0:
            frappe.throw(_("No BSP entries found. Please import entries before submitting."))
    
    def on_submit(self):
        self.status = "Pending"
        self.db_set("status", "Pending")
    
    def on_cancel(self):
        self.status = "Cancelled"
        self.db_set("status", "Cancelled")
    
    @frappe.whitelist()
    def import_bsp_data(self):
        """Import BSP file data based on file type"""
        if not self.bsp_file:
            frappe.throw(_("Please attach a BSP file first"))
            
        try:
            # Get file content
            file_content = frappe.get_doc("File", {"file_url": self.bsp_file}).get_content()
            
            if isinstance(file_content, bytes):
                file_content = file_content.decode('utf-8')
            
            # Process based on file type
            if self.file_type == "HOT":
                self.process_hot_file(file_content)
            elif self.file_type == "RET":
                self.process_ret_file(file_content)
            elif self.file_type in ["ADM", "ACM"]:
                self.process_adm_acm_file(file_content)
                
            # Update statistics
            self.imported_entries = len(self.entries)
            self.total_amount = sum(flt(entry.total_amount) for entry in self.entries)
            self.db_update()
            
            frappe.msgprint(_(f"Successfully imported {self.imported_entries} entries with total amount {self.total_amount}"))
            return True
            
        except Exception as e:
            frappe.log_error(f"BSP Import Error: {str(e)}", "BSP Import")
            frappe.throw(_(f"Error importing BSP file: {str(e)}"))
    
    def process_hot_file(self, file_content):
        """Process HOT (Ticket Sales) file"""
        # Clear existing entries
        self.entries = []
        
        # Read CSV content
        reader = csv.reader(io.StringIO(file_content), delimiter=',')
        headers = next(reader)  # Skip header row
        
        for row in reader:
            if len(row) < 8:  # Ensure minimum columns are present
                continue
                
            # Map columns to BSP Entry fields (adjust based on actual file format)
            ticket_number = row[0].strip()
            passenger_name = row[1].strip()
            airline_code = row[2].strip()
            
            try:
                issue_date = datetime.datetime.strptime(row[3].strip(), "%Y-%m-%d").strftime("%Y-%m-%d")
            except ValueError:
                issue_date = None
                
            base_fare = flt(row[4].strip() or 0)
            tax_amount = flt(row[5].strip() or 0)
            commission_amount = flt(row[6].strip() or 0)
            total_amount = flt(row[7].strip() or 0)
            
            # Validate ticket number format
            if not ticket_number or len(ticket_number.replace('-', '').replace(' ', '')) != 13:
                frappe.msgprint(_(f"Skipping invalid ticket number: {ticket_number}"), alert=True)
                continue
                
            # Add entry
            self.append("entries", {
                "ticket_number": ticket_number.replace('-', '').replace(' ', ''),  # Standardize format
                "passenger_name": passenger_name,
                "airline_code": airline_code,
                "issue_date": issue_date,
                "base_fare": base_fare,
                "tax_amount": tax_amount,
                "commission_amount": commission_amount,
                "total_amount": total_amount,
                "reconciliation_status": "Pending"
            })
    
    def process_ret_file(self, file_content):
        """Process RET (Refund) file"""
        # Implementation similar to HOT but for refund records
        # Note: Refunds typically have negative amounts
        self.process_hot_file(file_content)  # Reuse same logic temporarily
        
        # Mark all as refunds by prefixing ticket numbers with "RET-"
        for entry in self.entries:
            if not entry.ticket_number.startswith("RET-"):
                entry.ticket_number = f"RET-{entry.ticket_number}"
    
    def process_adm_acm_file(self, file_content):
        """Process ADM (Agency Debit Memo) or ACM (Agency Credit Memo) file"""
        # Implementation similar to HOT but for ADM/ACM records
        self.process_hot_file(file_content)  # Reuse same logic temporarily
        
        # Mark entries appropriately
        prefix = "ADM-" if self.file_type == "ADM" else "ACM-"
        for entry in self.entries:
            if not entry.ticket_number.startswith(prefix):
                entry.ticket_number = f"{prefix}{entry.ticket_number}"


@frappe.whitelist()
def get_unreconciled_entries(bsp_file):
    """Get unreconciled entries from a BSP file"""
    if not bsp_file:
        return []
        
    entries = frappe.get_all(
        "BSP Entry",
        filters={
            "parent": bsp_file,
            "reconciliation_status": "Pending"
        },
        fields=["name", "ticket_number", "passenger_name", "airline_code", "issue_date", "total_amount"]
    )
    
    return entries


@frappe.whitelist()
def get_import_template():
    """Get BSP import template"""
    app_path = frappe.get_app_path("travel_agency_backend")
    template_path = os.path.join(app_path, "bsp_reconciliation", "templates", "bsp_import_template.csv")
    
    if os.path.exists(template_path):
        with open(template_path, "r") as f:
            template_content = f.read()
        
        return template_content
    else:
        # Fall back to generating template
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow(["Ticket Number", "Passenger Name", "Airline Code", "Issue Date", 
                       "Base Fare", "Tax Amount", "Commission Amount", "Total Amount", 
                       "Flight Number", "Booking Class", "Remarks"])
        
        # Write sample row
        writer.writerow(["1234567890123", "John Doe", "EK", "2025-06-01", 
                        "1500.00", "100.00", "75.00", "1525.00", 
                        "EK523", "Y", "Example row"])
        
        # Write empty row with format hints
        writer.writerow(["", "", "", "YYYY-MM-DD", "", "", "", "", "", "", ""])
        
        return output.getvalue()
