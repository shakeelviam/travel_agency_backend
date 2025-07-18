# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
from frappe import _
import json

def migrate_multicity_bookings():
    """
    Migrate data from legacy multi-city DocTypes to the new unified structure.
    This should be run after the schema changes have been deployed.
    """
    frappe.logger().info("Starting migration of multi-city bookings to unified structure")
    
    # Migrate GDS multi-city bookings
    migrate_gds_multicity()
    
    # Migrate Online multi-city bookings
    migrate_online_multicity()
    
    frappe.logger().info("Migration of multi-city bookings completed")
    return {"status": "success", "message": "Migration completed successfully"}

def migrate_gds_multicity():
    """Migrate GDS multi-city bookings to the unified Flight Booking Entry GDS DocType"""
    # Get all Trip Bookings with GDS Multicity entries
    trip_bookings = frappe.get_all(
        "Trip Booking",
        filters={"docstatus": ["<", 2]},  # Include draft and submitted
        fields=["name"]
    )
    
    count = 0
    for tb in trip_bookings:
        # Check if this Trip Booking has GDS Multicity entries
        multicity_entries = frappe.get_all(
            "Flight Booking Entry GDS Multicity",
            filters={"parent": tb.name},
            fields=["*"]
        )
        
        if not multicity_entries:
            continue
            
        for entry in multicity_entries:
            # Create a new Flight Booking Entry GDS with trip_type = "Multi City"
            new_entry = frappe.new_doc("Flight Booking Entry GDS")
            
            # Copy common fields
            fields_to_copy = [
                "passenger", "supplier", "supplier_cost", "markup", 
                "service_fee", "total_amount", "ticket_number", "pnr"
            ]
            
            for field in fields_to_copy:
                if field in entry:
                    new_entry.set(field, entry.get(field))
            
            # Set trip type to Multi City
            new_entry.trip_type = "Multi City"
            new_entry.parent = tb.name
            new_entry.parentfield = "flight_booking_entry_gds"
            new_entry.parenttype = "Trip Booking"
            
            # Get sectors from the multicity entry
            sectors = frappe.get_all(
                "Flight Booking Entry GDS Multicity Sector",
                filters={"parent": entry.name},
                fields=["*"],
                order_by="idx"
            )
            
            # Add sectors to the new entry
            for idx, sector in enumerate(sectors):
                new_sector = new_entry.append("sectors", {})
                new_sector.segment_number = idx + 1
                new_sector.airline = sector.get("airline")
                new_sector.flight_number = sector.get("flight_number")
                new_sector.from_sector = sector.get("from_sector")
                new_sector.to_sector = sector.get("to_sector")
                new_sector.departure_date = sector.get("departure_date")
                new_sector.arrival_date = sector.get("arrival_date")
                new_sector.booking_class = sector.get("booking_class")
                new_sector.pnr = sector.get("pnr") or entry.get("pnr")
                new_sector.ticket_number = sector.get("ticket_number") or entry.get("ticket_number")
            
            # Save the new entry
            try:
                new_entry.insert()
                count += 1
                
                # Mark the old entry as migrated
                frappe.db.set_value("Flight Booking Entry GDS Multicity", entry.name, "migrated", 1)
                frappe.db.set_value("Flight Booking Entry GDS Multicity", entry.name, "migrated_to", new_entry.name)
                
            except Exception as e:
                frappe.logger().error(f"Error migrating GDS multicity entry {entry.name}: {str(e)}")
    
    frappe.logger().info(f"Migrated {count} GDS multi-city bookings")

def migrate_online_multicity():
    """Migrate Online multi-city bookings to the unified Flight Booking Entry Online DocType"""
    # Get all Trip Bookings with Online Multicity entries
    trip_bookings = frappe.get_all(
        "Trip Booking",
        filters={"docstatus": ["<", 2]},  # Include draft and submitted
        fields=["name"]
    )
    
    count = 0
    for tb in trip_bookings:
        # Check if this Trip Booking has Online Multicity entries
        multicity_entries = frappe.get_all(
            "Flight Booking Entry Online Multicity",
            filters={"parent": tb.name},
            fields=["*"]
        )
        
        if not multicity_entries:
            continue
            
        for entry in multicity_entries:
            # Create a new Flight Booking Entry Online with trip_type = "Multi City"
            new_entry = frappe.new_doc("Flight Booking Entry Online")
            
            # Copy common fields
            fields_to_copy = [
                "passenger", "supplier", "supplier_cost", "markup", 
                "service_fee", "total_amount", "ticket_number", "pnr"
            ]
            
            for field in fields_to_copy:
                if field in entry:
                    new_entry.set(field, entry.get(field))
            
            # Set trip type to Multi City
            new_entry.trip_type = "Multi City"
            new_entry.parent = tb.name
            new_entry.parentfield = "flight_booking_entry_online"
            new_entry.parenttype = "Trip Booking"
            
            # Get sectors from the multicity entry
            sectors = frappe.get_all(
                "Flight Booking Entry Online Multicity Sector",
                filters={"parent": entry.name},
                fields=["*"],
                order_by="idx"
            )
            
            # Add sectors to the new entry
            for idx, sector in enumerate(sectors):
                new_sector = new_entry.append("sectors", {})
                new_sector.segment_number = idx + 1
                new_sector.airline = sector.get("airline")
                new_sector.flight_number = sector.get("flight_number")
                new_sector.from_sector = sector.get("from_sector")
                new_sector.to_sector = sector.get("to_sector")
                new_sector.departure_date = sector.get("departure_date")
                new_sector.arrival_date = sector.get("arrival_date")
                new_sector.booking_class = sector.get("booking_class")
                new_sector.pnr = sector.get("pnr") or entry.get("pnr")
                new_sector.ticket_number = sector.get("ticket_number") or entry.get("ticket_number")
            
            # Save the new entry
            try:
                new_entry.insert()
                count += 1
                
                # Mark the old entry as migrated
                frappe.db.set_value("Flight Booking Entry Online Multicity", entry.name, "migrated", 1)
                frappe.db.set_value("Flight Booking Entry Online Multicity", entry.name, "migrated_to", new_entry.name)
                
            except Exception as e:
                frappe.logger().error(f"Error migrating Online multicity entry {entry.name}: {str(e)}")
    
    frappe.logger().info(f"Migrated {count} Online multi-city bookings")
