# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Passenger(Document):
    def validate(self):
        """Calculate full name from parts"""
        # Validate required fields
        if not self.first_name:
            frappe.throw("First Name is required")
            
        # Calculate full name
        parts = []
        if self.salutation:
            parts.append(self.salutation)
        if self.first_name:
            parts.append(self.first_name)
        if self.second_name:
            parts.append(self.second_name)
        if self.third_name:
            parts.append(self.third_name)
            
        self.full_name = " ".join(filter(None, parts))
        
    def before_save(self):
        """Update full name before saving"""
        self.validate()
