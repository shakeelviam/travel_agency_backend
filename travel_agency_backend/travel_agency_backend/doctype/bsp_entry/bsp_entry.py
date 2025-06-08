import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, cint


class BSPEntry(Document):
    def validate(self):
        self.validate_ticket_number()
        self.validate_amounts()
    
    def validate_ticket_number(self):
        """Validate ticket number format"""
        if self.ticket_number:
            # Strip any non-numeric characters for standard tickets
            if not self.ticket_number.startswith(("RET-", "ADM-", "ACM-")):
                self.ticket_number = ''.join(filter(str.isdigit, self.ticket_number))
                
                # Check if it's a valid length for airline tickets (typically 13 digits)
                if len(self.ticket_number) != 13:
                    frappe.msgprint(
                        _("Warning: Ticket number {0} is not a standard 13-digit format").format(self.ticket_number),
                        indicator='yellow'
                    )
    
    def validate_amounts(self):
        """Validate and calculate total amount if needed"""
        # Set defaults for amounts if they're empty
        self.base_fare = flt(self.base_fare or 0)
        self.tax_amount = flt(self.tax_amount or 0)
        self.commission_amount = flt(self.commission_amount or 0)
        
        # Calculate total if not already set
        calculated_total = flt(self.base_fare) + flt(self.tax_amount) - flt(self.commission_amount)
        
        if not self.total_amount or abs(flt(self.total_amount) - calculated_total) > 0.01:
            self.total_amount = calculated_total


@frappe.whitelist()
def find_matching_flight_bookings(ticket_number):
    """Find matching Flight Booking Entry GDS records for a ticket number"""
    if not ticket_number:
        return []
    
    # Standardize ticket number
    std_ticket = ''.join(filter(str.isdigit, ticket_number))
    
    # Try exact match first
    matches = frappe.get_all(
        "Flight Booking Entry GDS",
        filters={"ticket_number": std_ticket},
        fields=["name", "parent", "passenger", "passenger_name", 
               "ticket_issue_date", "base_fare", "tax_amount", 
               "commission_amount", "total_amount"]
    )
    
    if not matches:
        # Try partial match
        matches = frappe.get_all(
            "Flight Booking Entry GDS",
            filters={"ticket_number": ["like", f"%{std_ticket}%"]},
            fields=["name", "parent", "passenger", "passenger_name", 
                   "ticket_issue_date", "base_fare", "tax_amount", 
                   "commission_amount", "total_amount"]
        )
        
    # Get Trip Booking details
    for match in matches:
        trip_booking = frappe.get_doc("Trip Booking", match.parent)
        match.booking_status = trip_booking.status
        match.customer = trip_booking.customer
        match.booking_date = trip_booking.booking_date
        
        # Check for Purchase Invoice
        purchase_invoice_ids = trip_booking.purchase_invoice_ids or ""
        match.purchase_invoice = purchase_invoice_ids.split(",")[0].strip() if purchase_invoice_ids else None
    
    return matches
