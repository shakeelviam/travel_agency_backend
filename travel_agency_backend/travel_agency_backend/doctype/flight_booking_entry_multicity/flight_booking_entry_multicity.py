# Copyright (c) 2025, Travel Agency Backend and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class FlightBookingEntryMulticity(Document):
    def validate(self):
        # Set the item based on the Service Type
        if not self.item:
            service_type = "Flight Multicity"
            item_code = frappe.db.get_value("Service Type", service_type, "item_code")
            if item_code:
                self.item = item_code
        
        # Calculate total from supplier cost, markup, and commission
        self.total_amount = (self.supplier_cost or 0) + (self.markup or 0) - (self.commission or 0)
        
        # Update route summary
        self.update_route_summary()
    
    def calculate_total(self):
        """Calculate the total amount based on supplier cost and markup"""
        supplier_cost = self.supplier_cost or 0
        markup = self.markup or 0
        self.total_amount = supplier_cost + markup
    
    def update_route_summary(self):
        """Update the route summary based on the segments"""
        if not self.multi_city_segments:
            self.route_summary = "No segments defined"
            return
            
        segments = self.multi_city_segments
        summary = []
        
        for segment in segments:
            if segment.from_location:
                summary.append(segment.from_location)
                
        # Add the final destination
        if segments and segments[-1].to_location:
            summary.append(segments[-1].to_location)
            
        self.route_summary = " → ".join(summary) if summary else "Route not defined"
