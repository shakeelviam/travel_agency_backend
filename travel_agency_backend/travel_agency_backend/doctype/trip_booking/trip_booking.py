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
            self.validate_services()
            # self.create_purchase_invoices() # Disabled for manual creation
            # self.create_sales_invoice()   # Disabled for manual creation
            self.db_set('status', 'Submitted') # Ensure status is set if not handled by workflow
            frappe.msgprint(msg='✅ Trip Booking submitted successfully! Use the "Create" button to make invoices.', title='Success', indicator='green')
        except Exception as e:
            frappe.log_error(frappe.get_traceback())
            frappe.throw(f"Failed to process Trip Booking submission: {str(e)}")
            
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
        """Calculate total amount for each row and update document total"""
        self.total_amount = 0
        for table in self.get_all_booking_tables():
            for row in self.get(table) or []:
                try:
                    # Validate required fields
                    if not row.supplier:
                        frappe.throw(f"Supplier is required for {table}")
                    if not row.supplier_cost:
                        frappe.throw(f"Supplier Cost is required for {table}")
                    if not row.passenger:
                        frappe.throw(f"Passenger is required for {table}")
                    
                    # Convert amounts to float
                    supplier_cost = float(row.supplier_cost)
                    markup = float(row.markup or 0)
                    
                    # Calculate total and selling price
                    row.total_amount = supplier_cost + markup
                    row.selling_price = row.total_amount
                    
                    # Update document total
                    self.total_amount += row.total_amount
                    
                except ValueError:
                    frappe.throw(f"Invalid amount format in {table} for passenger {row.passenger}")
                except Exception as e:
                    frappe.throw(f"Error calculating totals: {str(e)}")

@frappe.whitelist()
def make_sales_invoice_from_trip(trip_booking_name):
    frappe.msgprint(f"DEBUG: Called make_sales_invoice_from_trip with {trip_booking_name}")
    # Simulate some processing if needed for testing client-side callbacks
    # For now, just return a simple success message
    if not frappe.db.exists("Trip Booking", trip_booking_name):
        frappe.throw(f"Trip Booking {trip_booking_name} not found.")
    # Potentially add a dummy sales_invoice_id to the Trip Booking for testing UI updates
    # frappe.db.set_value("Trip Booking", trip_booking_name, "sales_invoice_id", "DUMMY-SINV-001")
    return {"status": "ok_sales", "message": f"Successfully called make_sales_invoice_from_trip for {trip_booking_name}", "sales_invoice_id": "DUMMY-SINV-001"}

@frappe.whitelist()
def make_purchase_invoices_from_trip(trip_booking_name):
    frappe.msgprint(f"DEBUG: Called make_purchase_invoices_from_trip with {trip_booking_name}")
    if not frappe.db.exists("Trip Booking", trip_booking_name):
        frappe.throw(f"Trip Booking {trip_booking_name} not found.")
    # Simulate creation of multiple PIs
    # frappe.db.set_value("Trip Booking", trip_booking_name, "purchase_invoice_references", "DUMMY-PINV-001,DUMMY-PINV-002")
    return {"status": "ok_purchase", "message": f"Successfully called make_purchase_invoices_from_trip for {trip_booking_name}", "invoices_created": ["DUMMY-PINV-001", "DUMMY-PINV-002"]}

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
        """Re-calculate total from all rows (called during validation)"""
        self.calculate_row_totals()

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
        """Validate before submission"""
        self.validate()

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
            suppliers = {}
            supplier_items = {}

            # Group items by supplier
            for table in self.get_all_booking_tables():
                for row in self.get(table) or []:
                    if not row.supplier or not row.supplier_cost:
                        continue
                        
                    if row.supplier not in suppliers:
                        suppliers[row.supplier] = []
                        
                    item_description = self.get_item_description(row, table)
                    suppliers[row.supplier].append({
                        'item_name': item_description,
                        'description': item_description,
                        'rate': row.supplier_cost,
                        'qty': 1
                    })
            
            # Create PI for each supplier
            for supplier, items in suppliers.items():
                pi = frappe.get_doc({
                    'doctype': 'Purchase Invoice',
                    'supplier': supplier,
                    'trip_booking': self.name,
                    'items': items,
                    'update_stock': 0,
                    'set_posting_time': 1,
                    'posting_date': self.date_of_issue,
                    'due_date': self.date_of_issue
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

                    item_description = self.get_item_description(row, table)
                    items.append({
                        'item_name': item_description,
                        'description': item_description,
                        'rate': row.total_amount,
                        'qty': 1
                    })

            if not items:
                return

            si = frappe.get_doc({
                'doctype': 'Sales Invoice',
                'customer': self.customer,
                'trip_booking': self.name,
                'items': items,
                'update_stock': 0,
                'set_posting_time': 1,
                'posting_date': self.date_of_issue,
                'due_date': self.date_of_issue
            })
            si.insert()
            si.submit()
            frappe.msgprint(f"Created Sales Invoice {si.name}")
        except Exception as e:
            frappe.log_error(f"Failed to create Sales Invoice: {str(e)}")
            raise

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
