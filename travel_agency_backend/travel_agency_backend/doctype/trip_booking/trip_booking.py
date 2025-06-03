import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

class TripBooking(Document):
    def validate(self):
        self.calculate_row_totals()
        self.validate_services()
        self.calculate_total_amount()
        self.clean_unused_services()

    def calculate_row_totals(self):
        total = 0
        for table in self.get_all_booking_tables():
            for row in self.get(table) or []:
                supplier_cost = row.supplier_cost or 0
                markup = row.markup or 0
                row.total_amount = supplier_cost + markup
                total += row.total_amount
        self.total_amount = total

    def validate_services(self):
        if not self.selected_services:
            if any(self.get(table) for table in self.get_all_booking_tables()):
                frappe.throw("Service selection missing, but bookings exist")
            return

        for service in self.selected_services:
            table = self.get_child_table(service.service_category)
            if table and not table:
                frappe.throw(f"Please add details for {service.service_category} service")
            for row in table or []:
                cost = getattr(row, "supplier_cost_payable", None) or getattr(row, "net_fare", None)
                if cost in (None, 0):
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
                try:
                    pi = frappe.new_doc("Purchase Invoice")
                    pi.supplier = supplier
                    pi.posting_date = self.date_of_issue
                    pi.set_posting_time = 1
                    pi.due_date = self.date_of_issue
                    pi.trip_booking = self.name

                    for row in entries:
                        cost = row.supplier_cost or 0
                        if cost > 0:  # Only add items with cost
                            pi.append("items", {
                                "item_name": f"{row.service_type} - {row.passenger}",
                                "qty": 1,
                                "rate": cost,
                                "amount": cost
                            })

                    if pi.items:  # Only create PI if there are items
                        pi.insert()
                        pi.submit()
                        frappe.msgprint(f"✅ Purchase Invoice created for {supplier}")
                except Exception as e:
                    frappe.log_error(f"Failed to create Purchase Invoice for {supplier}: {str(e)}")
                    frappe.throw(f"Failed to create Purchase Invoice for {supplier}. Please check error log.")

    def create_sales_invoice(self):
        try:
            si = frappe.new_doc("Sales Invoice")
            si.customer = self.customer
            si.posting_date = self.date_of_issue
            si.set_posting_time = 1
            si.due_date = self.date_of_issue
            si.trip_booking = self.name
            si.is_pos = 0

            # Add items from all booking tables
            for table in self.get_all_booking_tables():
                for row in self.get(table) or []:
                    if row.total_amount:  # Only add items with amount
                        si.append("items", {
                            "item_name": f"{row.service_type} - {row.passenger}",
                            "qty": 1,
                            "rate": row.total_amount,
                            "amount": row.total_amount
                        })

            if si.items:  # Only create SI if there are items
                si.insert()
                si.submit()
                frappe.msgprint("✅ Sales Invoice created for this Trip Booking")
        except Exception as e:
            frappe.log_error(f"Failed to create Sales Invoice: {str(e)}")
            frappe.throw("Failed to create Sales Invoice. Please check error log.")

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
