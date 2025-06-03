# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Passenger(Document):
    def validate(self):
        """Set full name from parts or split full name into parts"""
        # If full name is manually entered, split it into parts
        if self.full_name and not any([self.first_name, self.second_name, self.third_name]):
            parts = self.full_name.split()
            if len(parts) >= 1:
                self.first_name = parts[0]
            if len(parts) >= 2:
                self.second_name = parts[1]
            if len(parts) >= 3:
                self.third_name = " ".join(parts[2:])
        
        # Always calculate full name from parts
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
