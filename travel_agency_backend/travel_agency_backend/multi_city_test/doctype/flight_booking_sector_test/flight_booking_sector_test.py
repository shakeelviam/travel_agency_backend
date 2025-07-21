# -*- coding: utf-8 -*-
# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from datetime import datetime

class FlightBookingSectorTest(Document):
    def validate(self):
        """Validate sector data"""
        self.validate_dates()
        
    def validate_dates(self):
        """Validate that departure date is before arrival date"""
        if self.departure_date and self.arrival_date:
            departure = datetime.strptime(self.departure_date, "%Y-%m-%d %H:%M:%S")
            arrival = datetime.strptime(self.arrival_date, "%Y-%m-%d %H:%M:%S")
            
            if departure > arrival:
                frappe.throw("Departure date cannot be after arrival date for sector {0}".format(self.sector_number))
