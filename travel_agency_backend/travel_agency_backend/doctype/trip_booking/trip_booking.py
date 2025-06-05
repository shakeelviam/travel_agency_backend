# Copyright (c) 2023, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import now_datetime, nowdate

class TripBooking(Document):
    def get_all_booking_tables(self):
        return [
            'hotel_booking_entry',
            'visa_booking_entry',
            'car_rental_booking_entry',
            'flight_booking_entry_gds',
            'flight_booking_entry_online',
            'insurance_booking_entry'
        ]

    def validate(self):
        self.calculate_row_totals()
        self.validate_services()
        self.calculate_total_amount()
        self.clean_unused_services()

    def calculate_row_totals(self):
        for table in self.get_all_booking_tables():
            for row in self.get(table) or []:
                # Handle different field names for supplier cost across different child tables
                supplier_cost = 0
                if hasattr(row, 'supplier_cost_payable'):
                    supplier_cost = row.supplier_cost_payable or 0
                elif hasattr(row, 'net_fare'):
                    supplier_cost = row.net_fare or 0
                elif hasattr(row, 'supplier_cost'):
                    supplier_cost = row.supplier_cost or 0
                
                # Handle different field names for markup
                markup = 0
                if hasattr(row, 'markup'):
                    markup = row.markup or 0
                
                # Handle different field names for commission/service fee
                commission = 0
                if hasattr(row, 'service_fee'):
                    commission = row.service_fee or 0
                elif hasattr(row, 'commission'):
                    commission = row.commission or 0
                
                row.total_amount = supplier_cost + markup + commission
                row.selling_price = row.total_amount

    def validate_services(self):
        # Check if any booking tables have entries
        has_bookings = any(self.get(table) for table in self.get_all_booking_tables())
        
        # If there are no selected services but bookings exist, auto-populate selected_services
        if not self.selected_services and has_bookings:
            # Auto-populate selected services based on existing bookings
            for table in self.get_all_booking_tables():
                if self.get(table):
                    # Get the service category from the first row's service_type
                    rows = self.get(table)
                    if rows and hasattr(rows[0], 'service_type'):
                        service_type = rows[0].service_type
                        # Add to selected services if not already there
                        if not any(s.service_category == service_type for s in self.selected_services):
                            self.append('selected_services', {
                                'service_category': service_type
                            })
        
        # Skip further validation if no selected services
        if not self.selected_services:
            return
            
        # Validate each selected service
        for service in self.selected_services:
            table = self.get_child_table(service.service_category)
            if table and not self.get(table):
                frappe.throw(f"Please add details for {service.service_category} service")
            
            for row in self.get(table) or []:
                # Check for supplier cost using hasattr to be safe
                has_cost = False
                if hasattr(row, 'supplier_cost_payable') and row.supplier_cost_payable:
                    has_cost = True
                elif hasattr(row, 'net_fare') and row.net_fare:
                    has_cost = True
                elif hasattr(row, 'supplier_cost') and row.supplier_cost:
                    has_cost = True
                    
                if not has_cost:
                    frappe.throw(f"Missing Supplier Cost for passenger '{row.passenger}' in {service.service_category}")

    def calculate_total_amount(self):
        total = 0
        for table in self.get_all_booking_tables():
            for row in self.get(table) or []:
                total += row.total_amount or 0
        self.total_amount = total

    def clean_unused_services(self):
        if not self.selected_services:
            for table in self.get_all_booking_tables():
                setattr(self, table, [])
            return

        active = {s.service_category for s in self.selected_services}
        for category in self.get_service_category_mapping().values():
            if category not in active:
                fieldname = self.get_table_fieldname(category)
                if fieldname:
                    setattr(self, fieldname, [])

    def before_submit(self):
        if not self.selected_services:
            frappe.throw("Please add at least one service before submitting")
        for service in self.selected_services:
            table = self.get_child_table(service.service_category)
            if table is not None and not table:
                frappe.throw(f"Please add booking details for {service.service_category} service")

    def on_submit(self):
        self.create_purchase_invoices()
        self.create_sales_invoice()

    def create_purchase_invoices(self):
        service_map = {
            "flight_booking_entry_gds": "flight_gds_supplier",
            "flight_booking_entry_online": "flight_online_supplier",
            "hotel_booking_entry": "hotel_supplier",
            "visa_booking_entry": "visa_supplier",
            "car_rental_booking_entry": "car_rental_supplier",
            "insurance_booking_entry": "insurance_supplier"
        }

        for table, supplier_field in service_map.items():
            supplier = self.get(supplier_field)
            entries = self.get(table)
            if supplier and entries:
                pi = frappe.new_doc("Purchase Invoice")
                pi.supplier = supplier
                pi.due_date = now_datetime()
                pi.set_posting_time = 1

                for row in entries:
                    cost = row.supplier_cost_payable or row.net_fare or 0
                    pi.append("items", {
                        "item_name": f"{row.service_type} - {row.passenger}",
                        "qty": 1,
                        "rate": cost,
                        "amount": cost,
                        "schedule_date": now_datetime()
                    })

                pi.insert()
                pi.submit()
                frappe.msgprint(f"✅ Purchase Invoice created for {supplier}")

    def create_sales_invoice(self):
        si = frappe.new_doc("Sales Invoice")
        si.customer = self.customer
        si.due_date = now_datetime()
        si.set_posting_time = 1
        si.is_pos = 0

        for table in self.get_all_booking_tables():
            for row in self.get(table) or []:
                si.append("items", {
                    "item_name": f"{row.service_type} - {row.passenger}",
                    "qty": 1,
                    "rate": row.total_amount or 0,
                    "amount": row.total_amount or 0,
                    "schedule_date": now_datetime()
                })

        si.insert()
        si.submit()
        frappe.msgprint("✅ Sales Invoice created for this Trip Booking")

    def get_table_fieldname(self, service_category):
        return {
            "Flight GDS": "flight_booking_entry_gds",
            "Flight Online Airlines": "flight_booking_entry_online",
            "Hotel": "hotel_booking_entry",
            "Visa": "visa_booking_entry",
            "Car Rental": "car_rental_booking_entry",
            "Insurance": "insurance_booking_entry"
        }.get(service_category)

    def get_all_booking_tables(self):
        return [
            "flight_booking_entry_gds",
            "flight_booking_entry_online",
            "hotel_booking_entry",
            "visa_booking_entry",
            "car_rental_booking_entry",
            "insurance_booking_entry"
        ]

    def get_child_table(self, category):
        fieldname = self.get_table_fieldname(category)
        return getattr(self, fieldname, None) if fieldname else None


