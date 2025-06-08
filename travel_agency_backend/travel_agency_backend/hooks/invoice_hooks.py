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
