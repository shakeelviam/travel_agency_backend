import frappe
from frappe import _
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
            "Hotel Booking Entry",
            "Car Rental Booking Entry",
            "Visa Booking Entry",
            "Insurance Booking Entry"
        ]
        
        if ref_doctype in service_doctypes:
            dynamic_description = get_service_description(ref_doctype, ref_name)
            
            # Update the description if we generated one
            if dynamic_description:
                item.description = dynamic_description
                
def duplicate_invoice_items_for_multi_passenger(doc, method=None):
    """
    This is a hook to be called before submission of an invoice.
    If an invoice needs to be created with multiple passengers, this will be handled
    by the Trip Booking document (which is separate from this hook).
    
    Each service entry already has a single passenger, and this hook will ensure 
    proper description formatting without creating new Item master records.
    """
    # No action needed here as the Trip Booking is responsible for creating
    # multiple invoice items - one per passenger - each using the same Item
    # but with different reference_doctype/reference_name values.
    # This function is just a placeholder for future expansion if needed.
    pass
