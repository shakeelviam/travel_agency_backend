# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class Passenger(Document):
    def validate(self):
        self.set_full_name()

    def set_full_name(self):
        """Combine salutation, first name, second name, and third name to create full name"""
        parts = []
        if self.salutation:
            parts.append(self.salutation)
        if self.first_name:
            parts.append(self.first_name)
        if self.second_name:
            parts.append(self.second_name)
        if self.third_name:
            parts.append(self.third_name)
        
        self.full_name = ' '.join(filter(None, parts))
