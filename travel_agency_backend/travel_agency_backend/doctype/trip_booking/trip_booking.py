# Copyright (c) 2023, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.model.mapper import get_mapped_doc
from frappe.utils import now_datetime, nowdate, flt
from frappe import _

# Import the TripBookingConfig class
from travel_agency_backend.travel_agency_backend.doctype.trip_booking.trip_booking_config import TripBookingConfig

class TripBooking(Document):
    def get_all_booking_tables(self):
        # Use the centralized configuration
        return TripBookingConfig.get_all_tables()

    def validate(self):
        # Auto-populate selected services if we have bookings
        has_bookings = any(self.get(table) for table in self.get_all_booking_tables())
        if has_bookings:
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
        
        # IMPORTANT: Do NOT clean any tables - preserve all data
        # Skip the clean_unused_services call entirely
        
        # Only validate if we're submitting
        if self.docstatus == 1:
            self.validate_services()
            
        self.calculate_row_totals()
        self.calculate_total_amount()

    def calculate_row_totals(self):
        for table in self.get_all_booking_tables():
            for row in self.get(table) or []:
                if not hasattr(row, 'service_type'):
                    continue
                    
                # Use TripBookingConfig to determine cost, markup, and commission fields
                service_config = TripBookingConfig.get_service_config(row.service_type)
                if not service_config:
                    continue
                    
                # Calculate supplier cost
                supplier_cost = 0
                for cost_field in service_config.get('cost_fields', []):
                    if hasattr(row, cost_field) and getattr(row, cost_field):
                        supplier_cost += flt(getattr(row, cost_field))
                
                # Calculate markup
                markup = 0
                markup_field = service_config.get('markup_field')
                if markup_field and hasattr(row, markup_field):
                    markup = flt(getattr(row, markup_field) or 0)
                
                # Calculate commission/service fee
                commission = 0
                commission_field = service_config.get('commission_field')
                if commission_field and hasattr(row, commission_field):
                    commission = flt(getattr(row, commission_field) or 0)
                
                # Set total amount and selling price
                row.total_amount = supplier_cost + markup + commission
                row.selling_price = row.total_amount

    def validate_services(self):
        # Skip validation if no selected services
        if not self.selected_services:
            return
            
        # Validate each selected service
        for service in self.selected_services:
            # Get service configuration
            service_config = TripBookingConfig.get_service_config(service.service_category)
            if not service_config:
                frappe.throw(_("Invalid service category: {0}").format(service.service_category))
                
            # Get table name from configuration
            table = service_config.get('table')
            if not table or not self.get(table):
                frappe.throw(_("Please add details for {0} service").format(service.service_category))
            
            # Validate each row in the table
            for row in self.get(table) or []:
                # Check for supplier cost using service configuration
                has_cost = False
                for cost_field in service_config.get('cost_fields', []):
                    if hasattr(row, cost_field) and flt(getattr(row, cost_field)):
                        has_cost = True
                        break
                    
                if not has_cost:
                    frappe.throw(_("Missing Supplier Cost for passenger '{0}' in {1}").format(
                        row.passenger, service.service_category))

    def calculate_total_amount(self):
        total = 0
        for table in self.get_all_booking_tables():
            for row in self.get(table) or []:
                total += row.total_amount or 0
        self.total_amount = total

    def clean_unused_services(self):
        # Don't clear tables if there are no selected services but there are entries
        # This prevents data loss when saving without selected services
        has_bookings = any(self.get(table) for table in self.get_all_booking_tables())
        if not self.selected_services and has_bookings:
            return
            
        # If no selected services and no bookings, clear all tables
        if not self.selected_services:
            return

        # Only clear tables for services not selected
        active = {s.service_category for s in self.selected_services}
        for category in self.get_service_category_mapping().values():
            if category not in active:
                fieldname = self.get_table_fieldname(category)
                if fieldname:
                    setattr(self, fieldname, [])

    def before_submit(self):
        # Check if any booking tables have entries
        has_bookings = any(self.get(table) for table in self.get_all_booking_tables())
        
        # Auto-populate selected services if needed before submission
        if has_bookings and not self.selected_services:
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
        
        # After auto-populating, check if we still have no selected services
        if not self.selected_services:
            frappe.throw("Please add at least one service before submitting")
            
        # Validate that each selected service has booking details
        for service in self.selected_services:
            table_fieldname = self.get_child_table(service.service_category)
            if table_fieldname and not self.get(table_fieldname):
                frappe.throw(_("Please add booking details for {0} service").format(service.service_category))

    def on_submit(self):
        # Auto invoice creation removed - now only done via UI buttons
        pass

    def create_purchase_invoices(self):
        # Use centralized configuration for service mapping
        service_map = {}
        for service_type, config in TripBookingConfig.SERVICES.items():
            service_map[config['table']] = config['supplier_field']

        try:
            created_invoices = []
            for table, supplier_field in service_map.items():
                supplier = self.get(supplier_field)
                entries = self.get(table)
                if not supplier or not entries:
                    continue
                    
                # Skip if no entries have costs
                has_costs = False
                for row in entries:
                    if not hasattr(row, 'service_type'):
                        continue
                        
                    service_config = TripBookingConfig.get_service_config(row.service_type)
                    if not service_config:
                        continue
                        
                    for cost_field in service_config.get('cost_fields', []):
                        if hasattr(row, cost_field) and flt(getattr(row, cost_field)):
                            has_costs = True
                            break
                    if has_costs:
                        break
                        
                if not has_costs:
                    continue
                
                if not supplier_items.get(supplier):
                    pi = frappe.new_doc('Purchase Invoice')
                    pi.supplier = supplier
                    company = frappe.defaults.get_user_default("company")
                    pi.company = company
                    pi.currency = frappe.get_cached_value("Company", company, "default_currency") if company else "USD"
                    pi.posting_date = nowdate()
                    pi.due_date = nowdate()
                    pi.set_posting_time = 1
                    pi.trip_booking = self.name
                    
                    # Get expense account and item code from Service Type if available
                    expense_account = None
                    item_code = None
                    if entries and hasattr(entries[0], 'service_type'):
                        service_type = entries[0].service_type
                        expense_account = frappe.db.get_value('Service Type', service_type, 'purchase_account') or \
                                        frappe.db.get_value('Service Type', service_type, 'service_expense_account')
                        item_code = frappe.db.get_value('Service Type', service_type, 'item_code')
                    
                    supplier_items[supplier] = pi
                else:
                    pi = supplier_items[supplier]
                    
                    service_type = entries[0].service_type
                    expense_account = frappe.db.get_value('Service Type', service_type, 'purchase_account') or \
                                    frappe.db.get_value('Service Type', service_type, 'service_expense_account')
                    item_code = frappe.db.get_value('Service Type', service_type, 'item_code')

                for row in entries:
                    # Use TripBookingConfig to determine cost fields
                    cost = 0
                    service_config = TripBookingConfig.get_service_config(row.service_type)
                    if service_config:
                        for cost_field in service_config.get('cost_fields', []):
                            if hasattr(row, cost_field) and getattr(row, cost_field):
                                cost = flt(getattr(row, cost_field))
                                break
                    
                    if not cost:
                        continue
                        
                    pi.append("items", {
                        "item_code": item_code,
                        "item_name": f"{row.service_type} - {row.passenger}",
                        "description": f"{row.service_type} for {row.passenger}",
                        "qty": 1,
                        "rate": cost,
                        "amount": cost,
                        "expense_account": expense_account,
                        # Custom fields for traceability
                        "passenger": row.passenger,
                        "service_type": row.service_type,
                        "trip_booking": self.name
                    })

                # Only create invoice if it has items
                if pi.items:
                    pi.run_method("set_missing_values")
                    pi.insert()
                    pi.submit()
                    created_invoices.append(supplier)
                    frappe.msgprint(_("✅ Purchase Invoice created for {0}").format(supplier))
            
            if not created_invoices:
                frappe.msgprint(_("No purchase invoices were created. Check supplier costs."))
                
        except Exception as e:
            frappe.log_error(f"Error creating purchase invoices: {str(e)}", "Trip Booking")
            frappe.msgprint(_("Error creating purchase invoices. See error log for details."))

    def create_sales_invoice(self):
        try:
            # Check if customer exists
            if not self.customer:
                frappe.msgprint(_("No customer specified. Sales Invoice not created."))
                return
                
            # Create sales invoice
            si = frappe.new_doc("Sales Invoice")
            si.customer = self.customer
            si.posting_date = nowdate()
            si.due_date = nowdate()
            si.set_posting_time = 1
            si.is_pos = 0
            si.trip_booking = self.name
            
            # Add items from all booking tables using TripBookingConfig
            for table in self.get_all_booking_tables():
                for row in self.get(table) or []:
                    if not hasattr(row, 'service_type') or not row.total_amount:
                        continue
                        
                    # Get service configuration
                    service_config = TripBookingConfig.get_service_config(row.service_type)
                    if not service_config:
                        continue
                    
                    # Get item code from Service Type if available
                    item_code = frappe.db.get_value('Service Type', row.service_type, 'item_code')
                    income_account = frappe.db.get_value('Service Type', row.service_type, 'sales_account') or \
                                    frappe.db.get_value('Service Type', row.service_type, 'income_account')
                    
                    # Create invoice item
                    si.append("items", {
                        "item_code": item_code,
                        "item_name": f"{row.service_type} - {row.passenger}",
                        "description": f"{row.service_type} for {row.passenger}",
                        "qty": 1,
                        "rate": flt(row.total_amount),
                        "amount": flt(row.total_amount),
                        "income_account": income_account,
                        # Custom fields for traceability
                        "passenger": row.passenger,
                        "service_type": row.service_type,
                        "trip_booking": self.name
                    })
            
            # Only create invoice if it has items
            if si.items:
                si.run_method("set_missing_values")
                si.run_method("calculate_taxes_and_totals")
                si.insert()
                si.submit()
                frappe.msgprint(_("✅ Sales Invoice created for this Trip Booking"))
            else:
                frappe.msgprint(_("No items with amounts found. Sales Invoice not created."))
                
        except Exception as e:
            error_msg = f"Error creating sales invoice: {str(e)}"
            frappe.log_error(error_msg, "Trip Booking")
            frappe.msgprint(_(f"Error creating Sales Invoice: {str(e)}"), indicator="red")
            return None

    def get_table_fieldname(self, service_category):
        # Use TripBookingConfig to get the table fieldname
        service_config = TripBookingConfig.get_service_config(service_category)
        if service_config:
            return service_config.get('table')
            
        # For backward compatibility with shortened category names
        for full_category, config in TripBookingConfig.SERVICES.items():
            if full_category.endswith(service_category):
                return config.get('table')
                
        return None

    def get_all_booking_tables(self):
        return [
            "flight_booking_entry_gds",
            "flight_booking_entry_online",
            "hotel_booking_entry",
            "visa_booking_entry",
            "car_rental_booking_entry",
            "insurance_booking_entry"
        ]
        
    def get_service_category_mapping(self):
        # Use the centralized configuration
        service_categories = TripBookingConfig.get_service_categories()
        return {
            category: category.split(' ')[-1] if len(category.split(' ')) > 1 else category 
            for category in service_categories
        }

    def get_child_table(self, category):
        # Just return the fieldname, not the actual table data
        return self.get_table_fieldname(category)


