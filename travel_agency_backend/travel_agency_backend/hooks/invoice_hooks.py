import frappe
from frappe import _
from frappe.utils import cint
from ..utils.description_generator import get_service_description

def set_item_description_from_trip_booking(doc, method=None):
    """
    Updates the invoice item descriptions based on the linked services.
    This function is designed to be attached to the validate hook of both
    Sales Invoice and Purchase Invoice doctypes.
    """
    if not doc or not doc.items:
        return
    
    for item in doc.items:
        # Skip if no reference to a service entry
        if not item.get('reference_doctype') or not item.get('reference_name'):
            continue
            
        ref_doctype = item.reference_doctype
        ref_name = item.reference_name
        
        # Generate dynamic description only for our service types
        service_doctypes = [
            "Flight Booking Entry GDS",
            "Flight Booking Entry Online",
            "Flight Booking Entry GDS Multicity",
            "Flight Booking Entry Online Multicity",
            "Hotel Booking Entry",
            "Car Rental Booking Entry",
            "Visa Booking Entry",
            "Insurance Booking Entry"
        ]
        
        if ref_doctype in service_doctypes:
            # Get the referenced service entry
            service_entry = frappe.get_doc(ref_doctype, ref_name)
            
            # Copy date_of_issue from service entry to invoice item
            if hasattr(service_entry, 'date_of_issue') and service_entry.date_of_issue:
                item.date_of_issue = service_entry.date_of_issue
            
            # Generate and update description
            dynamic_description = get_service_description(ref_doctype, ref_name)
            if dynamic_description:
                item.description = dynamic_description
                
def duplicate_invoice_items_for_multi_passenger(doc, method=None):
    """
    This is a hook to be called before submission of an invoice.
    If an invoice needs to be created with multiple passengers, this will be handled
    by the Trip Booking document (which is separate from this hook).
    """
    pass

def unlink_sales_invoice_from_trip_booking(doc, method=None):
    """
    When a Sales Invoice is cancelled, remove its reference from the linked Trip Booking.
    This prevents circular dependency issues during cancellation.
    """
    if not doc:
        return
        
    # Check if this Sales Invoice is linked to a Trip Booking
    if doc.get('trip_booking'):
        trip_booking_name = doc.trip_booking
        
        # Check if the Trip Booking exists and has this Sales Invoice linked
        try:
            trip_booking = frappe.get_doc("Trip Booking", trip_booking_name)
            
            # Only proceed if the Trip Booking has this Sales Invoice linked
            if trip_booking.get('sales_invoice_id') == doc.name:
                # Update the Trip Booking to remove the Sales Invoice reference
                frappe.db.set_value("Trip Booking", trip_booking_name, "sales_invoice_id", "")
                frappe.db.commit()
                
                frappe.msgprint(_(f"Unlinked Sales Invoice {doc.name} from Trip Booking {trip_booking_name}"))
        except Exception as e:
            frappe.log_error(f"Error unlinking Sales Invoice {doc.name} from Trip Booking {trip_booking_name}: {str(e)}", 
                           "Invoice Hooks")

def unlink_purchase_invoice_from_trip_booking(doc, method=None):
    """
    When a Purchase Invoice is cancelled, remove its reference from the linked Trip Booking.
    This prevents circular dependency issues during cancellation.
    """
    if not doc:
        return
        
    # Check if this Purchase Invoice is linked to a Trip Booking
    if doc.get('trip_booking'):
        trip_booking_name = doc.trip_booking
        
        try:
            trip_booking = frappe.get_doc("Trip Booking", trip_booking_name)
            
            # Check if this Purchase Invoice is in the list of linked Purchase Invoices
            if trip_booking.get('purchase_invoice_ids'):
                purchase_invoice_ids = trip_booking.purchase_invoice_ids.split(",")
                
                if doc.name in purchase_invoice_ids:
                    # Remove this Purchase Invoice from the list
                    purchase_invoice_ids.remove(doc.name)
                    
                    # Update the Trip Booking with the new list
                    updated_ids = ",".join(purchase_invoice_ids) if purchase_invoice_ids else ""
                    frappe.db.set_value("Trip Booking", trip_booking_name, "purchase_invoice_ids", updated_ids)
                    frappe.db.commit()
                    
                    frappe.msgprint(_(f"Unlinked Purchase Invoice {doc.name} from Trip Booking {trip_booking_name}"))
        except Exception as e:
            frappe.log_error(f"Error unlinking Purchase Invoice {doc.name} from Trip Booking {trip_booking_name}: {str(e)}", 
                           "Invoice Hooks")

def unlink_invoices_from_trip_booking(doc, method=None):
    """
    When a Trip Booking is cancelled, remove its reference from any linked Sales or Purchase Invoices.
    This prevents circular dependency issues during cancellation.
    """
    if not doc:
        return
        
    # Handle Sales Invoice unlinking
    if doc.get('sales_invoice_id'):
        sales_invoice_id = doc.sales_invoice_id
        try:
            # Check if the Sales Invoice exists and is not already cancelled
            if frappe.db.exists("Sales Invoice", sales_invoice_id):
                # Update the Sales Invoice to remove the Trip Booking reference
                frappe.db.set_value("Sales Invoice", sales_invoice_id, "trip_booking", "")
                frappe.db.commit()
                
                frappe.msgprint(_(f"Unlinked Trip Booking {doc.name} from Sales Invoice {sales_invoice_id}"))
        except Exception as e:
            frappe.log_error(f"Error unlinking Trip Booking {doc.name} from Sales Invoice {sales_invoice_id}: {str(e)}", 
                           "Invoice Hooks")
    
    # Handle Purchase Invoice unlinking
    if doc.get('purchase_invoice_ids'):
        purchase_invoice_ids = doc.purchase_invoice_ids.split(",")
        
        for pi_id in purchase_invoice_ids:
            try:
                # Check if the Purchase Invoice exists and is not already cancelled
                if frappe.db.exists("Purchase Invoice", pi_id):
                    # Update the Purchase Invoice to remove the Trip Booking reference
                    frappe.db.set_value("Purchase Invoice", pi_id, "trip_booking", "")
                    frappe.db.commit()
                    
                    frappe.msgprint(_(f"Unlinked Trip Booking {doc.name} from Purchase Invoice {pi_id}"))
            except Exception as e:
                frappe.log_error(f"Error unlinking Trip Booking {doc.name} from Purchase Invoice {pi_id}: {str(e)}", 
                               "Invoice Hooks")
    # No action needed here as the Trip Booking is responsible for creating
    # multiple invoice items - one per passenger - each using the same Item
    # but with different reference_doctype/reference_name values.
    # This function is just a placeholder for future expansion if needed.
    pass
