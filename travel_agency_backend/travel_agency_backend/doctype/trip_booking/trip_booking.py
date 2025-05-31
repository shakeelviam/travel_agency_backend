# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class TripBooking(Document):
    def validate(self):
        self.validate_services()
        self.calculate_total_amount()
        self.clean_unused_services()

    def validate_services(self):
        """Validate that selected services have corresponding data"""
        if not self.selected_services:
            return

        for service in self.selected_services:
            table_fieldname = self.get_table_fieldname(service.service_category)
            if table_fieldname and hasattr(self, table_fieldname):
                child_table = getattr(self, table_fieldname)
                if not child_table:
                    frappe.throw(f"Please add details for {service.service_category} service")

    def calculate_total_amount(self):
        """Calculate total amount from all active child tables"""
        total_amount = 0

        if not self.selected_services:
            self.total_amount = total_amount
            return

        for service in self.selected_services:
            table_fieldname = self.get_table_fieldname(service.service_category)
            if table_fieldname and hasattr(self, table_fieldname):
                child_table = getattr(self, table_fieldname)
                for row in child_table:
                    if hasattr(row, 'total_amount') and row.total_amount:
                        total_amount += row.total_amount

        self.total_amount = total_amount

    def get_table_fieldname(self, service_category):
        """Get child table fieldname for service category"""
        service_mapping = {
            'Flight': 'flight_booking_entry',
            'Hotel': 'hotel_booking_entry',
            'Visa': 'visa_booking_entry',
            'Car Rental': 'car_rental_booking_entry'
        }
        return service_mapping.get(service_category)

    def clean_unused_services(self):
        """Clean up child tables for non-selected services"""
        if not self.selected_services:
            # If no services selected, clear all child tables
            self.flight_booking_entry = []
            self.hotel_booking_entry = []
            self.visa_booking_entry = []
            self.car_rental_booking_entry = []
            return

        # Get list of active service categories
        active_categories = [s.service_category for s in self.selected_services]

        # Clear child tables for non-selected services
        all_categories = ['Flight', 'Hotel', 'Visa', 'Car Rental']

        for category in all_categories:
            if category not in active_categories:
                table_fieldname = self.get_table_fieldname(category)
                if table_fieldname and hasattr(self, table_fieldname):
                    setattr(self, table_fieldname, [])

    def before_submit(self):
        """Validate before submission"""
        if not self.selected_services:
            frappe.throw("Please add at least one service before submitting")

        # Ensure all selected services have data
        for service in self.selected_services:
            table_fieldname = self.get_table_fieldname(service.service_category)
            if table_fieldname and hasattr(self, table_fieldname):
                child_table = getattr(self, table_fieldname)
                if not child_table:
                    frappe.throw(f"Please add booking details for {service.service_category} service")

# Whitelisted methods for client-side calls
@frappe.whitelist()
def get_available_services():
    """Get list of available services"""
    return [
        {'value': 'Flight GDS', 'label': 'Flight GDS', 'category': 'Flight'},
        {'value': 'Flight Online Airlines', 'label': 'Flight Online Airlines', 'category': 'Flight'},
        {'value': 'Hotel Booking', 'label': 'Hotel Booking', 'category': 'Hotel'},
        {'value': 'Visa Application Charges', 'label': 'Visa Application Charges', 'category': 'Visa'},
        {'value': 'Car Rental Service', 'label': 'Car Rental Service', 'category': 'Car Rental'}
    ]

@frappe.whitelist()
def remove_service(docname, service_category):
    """Remove a service and its child table data"""
    doc = frappe.get_doc('Trip Booking', docname)

    # Check if document is in draft state
    if doc.docstatus != 0:
        frappe.throw("Cannot modify submitted document")

    # Remove from selected services
    doc.selected_services = [s for s in doc.selected_services if s.service_category != service_category]

    # Clear the respective child table
    table_fieldname = doc.get_table_fieldname(service_category)
    if table_fieldname and hasattr(doc, table_fieldname):
        setattr(doc, table_fieldname, [])

    doc.save()
    return True

@frappe.whitelist()
def get_service_category_mapping():
    """Get mapping of service types to categories"""
    return {
        'Flight GDS': 'Flight',
        'Flight Online Airlines': 'Flight',
        'Hotel Booking': 'Hotel',
        'Visa Application Charges': 'Visa',
        'Car Rental Service': 'Car Rental'
    }