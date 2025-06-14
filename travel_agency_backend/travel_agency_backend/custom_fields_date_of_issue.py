# Copyright (c) 2025, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def setup_date_of_issue_fields():
    """Setup date_of_issue custom fields for Sales Invoice Item and Purchase Invoice Item"""
    custom_fields = {
        "Sales Invoice Item": [
            {
                "fieldname": "date_of_issue",
                "label": "Date of Issue",
                "fieldtype": "Date",
                "insert_after": "trip_booking",
                "translatable": 0
            }
        ],
        "Purchase Invoice Item": [
            {
                "fieldname": "date_of_issue",
                "label": "Date of Issue",
                "fieldtype": "Date",
                "insert_after": "trip_booking",
                "translatable": 0
            }
        ]
    }
    
    create_custom_fields(custom_fields)
