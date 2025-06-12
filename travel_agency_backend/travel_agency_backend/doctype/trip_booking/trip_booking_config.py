# Copyright (c) 2023, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from frappe import _

class TripBookingConfig:
    """Centralized configuration for Trip Booking services"""
    
    SERVICES = {
        "Flight GDS": {
            "section": "flight_gds_section",
            "table": "flight_booking_entry_gds", 
            "supplier_field": "flight_gds_supplier",
            "child_doctype": "Flight Booking Entry GDS",
            "cost_fields": ["supplier_cost"],
            "markup_field": "markup",
            "commission_field": None
        },
        "Flight Online Airlines": {
            "section": "flight_online_section",
            "table": "flight_booking_entry_online",
            "supplier_field": "flight_online_supplier", 
            "child_doctype": "Flight Booking Entry Online",
            "cost_fields": ["supplier_cost"],
            "markup_field": "markup",
            "commission_field": None
        },
        "Hotel Booking": {
            "section": "hotel_section",
            "table": "hotel_booking_entry",
            "supplier_field": "hotel_supplier",
            "child_doctype": "Hotel Booking Entry", 
            "cost_fields": ["supplier_cost"],
            "markup_field": "markup",
            "commission_field": "commission"
        },
        "Visa Application Charges": {
            "section": "visa_section",
            "table": "visa_booking_entry",
            "supplier_field": "visa_supplier",
            "child_doctype": "Visa Booking Entry",
            "cost_fields": ["supplier_cost"],
            "markup_field": "markup",
            "commission_field": "commission"
        },
        "Car Rental Service": {
            "section": "car_rental_section",
            "table": "car_rental_booking_entry",
            "supplier_field": "car_rental_supplier",
            "child_doctype": "Car Rental Booking Entry",
            "cost_fields": ["supplier_cost"],
            "markup_field": "markup",
            "commission_field": "commission"  
        },
        "Insurance Service": {
            "section": "insurance_section",
            "table": "insurance_booking_entry", 
            "supplier_field": "insurance_supplier",
            "child_doctype": "Insurance Booking Entry",
            "cost_fields": ["supplier_cost"],
            "markup_field": "markup",
            "commission_field": "commission"
        }
    }
    
    @classmethod
    def get_service_config(cls, service_type):
        """Get configuration for a specific service type"""
        return cls.SERVICES.get(service_type, {})
    
    @classmethod  
    def get_all_tables(cls):
        """Get all child table fieldnames"""
        return [config["table"] for config in cls.SERVICES.values()]
        
    @classmethod
    def get_table_fieldname(cls, service_category):
        """Get child table fieldname for a service category"""
        config = cls.get_service_config(service_category)
        return config.get("table")
        
    @classmethod
    def get_supplier_field(cls, service_category):
        """Get supplier field for a service category"""
        config = cls.get_service_config(service_category)
        return config.get("supplier_field")
        
    @classmethod
    def get_service_categories(cls):
        """Get all service categories"""
        return list(cls.SERVICES.keys())
        
    @classmethod
    def map_service_type_to_selected_service(cls, service_type):
        """Map a Service Type to a valid selected_services value"""
        # Direct match
        if service_type in cls.SERVICES:
            return service_type
            
        # Try to match substrings
        for option in cls.SERVICES.keys():
            if service_type in option or option in service_type:
                return option
                
        # Default to input if no match found
        return service_type
        
    @classmethod
    def map_selected_service_to_service_type(cls, selected_service):
        """Map a selected_services value to a valid Service Type"""
        # Direct match
        if selected_service in cls.SERVICES:
            return selected_service
            
        # Try to match substrings
        for option in cls.SERVICES.keys():
            if selected_service in option or option in selected_service:
                return option
                
        # Default to input if no match found
        return selected_service