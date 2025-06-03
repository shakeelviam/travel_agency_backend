import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime

class TripBooking(Document):
    def validate(self):
        self.calculate_row_totals()
        self.validate_services()
        self.calculate_total_amount()
        self.clean_unused_services()
        
    def on_submit(self):
        """Create Purchase and Sales Invoices on submit"""
        try:
            self.create_purchase_invoices()
            self.create_sales_invoice()
            frappe.msgprint(
                msg='✅ Trip Booking processed successfully!',
                title='Success',
                indicator='green'
            )
        except Exception as e:
            frappe.throw(f"Failed to process Trip Booking: {str(e)}")
            
    def on_cancel(self):
        """Cancel linked Purchase and Sales Invoices"""
        # Cancel Sales Invoice
        sales_invoices = frappe.get_all(
            'Sales Invoice',
            filters={'trip_booking': self.name, 'docstatus': 1}
        )
        for si in sales_invoices:
            doc = frappe.get_doc('Sales Invoice', si.name)
            doc.cancel()
            frappe.msgprint(f"Sales Invoice {si.name} cancelled")
            
        # Cancel Purchase Invoices
        purchase_invoices = frappe.get_all(
            'Purchase Invoice',
            filters={'trip_booking': self.name, 'docstatus': 1}
        )
        for pi in purchase_invoices:
            doc = frappe.get_doc('Purchase Invoice', pi.name)
            doc.cancel()
            frappe.msgprint(f"Purchase Invoice {pi.name} cancelled")

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
        """Create Purchase Invoices for each supplier"""
        service_map = {
            "flight_booking_entry_gds": ("flight_gds_supplier", "Flight GDS"),
            "flight_booking_entry_online": ("flight_online_supplier", "Flight Online"),
            "hotel_booking_entry": ("hotel_supplier", "Hotel"),
            "visa_booking_entry": ("visa_supplier", "Visa"),
            "car_rental_booking_entry": ("car_rental_supplier", "Car Rental"),
            "insurance_booking_entry": ("insurance_supplier", "Insurance")
        }
        
        try:
            supplier_items = {}

            # Group items by supplier
            for table in self.get_all_booking_tables():
                for row in self.get(table) or []:
                    if not row.supplier_cost:
                        continue
                    
                    supplier_field, _ = service_map.get(table, (None, None))
                    if not supplier_field:
                        continue
                        
                    supplier = self.get(supplier_field)
                    if not supplier:
                        continue

                    if supplier not in supplier_items:
                        supplier_items[supplier] = []

                    item_name = self.get_item_description(row, table)
                    supplier_items[supplier].append({
                        'item_name': item_name,
                        'rate': row.supplier_cost,
                        'qty': 1
                    })

            # Create Purchase Invoice for each supplier
            for supplier, items in supplier_items.items():
                if not items:
                    continue

                pi = frappe.get_doc({
                    'doctype': 'Purchase Invoice',
                    'supplier': supplier,
                    'trip_booking': self.name,
                    'items': items
                })
                pi.insert()
                pi.submit()
                frappe.msgprint(f"Created Purchase Invoice {pi.name}")

        except Exception as e:
            frappe.log_error(f"Failed to create Purchase Invoice: {str(e)}")
            raise

    def get_item_description(self, row, table):
        """Generate item description based on service type"""
        passenger_name = frappe.db.get_value('Passenger', row.passenger, 'full_name') or row.passenger
        
        if table == 'flight_booking_entry_gds':
            sector = f"{row.from_sector}-{row.to_sector}"
            if row.return_date:
                sector += f"-{row.from_sector}"
            return f"{passenger_name} {sector} {row.pnr or ''}".strip()
            
        elif table == 'flight_booking_entry_online':
            sector = f"{row.from_sector}-{row.to_sector}"
            if row.return_date:
                sector += f"-{row.from_sector}"
            return f"{passenger_name} {sector} {row.ticket_number or ''}".strip()
            
        elif table == 'insurance_booking_entry':
            return f"{passenger_name} {row.policy_number or ''}".strip()
            
        elif table == 'hotel_booking_entry':
            return f"{passenger_name} {row.booking_reference_number or ''}".strip()
            
        elif table == 'car_rental_booking_entry':
            return f"{passenger_name} {row.booking_reference_number or ''}".strip()
            
        elif table == 'visa_booking_entry':
            return f"{passenger_name} {row.visa_number or ''}".strip()
            
        return f"{row.service_type} - {passenger_name}"

    def create_sales_invoice(self):
        """Create Sales Invoice for customer"""
        try:
            if not self.customer:
                frappe.throw("Customer is required to create Sales Invoice")

            items = []
            for table in self.get_all_booking_tables():
                for row in self.get(table) or []:
                    if not row.total_amount:
                        continue

                    item_name = self.get_item_description(row, table)
                    items.append({
                        'item_name': item_name,
                        'rate': row.total_amount,
                        'qty': 1
                    })

            if not items:
                return

            si = frappe.get_doc({
                'doctype': 'Sales Invoice',
                'customer': self.customer,
                'trip_booking': self.name,
                'items': items
            })
            si.insert()
            si.submit()
            frappe.msgprint(f"Created Sales Invoice {si.name}")
        except Exception as e:
            frappe.log_error(f"Failed to create Sales Invoice: {str(e)}")
            raise frappe.throw("Failed to create Sales Invoice. Please check error log.")

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
