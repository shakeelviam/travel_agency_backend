#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Amadeus API Proxy
----------------
Direct Amadeus API proxy script that bypasses Frappe's encryption system.
This is a temporary workaround for the "Encryption key is in invalid format" error.

Usage:
    bench execute -p "travel_agency_backend.travel_agency_backend.api.amadeus_proxy.proxy_request" --args "['v1/reference-data/locations', {'keyword': 'LON', 'subType': 'CITY'}]"
"""

import frappe
import requests
import json
import time
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Working credentials - temporary workaround
# Replace these with your actual working credentials if different
API_KEY = "GieAZZPHFJPkzhhMBuSejkTLXPAHVSlF"
API_SECRET = "sGdcWGk7T2o3t3tG"
TEST_MODE = True  # Set to False for production

@frappe.whitelist()
def get_token():
    """Get OAuth2 token from Amadeus API directly without using settings"""
    base_url = "https://test.api.amadeus.com" if TEST_MODE else "https://api.amadeus.com"
    auth_url = f"{base_url}/v1/security/oauth2/token"
    
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": API_KEY,
        "client_secret": API_SECRET
    }
    
    start_time = time.time()
    
    try:
        response = requests.post(auth_url, headers=headers, data=data, timeout=10)
        elapsed = time.time() - start_time
        
        logger.info(f"Authentication request completed in {elapsed:.2f} seconds with status {response.status_code}")
        
        if response.status_code == 200:
            token_data = response.json()
            return {
                "success": True, 
                "access_token": token_data["access_token"],
                "expires_in": token_data["expires_in"]
            }
        else:
            logger.error(f"Authentication failed: {response.text}")
            return {
                "success": False,
                "error": response.text,
                "status_code": response.status_code
            }
    except Exception as e:
        logger.exception("Exception during authentication")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def proxy_request(endpoint, params=None):
    """
    Make a direct API request to Amadeus
    
    :param endpoint: API endpoint path (e.g., "v1/reference-data/locations")
    :param params: Dictionary of query parameters
    :return: API response as JSON
    """
    token_response = get_token()
    if not token_response.get("success"):
        return {
            "success": False,
            "error": "Failed to get authentication token",
            "details": token_response
        }
    
    token = token_response["access_token"]
    base_url = "https://test.api.amadeus.com" if TEST_MODE else "https://api.amadeus.com"
    url = f"{base_url}/{endpoint}"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    start_time = time.time()
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=30)
        elapsed = time.time() - start_time
        
        logger.info(f"API request to {endpoint} completed in {elapsed:.2f} seconds with status {response.status_code}")
        
        response_data = response.json()
        return {
            "success": 200 <= response.status_code < 300,
            "status_code": response.status_code,
            "data": response_data,
            "elapsed_time": elapsed
        }
    except Exception as e:
        logger.exception(f"Exception during API request to {endpoint}")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def search_airports(query):
    """
    Search for airports by keyword
    
    :param query: Search query string
    :return: List of airport results
    """
    response = proxy_request("v1/reference-data/locations", {
        "keyword": query,
        "subType": "AIRPORT"
    })
    
    if not response.get("success"):
        return response
    
    try:
        airports = response["data"].get("data", [])
        return {
            "success": True,
            "airports": airports
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def search_flights(origin, destination, departure_date, return_date=None, adults=1):
    """
    Search for flights
    
    :param origin: Origin airport/city code
    :param destination: Destination airport/city code
    :param departure_date: Departure date (YYYY-MM-DD)
    :param return_date: Return date for round trips (YYYY-MM-DD)
    :param adults: Number of adult passengers
    :return: Flight search results
    """
    params = {
        "originLocationCode": origin,
        "destinationLocationCode": destination,
        "departureDate": departure_date,
        "adults": adults
    }
    
    if return_date:
        params["returnDate"] = return_date
    
    response = proxy_request("v2/shopping/flight-offers", params)
    
    if not response.get("success"):
        return response
    
    try:
        flight_offers = response["data"].get("data", [])
        return {
            "success": True,
            "count": len(flight_offers),
            "flight_offers": flight_offers,
            "dictionaries": response["data"].get("dictionaries", {})
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def search_cities(query):
    """
    Search for cities by keyword
    
    :param query: Search query string
    :return: List of city results
    """
    response = proxy_request("v1/reference-data/locations", {
        "keyword": query,
        "subType": "CITY"
    })
    
    if not response.get("success"):
        return response
    
    try:
        cities = response["data"].get("data", [])
        return {
            "success": True,
            "cities": cities
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def find_nearest_airports(latitude, longitude, radius=100):
    """
    Find airports nearest to a specific location
    
    :param latitude: Latitude coordinate
    :param longitude: Longitude coordinate
    :param radius: Search radius in kilometers
    :return: List of nearby airports
    """
    response = proxy_request("v1/reference-data/locations/airports", {
        "latitude": latitude,
        "longitude": longitude,
        "radius": radius
    })
    
    if not response.get("success"):
        return response
    
    try:
        airports = response["data"].get("data", [])
        return {
            "success": True,
            "airports": airports
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def search_flight_inspiration(origin, destination=None, departure_date=None):
    """
    Search for flight inspiration - destinations, prices and dates
    
    :param origin: Origin city code
    :param destination: Optional destination city code
    :param departure_date: Optional departure date (YYYY-MM)
    :return: Flight inspiration results
    """
    params = {
        "origin": origin
    }
    
    if destination:
        params["destination"] = destination
        
    if departure_date:
        params["departureDate"] = departure_date
    
    response = proxy_request("v1/shopping/flight-destinations", params)
    
    if not response.get("success"):
        return response
    
    try:
        results = response["data"].get("data", [])
        return {
            "success": True,
            "results": results
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def search_cheapest_flights(origin, destination, departure_date=None):
    """
    Search for the cheapest flights
    
    :param origin: Origin city code
    :param destination: Destination city code
    :param departure_date: Optional departure date (YYYY-MM)
    :return: Cheapest date flight options
    """
    params = {
        "origin": origin,
        "destination": destination
    }
    
    if departure_date:
        params["departureDate"] = departure_date
    
    response = proxy_request("v1/shopping/flight-dates", params)
    
    if not response.get("success"):
        return response
    
    try:
        results = response["data"].get("data", [])
        return {
            "success": True,
            "results": results
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def search_hotels(cityCode, checkInDate, checkOutDate, adults=1):
    """
    Search for hotels in a city
    
    :param cityCode: City code
    :param checkInDate: Check-in date (YYYY-MM-DD)
    :param checkOutDate: Check-out date (YYYY-MM-DD)
    :param adults: Number of adult guests
    :return: Hotel offers
    """
    response = proxy_request("v2/shopping/hotel-offers", {
        "cityCode": cityCode,
        "checkInDate": checkInDate,
        "checkOutDate": checkOutDate,
        "adults": adults
    })
    
    if not response.get("success"):
        return response
    
    try:
        hotels = response["data"].get("data", [])
        return {
            "success": True,
            "hotels": hotels
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    # This allows running the module directly for testing
    import sys

@frappe.whitelist()
def simulate_flight_booking(flight_data):
    """
    Simulate a flight booking using the Amadeus Flight Create Orders API
    
    :param flight_data: Flight data from search results, with passenger info
    :return: Booking confirmation details
    """
    try:
        if isinstance(flight_data, str):
            flight_data = json.loads(flight_data)
            
        # Log the incoming request
        logger.info(f"Simulating flight booking with data: {json.dumps(flight_data)}")
        
        # In a real implementation, we would call the Amadeus Flight Create Orders API
        # For demo purposes, we'll simulate a successful booking response
        
        # Get a fresh token
        token_response = get_token()
        if not token_response.get("access_token"):
            return {"error": "Failed to get access token", "details": token_response}
            
        # Create a simulated booking confirmation
        confirmation = {
            "success": True,
            "booking_id": f"AMX-{int(time.time())}",
            "status": "CONFIRMED",
            "passenger_name": flight_data.get("passenger_name", "Demo Passenger"),
            "flight_details": flight_data.get("flight", {}),
            "payment": {
                "amount": flight_data.get("flight", {}).get("price", {}).get("total", "0"),
                "currency": flight_data.get("flight", {}).get("price", {}).get("currency", "EUR"),
                "status": "APPROVED",
                "transaction_id": f"TXN{int(time.time())}"
            },
            "confirmation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "booking_expiry": None,  # No expiry for confirmed bookings
            "itinerary_id": f"ITN{int(time.time())}-{flight_data.get('flight', {}).get('id', '0')}"
        }
        
        # Log the response
        logger.info(f"Booking simulation complete: {json.dumps(confirmation)}")
        
        return confirmation
        
    except Exception as e:
        logger.error(f"Error in simulate_flight_booking: {str(e)}")
        return {"error": str(e)}

@frappe.whitelist()
def simulate_hotel_booking(hotel_data):
    """
    Simulate a hotel booking using the Amadeus Hotel Booking API
    
    :param hotel_data: Hotel data from search results, with guest info
    :return: Hotel booking confirmation details
    """
    try:
        if isinstance(hotel_data, str):
            hotel_data = json.loads(hotel_data)
            
        # Log the incoming request
        logger.info(f"Simulating hotel booking with data: {json.dumps(hotel_data)}")
        
        # In a real implementation, we would call the Amadeus Hotel Booking API
        # For demo purposes, we'll simulate a successful booking response
        
        # Get a fresh token
        token_response = get_token()
        if not token_response.get("access_token"):
            return {"error": "Failed to get access token", "details": token_response}
            
        # Create a simulated booking confirmation
        confirmation = {
            "success": True,
            "booking_id": f"HTL-{int(time.time())}",
            "status": "CONFIRMED",
            "guest_name": hotel_data.get("guest_name", "Demo Guest"),
            "hotel_details": hotel_data.get("hotel", {}),
            "stay": {
                "check_in": hotel_data.get("check_in"),
                "check_out": hotel_data.get("check_out"),
                "rooms": hotel_data.get("rooms", 1),
                "guests": hotel_data.get("guests", 1)
            },
            "payment": {
                "amount": hotel_data.get("price", "0"),
                "currency": hotel_data.get("currency", "EUR"),
                "status": "APPROVED",
                "transaction_id": f"TXN{int(time.time())}"
            },
            "confirmation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "special_requests": hotel_data.get("special_requests", "None"),
            "reservation_id": f"RSV{int(time.time())}"
        }
        
        # Log the response
        logger.info(f"Hotel booking simulation complete: {json.dumps(confirmation)}")
        
        return confirmation
        
    except Exception as e:
        logger.error(f"Error in simulate_hotel_booking: {str(e)}")
        return {"error": str(e)}
    
    if len(sys.argv) < 2:
        print("Usage examples:")
        print("python amadeus_proxy.py get_token")
        print("python amadeus_proxy.py search_airports 'London'")
        print("python amadeus_proxy.py search_flights 'JFK' 'LHR' '2025-08-15'")
        print("python amadeus_proxy.py search_cities 'Paris'")
        print("python amadeus_proxy.py find_nearest_airports 48.8566 2.3522 50")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "get_token":
        result = get_token()
        print(json.dumps(result, indent=2))
    
    elif command == "search_airports":
        if len(sys.argv) < 3:
            print("Missing search query")
            sys.exit(1)
        query = sys.argv[2]
        result = search_airports(query)
        print(json.dumps(result, indent=2))
    
    elif command == "search_flights":
        if len(sys.argv) < 5:
            print("Usage: python amadeus_proxy.py search_flights <origin> <destination> <departure_date> [<return_date>] [<adults>]")
            sys.exit(1)
        
        origin = sys.argv[2]
        destination = sys.argv[3]
        departure_date = sys.argv[4]
        return_date = sys.argv[5] if len(sys.argv) > 5 else None
        adults = int(sys.argv[6]) if len(sys.argv) > 6 else 1
        
        result = search_flights(origin, destination, departure_date, return_date, adults)
        print(json.dumps(result, indent=2))
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)
