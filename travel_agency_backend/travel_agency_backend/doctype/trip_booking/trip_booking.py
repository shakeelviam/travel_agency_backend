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
        if not self.selected_services:
            return

        for service in self.selected_services:
            table = self.get_child_table(service.service_category)
            if table is not None and not table:
                frappe.throw(f"Please add details for {service.service_category} service")

    def calculate_total_amount(self):
        total = 0
        if self.selected_services:
            for service in self.selected_services:
                table = self.get_child_table(service.service_category)
                if table:
                    for row in table:
                        if getattr(row, "total_amount", 0):
                            total += row.total_amount
        self.total_amount = total

    def clean_unused_services(self):
        if not self.selected_services:
            self.flight_booking_entry = []
            self.hotel_booking_entry = []
            self.visa_booking_entry = []
            self.car_rental_booking_entry = []
            return

        active = {s.service_category for s in self.selected_services}
        for category in ["Flight", "Hotel", "Visa", "Car Rental"]:
            if category not in active:
                table_fieldname = self.get_table_fieldname(category)
                if table_fieldname:
                    setattr(self, table_fieldname, [])

    def before_submit(self):
        if not self.selected_services:
            frappe.throw("Please add at least one service before submitting")

        for service in self.selected_services:
            table = self.get_child_table(service.service_category)
            if table is not None and not table:
                frappe.throw(f"Please add booking details for {service.service_category} service")

    def get_table_fieldname(self, service_category):
        return {
            "Flight": "flight_booking_entry",
            "Hotel": "hotel_booking_entry",
            "Visa": "visa_booking_entry",
            "Car Rental": "car_rental_booking_entry"
        }.get(service_category)

    def get_child_table(self, category):
        fieldname = self.get_table_fieldname(category)
        return getattr(self, fieldname, None) if fieldname else None


@frappe.whitelist()
def get_available_services():
    return [
        {"value": "Flight GDS", "label": "Flight GDS", "category": "Flight"},
        {"value": "Flight Online Airlines", "label": "Flight Online Airlines", "category": "Flight"},
        {"value": "Hotel Booking", "label": "Hotel Booking", "category": "Hotel"},
        {"value": "Visa Application Charges", "label": "Visa Application Charges", "category": "Visa"},
        {"value": "Car Rental Service", "label": "Car Rental Service", "category": "Car Rental"}
    ]


@frappe.whitelist()
def remove_service(docname, service_category):
    doc = frappe.get_doc("Trip Booking", docname)
    if doc.docstatus != 0:
        frappe.throw("Cannot modify submitted document")

    doc.selected_services = [s for s in doc.selected_services if s.service_category != service_category]

    fieldname = doc.get_table_fieldname(service_category)
    if fieldname and hasattr(doc, fieldname):
        setattr(doc, fieldname, [])

    doc.save()
    return True


@frappe.whitelist()
def get_service_category_mapping():
    return {
        "Flight GDS": "Flight",
        "Flight Online Airlines": "Flight",
        "Hotel Booking": "Hotel",
        "Visa Application Charges": "Visa",
        "Car Rental Service": "Car Rental"
    }
