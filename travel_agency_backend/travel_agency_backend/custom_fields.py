# Copyright (c) 2023, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from travel_agency_backend.travel_agency_backend.custom_fields_date_of_issue import setup_date_of_issue_fields

def setup_custom_fields():
    """Setup custom fields for the travel agency backend"""
    custom_fields = {
        "Sales Invoice Item": [
            {
                "fieldname": "passenger",
                "label": "Passenger",
                "fieldtype": "Data",
                "insert_after": "description",
                "translatable": 0
            },
            {
                "fieldname": "service_type",
                "label": "Service Type",
                "fieldtype": "Link",
                "options": "Service Type",
                "insert_after": "passenger",
                "translatable": 0
            },
            {
                "fieldname": "trip_booking",
                "label": "Trip Booking",
                "fieldtype": "Link",
                "options": "Trip Booking",
                "insert_after": "service_type",
                "translatable": 0
            }
        ],
        "Purchase Invoice Item": [
            {
                "fieldname": "passenger",
                "label": "Passenger",
                "fieldtype": "Data",
                "insert_after": "description",
                "translatable": 0
            },
            {
                "fieldname": "service_type",
                "label": "Service Type",
                "fieldtype": "Link",
                "options": "Service Type",
                "insert_after": "passenger",
                "translatable": 0
            },
            {
                "fieldname": "trip_booking",
                "label": "Trip Booking",
                "fieldtype": "Link",
                "options": "Trip Booking",
                "insert_after": "service_type",
                "translatable": 0
            }
        ],
        "Sales Invoice": [
            {
                "fieldname": "trip_booking",
                "label": "Trip Booking",
                "fieldtype": "Link",
                "options": "Trip Booking",
                "insert_after": "customer_name",
                "translatable": 0
            }
        ],
        "Purchase Invoice": [
            {
                "fieldname": "trip_booking",
                "label": "Trip Booking",
                "fieldtype": "Link",
                "options": "Trip Booking",
                "insert_after": "supplier_name",
                "translatable": 0
            }
        ]
    }
    
    create_custom_fields(custom_fields)
    
    # Setup date_of_issue fields for Sales Invoice Item and Purchase Invoice Item
    setup_date_of_issue_fields()
