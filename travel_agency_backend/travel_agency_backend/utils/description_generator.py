import frappe
from frappe import _

def get_flight_booking_gds_description(booking_entry):
    """Generate detailed description for Flight GDS bookings"""
    passenger_name = booking_entry.passenger_name or "N/A"
    from_sector = frappe.get_value("Sector Master", booking_entry.from_sector, "sector_code") if booking_entry.from_sector else "N/A"
    to_sector = frappe.get_value("Sector Master", booking_entry.to_sector, "sector_code") if booking_entry.to_sector else "N/A"
    
    # For return trips, include return sector
    sector_info = f"{from_sector}-{to_sector}"
    if booking_entry.trip_type == "Return" and booking_entry.return_sector:
        return_sector = frappe.get_value("Sector Master", booking_entry.return_sector, "sector_code") or "N/A"
        sector_info = f"{from_sector}-{to_sector}-{return_sector}"
    
    ticket_info = f"#{booking_entry.ticket_number}" if booking_entry.ticket_number else ""
    pnr_info = f"PNR: {booking_entry.pnr}" if booking_entry.pnr else ""
    travel_date = booking_entry.travel_date.strftime("%d-%m-%Y") if booking_entry.travel_date else "N/A"
    
    description = f"{passenger_name}: {sector_info} {booking_entry.trip_type} {ticket_info} {pnr_info} ({travel_date})"
    return description.strip()

def get_flight_booking_online_description(booking_entry):
    """Generate detailed description for Flight Online bookings"""
    passenger_name = booking_entry.passenger_name or "N/A"
    from_sector = frappe.get_value("Sector Master", booking_entry.from_sector, "sector_code") if booking_entry.from_sector else "N/A"
    to_sector = frappe.get_value("Sector Master", booking_entry.to_sector, "sector_code") if booking_entry.to_sector else "N/A"
    
    # For return trips, include return sector
    sector_info = f"{from_sector}-{to_sector}"
    if booking_entry.trip_type == "Return" and booking_entry.return_sector:
        return_sector = frappe.get_value("Sector Master", booking_entry.return_sector, "sector_code") or "N/A"
        sector_info = f"{from_sector}-{to_sector}-{return_sector}"
    
    ticket_info = f"#{booking_entry.ticket_number}" if booking_entry.ticket_number else ""
    pnr_info = f"PNR: {booking_entry.pnr}" if booking_entry.pnr else ""
    travel_date = booking_entry.travel_date.strftime("%d-%m-%Y") if booking_entry.travel_date else "N/A"
    
    description = f"{passenger_name}: {sector_info} {booking_entry.trip_type} {ticket_info} {pnr_info} ({travel_date})"
    return description.strip()

def get_hotel_booking_description(booking_entry):
    """Generate detailed description for Hotel bookings"""
    passenger_name = booking_entry.passenger_name or "N/A"
    hotel_name = booking_entry.hotel_name or "N/A"
    
    check_in = booking_entry.check_in.strftime("%d-%m-%Y") if booking_entry.check_in else "N/A"
    check_out = booking_entry.check_out.strftime("%d-%m-%Y") if booking_entry.check_out else "N/A"
    
    booking_ref = f"Ref: {booking_entry.booking_reference_number}" if booking_entry.booking_reference_number else ""
    
    description = f"{passenger_name}: {hotel_name} stay from {check_in} to {check_out} {booking_ref}"
    return description.strip()

def get_car_rental_description(booking_entry):
    """Generate detailed description for Car Rental bookings"""
    passenger_name = booking_entry.passenger_name or "N/A"
    car_type = booking_entry.car_type or "Vehicle"
    
    pickup_date = booking_entry.pickup_date.strftime("%d-%m-%Y") if booking_entry.pickup_date else "N/A"
    return_date = booking_entry.return_date.strftime("%d-%m-%Y") if booking_entry.return_date else "N/A"
    
    pickup = booking_entry.pickup_location or "N/A"
    drop = booking_entry.drop_location or "N/A"
    
    booking_ref = f"Ref: {booking_entry.booking_reference_number}" if booking_entry.booking_reference_number else ""
    
    description = f"{passenger_name}: {car_type} rental from {pickup} to {drop} ({pickup_date} to {return_date}) {booking_ref}"
    return description.strip()

def get_visa_description(booking_entry):
    """Generate detailed description for Visa bookings"""
    passenger_name = booking_entry.passenger_name or "N/A"
    visa_type = booking_entry.visa_type or "Visa"
    country = frappe.get_value("Country", booking_entry.country, "country_name") if booking_entry.country else "N/A"
    
    visa_number = f"#{booking_entry.visa_number}" if booking_entry.visa_number else ""
    valid_from = booking_entry.valid_from.strftime("%d-%m-%Y") if booking_entry.valid_from else "N/A"
    valid_until = booking_entry.valid_until.strftime("%d-%m-%Y") if booking_entry.valid_until else "N/A"
    
    description = f"{passenger_name}: {country} {visa_type} {visa_number} (Valid: {valid_from} to {valid_until})"
    return description.strip()

def get_insurance_description(booking_entry):
    """Generate detailed description for Insurance bookings"""
    passenger_name = booking_entry.passenger_name or "N/A"
    insurance_type = booking_entry.insurance_type or "Insurance"
    
    policy_number = f"Policy: {booking_entry.policy_number}" if booking_entry.policy_number else ""
    valid_from = booking_entry.valid_from.strftime("%d-%m-%Y") if booking_entry.valid_from else "N/A"
    valid_to = booking_entry.valid_to.strftime("%d-%m-%Y") if booking_entry.valid_to else "N/A"
    
    description = f"{passenger_name}: {insurance_type} Insurance {policy_number} (Valid: {valid_from} to {valid_to})"
    return description.strip()

def get_service_description(doctype, docname):
    """Main function to get description for any service type"""
    if not doctype or not docname:
        return ""
    
    booking_entry = frappe.get_doc(doctype, docname)
    
    if doctype == "Flight Booking Entry GDS":
        return get_flight_booking_gds_description(booking_entry)
    elif doctype == "Flight Booking Entry Online":
        return get_flight_booking_online_description(booking_entry)
    elif doctype == "Hotel Booking Entry":
        return get_hotel_booking_description(booking_entry)
    elif doctype == "Car Rental Booking Entry":
        return get_car_rental_description(booking_entry)
    elif doctype == "Visa Booking Entry":
        return get_visa_description(booking_entry)
    elif doctype == "Insurance Booking Entry":
        return get_insurance_description(booking_entry)
    
    return f"{doctype}: {docname}"
