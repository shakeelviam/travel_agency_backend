import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, cint


class BSPReconciliation(Document):
    def validate(self):
        self.update_statistics()
    
    def before_submit(self):
        # Check if all entries have been reconciled
        pending_entries = frappe.get_all(
            "BSP Entry",
            filters={
                "parent": self.bsp_file,
                "reconciliation_status": "Pending"
            },
            limit=1
        )
        
        if pending_entries:
            frappe.throw(_("All BSP entries must be reconciled before submitting."))
    
    def on_submit(self):
        # Mark BSP file as reconciled
        bsp_file_doc = frappe.get_doc("BSP File", self.bsp_file)
        if self.total_entries == self.matched_entries + self.discrepancy_entries:
            bsp_file_doc.status = "Fully Reconciled"
        else:
            bsp_file_doc.status = "Partially Reconciled"
        
        bsp_file_doc.db_set("status", bsp_file_doc.status)
    
    def update_statistics(self):
        """Update reconciliation statistics"""
        if not self.entries:
            return
            
        self.total_entries = len(self.entries)
        self.matched_entries = sum(1 for entry in self.entries if entry.status == "Matched")
        self.discrepancy_entries = sum(1 for entry in self.entries if entry.status == "Discrepancy")
        self.unmatched_entries = self.total_entries - self.matched_entries - self.discrepancy_entries
        
        self.total_bsp_amount = sum(flt(entry.bsp_amount) for entry in self.entries)
        self.total_system_amount = sum(flt(entry.system_amount) for entry in self.entries)
        self.total_difference = flt(self.total_bsp_amount) - flt(self.total_system_amount)
    
    @frappe.whitelist()
    def auto_reconcile(self):
        """Automatically match BSP entries with Trip Booking records using enhanced matching"""
        if not self.bsp_file:
            frappe.throw(_("BSP File is required for reconciliation"))
        
        # Import utility functions for enhanced matching and date formatting
        from travel_agency_backend.travel_agency_backend.bsp_reconciliation.utils import (
            find_matching_flight_bookings, get_purchase_invoice_status,
            compare_passenger_names, format_date_display, parse_date_string
        )
        
        # Get all unreconciled entries from the BSP file
        bsp_entries = frappe.get_all(
            "BSP Entry",
            filters={
                "parent": self.bsp_file,
                "reconciliation_status": "Pending"
            },
            fields=["name", "ticket_number", "passenger_name", "airline_code", "pnr",
                   "issue_date", "base_fare", "tax_amount", "commission_amount", "total_amount"]
        )
        
        # Clear existing entries to avoid duplicates
        self.entries = []
        
        # Statistics
        matched = 0
        discrepancy = 0
        unmatched = 0
        
        for bsp_entry in bsp_entries:
            # Use enhanced matching logic that handles name variations
            matches = find_matching_flight_bookings(
                ticket_number=bsp_entry.ticket_number,
                passenger_name=bsp_entry.passenger_name,
                pnr=bsp_entry.pnr if hasattr(bsp_entry, 'pnr') else None
            )
            
            if matches:
                # Use the first match (highest confidence based on our matching algorithm)
                flight = matches[0]
                trip_booking = flight.parent
                
                # Check for related Purchase Invoice
                pi_data = get_purchase_invoice_status(trip_booking)
                purchase_invoice = pi_data.get("invoice")
                payment_status = pi_data.get("status")
                
                # Format dates consistently (DD-MM-YYYY)
                issue_date = format_date_display(bsp_entry.issue_date) if hasattr(bsp_entry, 'issue_date') else ""
                
                # Calculate difference
                bsp_amount = flt(bsp_entry.total_amount)
                system_amount = flt(flight.total_amount)
                difference = flt(bsp_amount) - flt(system_amount)
                
                # Determine reconciliation status
                status = "Matched" if abs(difference) < 0.01 else "Discrepancy"
                
                # Add matching information
                name_match_info = ""
                if hasattr(bsp_entry, 'passenger_name') and bsp_entry.passenger_name and flight.passenger_name:
                    if bsp_entry.passenger_name.upper() == flight.passenger_name.upper():
                        name_match_info = "Exact name match"
                    else:
                        name_match_info = "Similar name match"
                
                # Add reconciliation entry
                self.append("entries", {
                    "bsp_entry": bsp_entry.name,
                    "ticket_number": bsp_entry.ticket_number,
                    "passenger_name": bsp_entry.passenger_name,
                    "trip_booking": trip_booking,
                    "flight_booking_entry": flight.name,
                    "system_passenger_name": flight.passenger_name,
                    "purchase_invoice": purchase_invoice,
                    "bsp_amount": bsp_amount,
                    "system_amount": system_amount,
                    "difference": difference,
                    "status": status,
                    "payment_status": payment_status,
                    "notes": name_match_info
                })
                
                # Update BSP Entry status
                frappe.db.set_value("BSP Entry", bsp_entry.name, "reconciliation_status", status)
                frappe.db.set_value("BSP Entry", bsp_entry.name, "trip_booking", trip_booking)
                
                if status == "Matched":
                    matched += 1
                else:
                    discrepancy += 1
            else:
                # No match found - add as unmatched
                self.append("entries", {
                    "bsp_entry": bsp_entry.name,
                    "ticket_number": bsp_entry.ticket_number,
                    "passenger_name": bsp_entry.passenger_name,
                    "bsp_amount": flt(bsp_entry.total_amount),
                    "system_amount": 0,
                    "difference": flt(bsp_entry.total_amount),
                    "status": "Unmatched",  # Changed from Discrepancy to Unmatched for clarity
                    "payment_status": "Not Invoiced",
                    "notes": "No matching flight booking found"
                })
                
                # Update BSP Entry status
                frappe.db.set_value("BSP Entry", bsp_entry.name, "reconciliation_status", "Unmatched")
                unmatched += 1
        
        # Update statistics
        self.update_statistics()
        self.save()
        
        return {
            "matched": matched,
            "discrepancy": discrepancy,
            "unmatched": unmatched,
            "total": matched + discrepancy + unmatched
        }
    
    @frappe.whitelist()
    def create_settlement(self):
        """Create BSP Settlement from matched reconciliation entries"""
        if not self.docstatus == 1:
            frappe.throw(_("Reconciliation must be submitted before creating settlement"))
        
        # Group entries by airline
        airline_entries = {}
        
        for entry in self.entries:
            if entry.status == "Matched" and entry.trip_booking:
                # Get airline code
                airline_code = frappe.db.get_value("BSP Entry", entry.bsp_entry, "airline_code")
                
                if not airline_code:
                    continue
                
                if airline_code not in airline_entries:
                    airline_entries[airline_code] = []
                
                airline_entries[airline_code].append(entry)
        
        # Create settlements for each airline
        settlement_docs = []
        
        for airline_code, entries in airline_entries.items():
            # Get airline document
            airline_docs = frappe.get_all(
                "Airline Master",
                filters={"airline_code": airline_code},
                fields=["name"]
            )
            
            airline = airline_docs[0].name if airline_docs else None
            
            # Create settlement
            settlement = frappe.new_doc("BSP Settlement")
            settlement.settlement_date = frappe.utils.today()
            settlement.reporting_period = self.reporting_period
            settlement.airline = airline
            
            total_amount = sum(flt(entry.bsp_amount) for entry in entries)
            paid_amount = sum(flt(entry.bsp_amount) for entry in entries if entry.payment_status == "Paid")
            
            settlement.total_amount = total_amount
            settlement.paid_amount = paid_amount
            settlement.balance_amount = flt(total_amount) - flt(paid_amount)
            
            # Add entries
            for entry in entries:
                settlement.append("reconciliation_entries", {
                    "reconciliation": entry.name,
                    "trip_booking": entry.trip_booking,
                    "purchase_invoice": entry.purchase_invoice,
                    "ticket_number": entry.ticket_number,
                    "amount": entry.bsp_amount,
                    "status": "Pending"
                })
            
            settlement.insert()
            settlement_docs.append({
                "name": settlement.name,
                "airline": airline,
                "total_amount": total_amount
            })
        
        return settlement_docs


@frappe.whitelist()
def reconcile_bsp_file(bsp_file):
    """Create a new reconciliation for a BSP File"""
    if not bsp_file:
        frappe.throw(_("BSP File is required"))
    
    # Check if BSP File exists and is submitted
    bsp_doc = frappe.get_doc("BSP File", bsp_file)
    
    if bsp_doc.docstatus != 1:
        frappe.throw(_("BSP File must be submitted before reconciliation"))
    
    # Create reconciliation
    reconciliation = frappe.new_doc("BSP Reconciliation")
    reconciliation.bsp_file = bsp_file
    reconciliation.reporting_period = bsp_doc.reporting_period
    
    reconciliation.insert()
    
    # Auto reconcile
    results = reconciliation.auto_reconcile()
    
    return {
        "reconciliation": reconciliation.name,
        "results": results
    }
