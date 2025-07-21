# -*- coding: utf-8 -*-
# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from frappe.utils import flt

class MultiCityBookingTest(Document):
    def validate(self):
        """Validate the multi-city booking"""
        self.validate_sectors()
        self.calculate_total_amount()
    
    def validate_sectors(self):
        """Validate that sectors are properly configured for multi-city booking"""
        if self.trip_type == "Multi City":
            # Check if we have at least 2 sectors for multi-city
            if len(self.sectors) < 2:
                frappe.throw("Multi-city bookings must have at least 2 sectors")
            
            # Validate sector continuity (to of one sector should match from of next sector)
            for i in range(len(self.sectors) - 1):
                current_sector = self.sectors[i]
                next_sector = self.sectors[i + 1]
                
                if current_sector.to_location != next_sector.from_location:
                    frappe.msgprint(
                        "Warning: Sector {0} ends at {1} but Sector {2} starts from {3}".format(
                            current_sector.sector_number, 
                            current_sector.to_location,
                            next_sector.sector_number,
                            next_sector.from_location
                        ),
                        indicator="orange"
                    )
            
            # Validate sector dates are in sequence
            for i in range(len(self.sectors) - 1):
                current_sector = self.sectors[i]
                next_sector = self.sectors[i + 1]
                
                if current_sector.arrival_date > next_sector.departure_date:
                    frappe.throw(
                        "Sector {0} arrival date is after Sector {1} departure date".format(
                            current_sector.sector_number,
                            next_sector.sector_number
                        )
                    )
    
    def calculate_total_amount(self):
        """Calculate the total amount based on base fare, taxes, and fees"""
        self.total_amount = flt(self.base_fare) + flt(self.taxes) + flt(self.fees)
    
    def on_submit(self):
        """Actions to perform when the document is submitted"""
        # We can add additional validation or actions here
        pass