@frappe.whitelist()
def get_available_services():
    # Use the centralized configuration
    service_categories = TripBookingConfig.get_service_categories()
    mapping = get_service_category_mapping()
    
    return [
        {
            "value": category, 
            "label": category, 
            "category": mapping.get(category, category)
        }
        for category in service_categories
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
    # Use the centralized configuration
    service_categories = TripBookingConfig.get_service_categories()
    return {
        category: category.split(' ')[-1] if len(category.split(' ')) > 1 else category 
        for category in service_categories
    }


@frappe.whitelist()
def make_sales_invoice_from_trip(source_name, target_doc=None):
    """Create a Sales Invoice from Trip Booking"""
    
    try:
        frappe.msgprint("Creating Sales Invoice...", alert=True)
        source = frappe.get_doc("Trip Booking", source_name)
        if source.docstatus != 1:
            frappe.throw("Trip Booking must be submitted before creating Sales Invoice")
            
        # Create Sales Invoice
        si = frappe.new_doc("Sales Invoice")
        si.customer = source.customer
        si.posting_date = nowdate()
        si.due_date = nowdate()
        si.set_posting_time = 1
        si.trip_booking = source.name
        
        # Get currency from company defaults
        company = frappe.defaults.get_user_default("company")
        si.currency = frappe.get_cached_value("Company", company, "default_currency") if company else "USD"
            
        # Map table names to default service types for entries without service_type field
        table_to_service_type_map = {}
        for service_type, config in TripBookingConfig.SERVICES.items():
            table_name = config.get('table')
            if table_name:
                table_to_service_type_map[table_name] = service_type
        
        # Counter to track items added
        items_added = 0
    
        # Process all booking tables
        for table in source.get_all_booking_tables():
            entries = source.get(table) or []
            if not entries:
                continue
            
            # Get default service type for this table
            default_service_type = table_to_service_type_map.get(table)
            
            for entry in entries:
                # Get the service type - either from entry or from table mapping
                service_type = None
                if hasattr(entry, 'service_type') and entry.service_type:
                    service_type = entry.service_type
                else:
                    service_type = default_service_type
                
                # Skip if we couldn't determine service type
                if not service_type:
                    continue
            
                # Get service config
                service_config = TripBookingConfig.get_service_config(service_type)
                if not service_config:
                    continue
                
                # Calculate total amount
                total_amount = 0
            
                # First try to use total_amount field if it exists
                if hasattr(entry, 'total_amount') and entry.total_amount:
                    total_amount = flt(entry.total_amount)
                else:
                    # If no total_amount, calculate from components
                    for cost_field in service_config.get('cost_fields', []):
                        if hasattr(entry, cost_field) and getattr(entry, cost_field):
                            total_amount += flt(getattr(entry, cost_field))
                    
                    # Add markup
                    markup_field = service_config.get('markup_field')
                    if markup_field and hasattr(entry, markup_field) and getattr(entry, markup_field):
                        total_amount += flt(getattr(entry, markup_field))
                
                    # Add commission/service fee
                    commission_field = service_config.get('commission_field')
                    if commission_field and hasattr(entry, commission_field) and getattr(entry, commission_field):
                        total_amount += flt(getattr(entry, commission_field))
                
                # Skip entries with no cost
                if total_amount <= 0:
                    continue
            
                # Get income account and item code
                income_account = frappe.db.get_value('Service Type', service_type, 'income_account') or \
                                frappe.db.get_value('Service Type', service_type, 'sales_account')
                item_code = frappe.db.get_value('Service Type', service_type, 'item_code')
                
                # Create descriptive text for the line item
                description = f"{service_type} for {entry.passenger}"
            
                # Add reference numbers if available
                if hasattr(entry, 'pnr') and entry.pnr:
                    description += f" (PNR: {entry.pnr})"
                if hasattr(entry, 'booking_reference') and entry.booking_reference:
                    description += f" (Ref: {entry.booking_reference})"
                elif hasattr(entry, 'booking_reference_number') and entry.booking_reference_number:
                    description += f" (Ref: {entry.booking_reference_number})"
                
                # For car rentals, add pickup/return dates if available
                if service_type == "Car Rental Service" and hasattr(entry, 'pickup_date') and entry.pickup_date:
                    description += f" (Pickup: {entry.pickup_date})"
                    if hasattr(entry, 'return_date') and entry.return_date:
                        description += f" (Return: {entry.return_date})"
                
                # Add item to sales invoice
                si.append("items", {
                    "item_code": item_code,
                    "item_name": f"{service_type} - {entry.passenger}",
                    "description": description,
                    "qty": 1,
                    "rate": total_amount,
                    "amount": total_amount,
                    "income_account": income_account,
                    # Custom fields for traceability
                    "passenger": entry.passenger,
                    "service_type": service_type,
                    "trip_booking": source.name
                })
            
                items_added += 1
        
        # Only create and submit invoice if it has items
        if items_added > 0:
            si.run_method("set_missing_values")
            si.insert()
            si.submit()
            
            # Update the Trip Booking with the Sales Invoice ID
            source.db_set('sales_invoice_id', si.name)
            frappe.db.commit()
            
            frappe.msgprint(_(f"✅ Sales Invoice {si.name} created with {items_added} items"))
            return si
        else:
            frappe.msgprint(_("No items with costs found to create Sales Invoice"))
            return None
    except Exception as e:
        error_msg = f"Error creating sales invoice: {str(e)}"
        frappe.log_error(error_msg, "Trip Booking")
        frappe.msgprint(_(f"❌ Error creating Sales Invoice: {str(e)}"))
        return None





@frappe.whitelist()
def make_purchase_invoices_from_trip(source_name):
    """Create Purchase Invoices from Trip Booking, one per supplier"""
    doc = frappe.get_doc("Trip Booking", source_name)
    if doc.docstatus != 1:
        frappe.throw(_("Trip Booking must be submitted before creating Purchase Invoice"))
        
    try:
        # Initialize a dictionary to group items by supplier
        supplier_items = {}
        purchase_invoices = []
        
        # Create mapping from table to service type
        table_to_service_type_map = {}
        for service_type, config in TripBookingConfig.SERVICES.items():
            table_name = config.get('table')
            if table_name:
                table_to_service_type_map[table_name] = service_type
        
        # Process all booking tables
        for table in doc.get_all_booking_tables():
            entries = doc.get(table) or []
            if not entries:
                continue
                
            # Get the service type from mapping
            default_service_type = table_to_service_type_map.get(table)
            if not default_service_type:
                continue
                
            # Get service config
            service_config = TripBookingConfig.get_service_config(default_service_type)
            if not service_config:
                continue
            
            # Get supplier field from config
            supplier_field = service_config.get('supplier_field')
            if not supplier_field:
                continue
                
            # Get the supplier for this service type from the parent Trip Booking document
            # IMPORTANT: All entries for a service type use ONE supplier defined at Trip Booking level
            # For example, all car_rental_booking_entry entries use the car_rental_supplier
            supplier = doc.get(supplier_field)
            
            # Skip if no supplier specified for this service type
            if not supplier:
                frappe.msgprint(_(f"Warning: Skipping {len(entries)} entries in {table} - no supplier specified in {supplier_field}"))
                continue
            
            # Process each entry with this service type's supplier
            for entry in entries:
                # Get the service type - either from entry or from table mapping
                service_type = default_service_type
                if hasattr(entry, 'service_type') and entry.service_type:
                    service_type = entry.service_type
                    
                # Calculate cost - first try supplier_cost field if it exists
                cost = 0
                if hasattr(entry, 'supplier_cost') and entry.supplier_cost:
                    cost = flt(entry.supplier_cost)
                else:
                    # If no supplier_cost, use default cost fields from config
                    for cost_field in service_config.get('cost_fields', []):
                        if hasattr(entry, cost_field) and getattr(entry, cost_field):
                            cost += flt(getattr(entry, cost_field))
                
                # Skip if cost is zero
                if cost <= 0:
                    continue
                    
                # Get expense account and item code
                expense_account = frappe.db.get_value('Service Type', service_type, 'service_expense_account') or \
                                frappe.db.get_value('Service Type', service_type, 'purchase_account')
                item_code = frappe.db.get_value('Service Type', service_type, 'item_code')
                
                # Create descriptive text for the line item
                description = f"{service_type} for {entry.passenger}"
                
                # Add reference numbers if available
                if hasattr(entry, 'pnr') and entry.pnr:
                    description += f" (PNR: {entry.pnr})"
                if hasattr(entry, 'booking_reference') and entry.booking_reference:
                    description += f" (Ref: {entry.booking_reference})"
                elif hasattr(entry, 'booking_reference_number') and entry.booking_reference_number:
                    description += f" (Ref: {entry.booking_reference_number})"
                
                # Special handling for service-specific fields
                if service_type == "Flight Service" and hasattr(entry, 'flight_number') and entry.flight_number:
                    description += f" (Flight: {entry.flight_number})"
                    if hasattr(entry, 'flight_date') and entry.flight_date:
                        description += f" on {entry.flight_date}"
                elif service_type == "Car Rental Service" and hasattr(entry, 'pickup_date') and entry.pickup_date:
                    description += f" (Pickup: {entry.pickup_date})"
                    if hasattr(entry, 'return_date') and entry.return_date:
                        description += f" (Return: {entry.return_date})"
                elif service_type == "Hotel Service" and hasattr(entry, 'check_in') and entry.check_in:
                    description += f" (Check-in: {entry.check_in})"
                    if hasattr(entry, 'check_out') and entry.check_out:
                        description += f" (Check-out: {entry.check_out})"
                
                # Create the item
                item = {
                    "item_code": item_code,
                    "item_name": f"{service_type} - {entry.passenger}",
                    "description": description,
                    "qty": 1,
                    "rate": cost,
                    "amount": cost,
                    "expense_account": expense_account,
                    # Additional fields for reference
                    "passenger": entry.passenger,
                    "service_type": service_type,
                    "trip_booking": doc.name
                }
                
                # Add to supplier items
                if supplier not in supplier_items:
                    supplier_items[supplier] = []
                supplier_items[supplier].append(item)
        
        # Create one Purchase Invoice per supplier
        purchase_invoice_ids = []
        for supplier, items in supplier_items.items():
            if not items:  # Skip suppliers with no items
                continue
                
            try:
                # Create new Purchase Invoice
                pi = frappe.new_doc("Purchase Invoice")
                pi.supplier = supplier
                
                # Get company and currency from defaults
                company = frappe.defaults.get_user_default("company")
                pi.company = company
                pi.currency = frappe.get_cached_value("Company", company, "default_currency") if company else "USD"
                
                pi.posting_date = nowdate()
                pi.set_posting_time = 1
                pi.trip_booking = doc.name
                
                # Add all items for this supplier
                for item in items:
                    pi.append("items", item)
                
                # Set standard values and calculate totals
                pi.run_method("set_missing_values")
                pi.run_method("calculate_taxes_and_totals")
                
                pi.insert()
                pi.submit()
                
                purchase_invoices.append(pi)
                purchase_invoice_ids.append(pi.name)
                
                frappe.msgprint(_(f"✅ Purchase Invoice {pi.name} created with {len(items)} items for supplier {supplier}"))
                
            except Exception as e:
                frappe.log_error(f"Error creating purchase invoice for {supplier}: {str(e)}", "Trip Booking")
                frappe.msgprint(_(f"Error creating Purchase Invoice for {supplier}: {str(e)}"))
        
        # Update the Trip Booking with the list of Purchase Invoice IDs
        if purchase_invoice_ids:
            # Convert list to string for storing
            doc.db_set("purchase_invoice_ids", ",".join(purchase_invoice_ids))
            frappe.db.commit()
            
            return purchase_invoices
        else:
            frappe.msgprint(_("No Purchase Invoices were created - check if there are entries with costs > 0"))
            return []
            
    except Exception as e:
        frappe.log_error(f"Error in make_purchase_invoices_from_trip: {str(e)}", "Trip Booking")
        frappe.throw(_(f"Error creating Purchase Invoices: {str(e)}"))