@frappe.whitelist()
def get_available_services():
    return [
        {"value": "Flight GDS", "label": "Flight GDS", "category": "Flight GDS"},
        {"value": "Flight Online Airlines", "label": "Flight Online Airlines", "category": "Flight Online Airlines"},
        {"value": "Hotel Booking", "label": "Hotel Booking", "category": "Hotel"},
        {"value": "Visa Application Charges", "label": "Visa Application Charges", "category": "Visa"},
        {"value": "Car Rental Service", "label": "Car Rental Service", "category": "Car Rental"},
        {"value": "Insurance Service", "label": "Insurance Service", "category": "Insurance"}
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
    frappe.msgprint(f"❌ Removed service: {service_category}")
    return True


@frappe.whitelist()
def get_service_category_mapping():
    return {
        "Flight GDS": "Flight GDS",
        "Flight Online Airlines": "Flight Online Airlines",
        "Hotel Booking": "Hotel",
        "Visa Application Charges": "Visa",
        "Car Rental Service": "Car Rental",
        "Insurance Service": "Insurance"
    }


@frappe.whitelist()
def make_sales_invoice_from_trip(source_name, target_doc=None):
    """Create Sales Invoice from Trip Booking following ERPNext convention"""
    def set_missing_values(source, target):
        # Set customer, posting date, etc.
        target.customer = source.customer
        target.due_date = nowdate()
        target.posting_date = nowdate()
        target.set_posting_time = 1
        target.trip_booking = source.name
        
        # Add items from all booking tables
        for table in source.get_all_booking_tables():
            for row in source.get(table) or []:
                target.append("items", {
                    "item_name": f"{row.service_type} - {row.passenger}",
                    "description": f"{row.service_type} for {row.passenger}",
                    "qty": 1,
                    "rate": row.total_amount or 0,
                    "amount": row.total_amount or 0
                })
        
        # Calculate taxes and totals
        target.run_method("set_missing_values")
        target.run_method("calculate_taxes_and_totals")
    
    doclist = get_mapped_doc("Trip Booking", source_name, {
        "Trip Booking": {
            "doctype": "Sales Invoice",
            "validation": {
                "docstatus": ["=", 1]
            }
        }
    }, target_doc, set_missing_values)
    
    return doclist


@frappe.whitelist()
def make_purchase_invoices_from_trip(source_name):
    """Create Purchase Invoices from Trip Booking"""
    doc = frappe.get_doc("Trip Booking", source_name)
    if doc.docstatus != 1:
        frappe.throw("Trip Booking must be submitted before creating Purchase Invoices")
    
    service_map = {
        "flight_booking_entry_gds": "flight_gds_supplier",
        "flight_booking_entry_online": "flight_online_supplier",
        "hotel_booking_entry": "hotel_supplier",
        "visa_booking_entry": "visa_supplier",
        "car_rental_booking_entry": "car_rental_supplier",
        "insurance_booking_entry": "insurance_supplier"
    }
    
    created_invoices = []
    
    for table, supplier_field in service_map.items():
        supplier = doc.get(supplier_field)
        entries = doc.get(table)
        if supplier and entries:
            pi = frappe.new_doc("Purchase Invoice")
            pi.supplier = supplier
            pi.posting_date = nowdate()
            pi.due_date = nowdate()
            pi.set_posting_time = 1
            pi.trip_booking = doc.name
            
            # Get expense account from Service Type if available
            expense_account = None
            if entries and hasattr(entries[0], 'service_type'):
                expense_account = frappe.db.get_value('Service Type', entries[0].service_type, 'service_expense_account')
            
            for row in entries:
                # Handle different field names for supplier cost
                cost = 0
                if hasattr(row, 'supplier_cost_payable'):
                    cost = row.supplier_cost_payable or 0
                elif hasattr(row, 'net_fare'):
                    cost = row.net_fare or 0
                elif hasattr(row, 'supplier_cost'):
                    cost = row.supplier_cost or 0
                
                pi.append("items", {
                    "item_name": f"{row.service_type} - {row.passenger}",
                    "description": f"{row.service_type} for {row.passenger}",
                    "qty": 1,
                    "rate": cost,
                    "amount": cost,
                    "expense_account": expense_account
                })
            
            pi.run_method("set_missing_values")
            pi.insert()
            created_invoices.append({
                "name": pi.name,
                "supplier": supplier,
                "amount": pi.grand_total
            })
    
    return created_invoices
