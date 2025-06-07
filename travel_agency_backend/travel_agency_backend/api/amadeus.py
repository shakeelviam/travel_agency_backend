# -*- coding: utf-8 -*-
# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
import requests
from frappe import _
from frappe.utils import nowdate
from travel_agency_backend.travel_agency_backend.integrations.amadeus.client import AmadeusClient

@frappe.whitelist()
def search_flights(origin, destination, departure_date, return_date=None, adults=1, children=0, infants=0, travel_class="ECONOMY"):
    """
    Search for flights using Amadeus API
    
    Args:
        origin (str): Origin city/airport code
        destination (str): Destination city/airport code
        departure_date (str): Departure date in YYYY-MM-DD format
        return_date (str, optional): Return date for round trips
        adults (int, optional): Number of adult passengers
        children (int, optional): Number of child passengers
        infants (int, optional): Number of infant passengers
        travel_class (str, optional): Travel class (ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST)
    
    Returns:
        dict: Flight search results
    """
    try:
        # Convert string parameters to appropriate types
        adults = int(adults)
        children = int(children) if children else 0
        infants = int(infants) if infants else 0
        
        # Initialize Amadeus client
        client = AmadeusClient()
        
        # Search flights
        results = client.search_flights(
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            return_date=return_date,
            adults=adults,
            children=children,
            infants=infants,
            travel_class=travel_class
        )
        
        return results
    except Exception as e:
        frappe.log_error(f"Amadeus Flight Search Error: {str(e)}", "Amadeus API")
        return {"error": str(e)}

@frappe.whitelist()
def get_flight_price(flight_offer):
    """
    Get price for a specific flight offer
    
    Args:
        flight_offer (dict): Flight offer object from search results
        
    Returns:
        dict: Flight price details
    """
    try:
        # Initialize Amadeus client
        client = AmadeusClient()
        
        # Get flight price
        if isinstance(flight_offer, str):
            flight_offer = frappe.parse_json(flight_offer)
            
        results = client.get_flight_price(flight_offer)
        
        return results
    except Exception as e:
        frappe.log_error(f"Amadeus Flight Price Error: {str(e)}", "Amadeus API")
        return {"error": str(e)}

@frappe.whitelist()
def search_airports(keyword):
    """
    Search for airports by keyword
    
    Args:
        keyword (str): Search keyword (city name, airport name, etc.)
        
    Returns:
        dict: List of matching airports
    """
    try:
        # Initialize Amadeus client
        client = AmadeusClient()
        
        # Search airports
        results = client.search_airports(keyword)
        
        return results
    except Exception as e:
        frappe.log_error(f"Amadeus Airport Search Error: {str(e)}", "Amadeus API")
        return {"error": str(e)}

@frappe.whitelist()
def test_amadeus_connection():
    """
    Test connection to Amadeus API
    
    Returns:
        dict: Connection status
    """
    try:
        # Get API credentials from settings
        api_key = frappe.db.get_single_value("Amadeus Settings", "api_key")
        api_secret = frappe.db.get_single_value("Amadeus Settings", "api_secret")
        
        # Validate credentials
        if not api_key or not api_secret:
            return {
                "success": False,
                "message": _("API credentials are missing. Please enter both API Key and API Secret.")
            }
            
        # Initialize Amadeus client
        client = AmadeusClient(api_key=api_key, api_secret=api_secret)
        
        # Print debug info
        debug_info = f"Testing connection with API Key: {api_key[:5]}...{api_key[-4:] if len(api_key) > 9 else ''}"
        frappe.msgprint(debug_info)
        
        # Authenticate
        token = client.authenticate()
        
        if token:
            # Update last sync timestamp
            settings = frappe.get_doc("Amadeus Settings")
            settings.last_sync_on = frappe.utils.now()
            settings.save()
            
            return {
                "success": True,
                "message": _("Successfully connected to Amadeus API")
            }
        else:
            return {
                "success": False,
                "message": _("Failed to authenticate with Amadeus API. No token received.")
            }
    except requests.exceptions.HTTPError as e:
        error_msg = f"HTTP Error: {e}"
        if hasattr(e, 'response'):
            error_msg += f"\nStatus code: {e.response.status_code}"
            try:
                error_data = e.response.json()
                if 'error_description' in error_data:
                    error_msg += f"\nError details: {error_data['error_description']}"
                elif 'errors' in error_data and len(error_data['errors']) > 0:
                    error_msg += f"\nError details: {error_data['errors'][0].get('detail', 'Unknown error')}"
            except:
                error_msg += f"\nResponse text: {e.response.text[:200]}"
        
        frappe.log_error(error_msg, "Amadeus API Connection Test")
        return {
            "success": False,
            "message": error_msg
        }
    except requests.exceptions.RequestException as e:
        error_msg = f"Request Error: {str(e)}"
        frappe.log_error(error_msg, "Amadeus API Connection Test")
        return {
            "success": False,
            "message": error_msg
        }
    except Exception as e:
        error_msg = f"Unexpected Error: {str(e)}"
        frappe.log_error(error_msg, "Amadeus API Connection Test")
        return {
            "success": False,
            "message": error_msg
        }
