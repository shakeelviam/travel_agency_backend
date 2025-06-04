# In your local project directory: /home/shakeel/travel_agency_backend

import frappe
from frappe.model.document import Document
from frappe.utils import now_datetime, today

class TripBooking(Document):
    def get_all_booking_tables(self):
        """Return a list of all booking table fieldnames"""
        return [
            'hotel_booking_entry',
            'visa_booking_entry',
            'car_rental_booking_entry',
            'flight_booking_entry_gds',
            'flight_booking_entry_online',
            'insurance_booking_entry'
        ]
    
    def get_label_for_table(self, table_fieldname):
        """Return a human-readable label for a table fieldname"""
        labels = {
            'hotel_booking_entry': 'Hotel Booking',
            'visa_booking_entry': 'Visa Booking',
            'car_rental_booking_entry': 'Car Rental',
            'flight_booking_entry_gds': 'Flight Booking (GDS)',
            'flight_booking_entry_online': 'Flight Booking (Online)',
            'insurance_booking_entry': 'Insurance Booking'
        }
        return labels.get(table_fieldname, table_fieldname.replace('_', ' ').title())
    
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
        """Cancel linked Sales and Purchase Invoices."""
        if self.sales_invoice_id:
            try:
                si_doc = frappe.get_doc('Sales Invoice', self.sales_invoice_id)
                if si_doc.docstatus == 1: # Submitted
                    si_doc.cancel()
                    frappe.msgprint(f"Sales Invoice {self.sales_invoice_id} cancelled.")
                elif si_doc.docstatus == 0: # Draft
                    frappe.delete_doc('Sales Invoice', self.sales_invoice_id, ignore_permissions=True, force=True)
                    frappe.msgprint(f"Draft Sales Invoice {self.sales_invoice_id} deleted.")
                self.db_set("sales_invoice_id", None) # Clear the link
            except frappe.DoesNotExistError:
                frappe.msgprint(f"Sales Invoice {self.sales_invoice_id} not found. Link cleared.", indicator='orange')
                self.db_set("sales_invoice_id", None)
            except Exception as e:
                frappe.log_error(frappe.get_traceback(), f"Error cancelling/deleting Sales Invoice {self.sales_invoice_id}")
                frappe.msgprint(f"Could not cancel/delete Sales Invoice {self.sales_invoice_id}: {str(e)}", indicator='orange')

        if self.purchase_invoice_ids:
            pi_ids = [pi_id.strip() for pi_id in self.purchase_invoice_ids.split(',') if pi_id.strip()]
            for pi_id in pi_ids:
                try:
                    pi_doc = frappe.get_doc('Purchase Invoice', pi_id)
                    if pi_doc.docstatus == 1: # Submitted
                        pi_doc.cancel()
                        frappe.msgprint(f"Purchase Invoice {pi_id} cancelled.")
                    elif pi_doc.docstatus == 0: # Draft
                        frappe.delete_doc('Purchase Invoice', pi_id, ignore_permissions=True, force=True)
                        frappe.msgprint(f"Draft Purchase Invoice {pi_id} deleted.")
                except Exception as e:
                    frappe.log_error(frappe.get_traceback(), f"Error cancelling/deleting Purchase Invoice {pi_id}")
                    frappe.msgprint(f"Could not cancel/delete Purchase Invoice {pi_id}: {str(e)}", indicator='orange')
        
        self.db_set('status', 'Cancelled')
        frappe.msgprint("Trip Booking cancelled and associated invoices handled.", indicator="red")

    def calculate_row_totals(self):
        """Calculate total amount for each row in each booking table and update document total."""
        current_doc_total = 0
        for table_fieldname in ['hotel_booking_entry', 'visa_booking_entry', 'car_rental_booking_entry',
                              'flight_booking_entry_gds', 'flight_booking_entry_online', 'insurance_booking_entry']:
            for row in self.get(table_fieldname) or []:
                if hasattr(row, 'supplier_cost'):
                    supplier_cost = float(row.supplier_cost or 0)
                    markup = float(row.markup or 0)
                    row.total_amount = supplier_cost + markup
                    row.selling_price = row.total_amount
                    current_doc_total += row.total_amount
        self.total_amount = current_doc_total

@frappe.whitelist()
def make_sales_invoice_from_trip(trip_booking_name):
    doc = frappe.get_doc("Trip Booking", trip_booking_name)
    if doc.docstatus != 1:
        frappe.throw("Trip Booking must be submitted to create a Sales Invoice.")
    if doc.sales_invoice_id:
        frappe.msgprint(f"Sales Invoice {doc.sales_invoice_id} already exists for this Trip Booking.")
        return frappe.get_doc("Sales Invoice", doc.sales_invoice_id)
    
    try:
        sales_invoice = doc.create_sales_invoice() # Assuming create_sales_invoice returns the SI doc
        doc.db_set("sales_invoice_id", sales_invoice.name) # Make sure you have this field
        frappe.msgprint(f"Sales Invoice {sales_invoice.name} created successfully.")
        return sales_invoice
    except Exception as e:
        frappe.log_error(frappe.get_traceback())
        frappe.throw(f"Failed to create Sales Invoice: {str(e)}")

