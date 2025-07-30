import frappe
from frappe.model.document import Document
from datetime import datetime

class FlightBookingEntryMulticity(Document):
    def validate(self):
        if self.supplier_cost and self.markup:
            self.selling_price = self.supplier_cost + self.markup
        
        if not self.service_type:
            # Check if supplier name contains 'GDS' to determine service type
            if hasattr(self, 'supplier') and self.supplier and 'GDS' in self.supplier:
                self.service_type = "Flight Multi City GDS"
            else:
                self.service_type = "Flight Multi City Online"
        
        # Validate segment order
        self.validate_segment_order()
            
    def get_route_summary(self):
        """Generate a route summary for this segment"""
        summary = f"{self.from_location} → {self.to_location}"
        if self.date_of_travel:
            summary += f" ({frappe.utils.formatdate(self.date_of_travel)})"
        if self.airline:
            summary += f" | {self.airline}"
        if self.flight_number:
            summary += f" {self.flight_number}"
        return summary
    
    def validate_segment_order(self):
        """Validate that segments for the same passenger are in logical order"""
        if not self.passenger or not self.segment_number:
            return
            
        # Get all segments for this passenger
        segments = frappe.get_all(
            "Flight Booking Entry Multicity",
            filters={
                "passenger": self.passenger,
                "docstatus": 0,  # Draft documents
                "name": ["!=", self.name]  # Exclude current document
            },
            fields=["name", "segment_number", "from_location", "to_location", "date_of_travel"]
        )
        
        # Skip validation if this is the only segment
        if not segments:
            return
            
        # Check for duplicate segment numbers
        for segment in segments:
            if segment.segment_number == self.segment_number:
                frappe.msgprint(
                    f"Segment number {self.segment_number} already exists for passenger {self.passenger}.",
                    alert=True
                )
                
        # Find previous segment if this isn't segment 1
        if self.segment_number > 1:
            prev_segments = [s for s in segments if s.segment_number == self.segment_number - 1]
            if prev_segments:
                prev_segment = prev_segments[0]
                
                # Check if locations connect (previous to_location should match current from_location)
                if prev_segment.to_location != self.from_location:
                    frappe.msgprint(
                        f"Segment {self.segment_number} should start from {prev_segment.to_location} "
                        f"(end of segment {self.segment_number - 1}), but starts from {self.from_location} instead.",
                        alert=True
                    )
                
                # Check if dates are in order
                if prev_segment.date_of_travel and self.date_of_travel:
                    prev_date = datetime.strptime(prev_segment.date_of_travel, "%Y-%m-%d")
                    curr_date = datetime.strptime(self.date_of_travel, "%Y-%m-%d")
                    
                    if curr_date < prev_date:
                        frappe.msgprint(
                            f"Segment {self.segment_number} date ({self.date_of_travel}) is earlier than "
                            f"segment {self.segment_number - 1} date ({prev_segment.date_of_travel}).",
                            alert=True
                        )