@frappe.whitelist()
def make_purchase_invoices_from_trip(trip_booking_name):
    doc = frappe.get_doc("Trip Booking", trip_booking_name)
    if doc.docstatus != 1:
        frappe.throw("Trip Booking must be submitted to create Purchase Invoices.")

    if doc.purchase_invoice_ids:
        frappe.msgprint(f"Purchase Invoices already seem to be created: {doc.purchase_invoice_ids}")
        # Optionally, you could return here or offer to recreate. For now, we proceed.

    try:
        created_pis_names = doc.create_purchase_invoices()
        if created_pis_names:
            doc.db_set("purchase_invoice_ids", ",".join(created_pis_names))
            doc.save() # Explicitly save the doc after db_set if not done elsewhere
            frappe.msgprint(f"Purchase Invoices created: {', '.join(created_pis_names)}")
        else:
            frappe.msgprint("No Purchase Invoices were created (perhaps no valid items or suppliers).")
        return {"invoices_created": created_pis_names, "message": "Purchase Invoices process completed."}
    except Exception as e:
        # The error should be logged in create_purchase_invoices if it originates there
        # frappe.log_error(frappe.get_traceback()) # Redundant if logged in create_purchase_invoices
        frappe.throw(f"Failed to create Purchase Invoices: {str(e)}")

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
        """Create Purchase Invoices for each supplier and return their names"""
        try:
            if not self.company:
                self.company = frappe.db.get_value('Customer', self.customer, 'company')

            suppliers = {}
            # Group items by supplier
            for table in self.get_all_booking_tables():
                for row in self.get(table) or []:
                    if not row.supplier or not row.supplier_cost:
                        continue
                        
                    if row.supplier not in suppliers:
                        suppliers[row.supplier] = []
                        
                    item_description = self.get_item_description(row, table)
                    # Get expense account from Service Type
                    expense_account = None
                    if hasattr(row, 'service_type'):
                        expense_account = frappe.db.get_value('Service Type', row.service_type, 'service_expense_account')

                    suppliers[row.supplier].append({
                        'item_name': item_description,
                        'description': item_description,
                        'rate': row.supplier_cost,
                        'qty': 1,
                        'expense_account': expense_account # Using dedicated expense account
                    })
            
            created_pi_names = []
            # Create PI for each supplier
            for supplier, items in suppliers.items():
                try:
                    # Get supplier's default credit account and cost center
                    # Use Purchase/Cost Account from Service Type if available, else default payable
                    credit_account = None
                    for item in items:
                        if item.get('expense_account'):
                            credit_account = item['expense_account']
                            break
                    
                    if not credit_account:
                        credit_account = frappe.db.get_value('Company', self.company, 'default_payable_account')
                    cost_center = frappe.db.get_value('Company', self.company, 'cost_center')

                    pi = frappe.get_doc({
                        'doctype': 'Purchase Invoice',
                        'supplier': supplier,
                        'company': self.company,
                        'custom_trip_booking': self.name,
                        'items': items,
                        'set_posting_time': 1,
                        'posting_date': self.date_of_issue,
                        'due_date': self.date_of_issue,
                        'credit_to': credit_account,
                        'cost_center': cost_center
                    })

                    pi.set_missing_values()
                    pi.insert(ignore_permissions=True)
                    pi.submit()
                    created_pi_names.append(pi.name)

                except Exception as e:
                    frappe.log_error(
                        frappe.get_traceback(),
                        f"Failed to create Purchase Invoice for supplier {supplier} in Trip Booking {self.name}"
                    )
                    raise

            return created_pi_names

        except Exception as e:
            frappe.log_error(
                frappe.get_traceback(),
                f"Failed to create Purchase Invoices for Trip Booking {self.name}"
            )
            raise

    def create_sales_invoice(self):
        """Create a single Sales Invoice for the customer for all services."""
        if not self.customer:
            frappe.throw("Customer is required to create Sales Invoice")

        items = []
        for table_fieldname in self.get_all_booking_tables():
            for row in self.get(table_fieldname) or []:
                if not row.total_amount:
                    continue

                selling_price = 0
                try:
                    selling_price = float(row.selling_price if row.selling_price is not None else 0)
                except ValueError:
                    frappe.throw(f"Invalid selling price for passenger {row.passenger_name or row.passenger} in {table_fieldname}.")

                if selling_price > 0:
                    item_description = self.get_item_description(row, table_fieldname)
                    passenger_name_field = getattr(row, 'passenger_name', getattr(row, 'passenger', 'N/A'))
                    items.append({
                        'item_name': item_description,
                        'description': f"{item_description} for {passenger_name_field}",
                        'rate': selling_price,
                        'qty': 1,
                        'income_account': frappe.db.get_value('Service Type', row.service_type, 'income_account') 
                            if hasattr(row, 'service_type') else None
                    })

        if not items:
            frappe.msgprint("No items with a valid selling price found to create Sales Invoice.")
            return None

        try:
            # Get company from settings since customer can be individual
            if not self.company:
                self.company = frappe.defaults.get_global_default('company')

            si = frappe.get_doc({
                'doctype': 'Sales Invoice',
                'customer': self.customer,
                'company': self.company,
                'custom_trip_booking': self.name,
                'items': items,
                'set_posting_time': 1,
                'posting_date': self.date_of_issue,
                'due_date': self.date_of_issue,
                'debit_to': frappe.db.get_value('Company', self.company, 'default_receivable_account'),
                'cost_center': frappe.db.get_value('Company', self.company, 'cost_center')
            })

            si.set_missing_values()
            si.insert(ignore_permissions=True)
            si.submit()
            return si

        except Exception as e:
            frappe.log_error(frappe.get_traceback(), f"Failed to create Sales Invoice for Trip Booking {self.name}")
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
