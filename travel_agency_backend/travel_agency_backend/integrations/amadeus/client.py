# -*- coding: utf-8 -*-
# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
import requests
import json
from datetime import datetime
from frappe import _

class AmadeusClient:
    """
    Client for Amadeus API integration
    
    This class handles authentication and API calls to the Amadeus API
    for flight search, booking, and other travel-related operations.
    """
    
    def __init__(self, api_key=None, api_secret=None):
        """
        Initialize the Amadeus client with API credentials
        
        If api_key and api_secret are not provided, they will be fetched from
        Frappe DocType settings.
        """
        self.base_url = "https://test.api.amadeus.com" # Using test environment
        self.token = None
        self.token_expiry = None
        
        # Get API credentials from settings if not provided
        if not api_key or not api_secret:
            self.api_key = frappe.db.get_single_value("Amadeus Settings", "api_key")
            self.api_secret = frappe.db.get_single_value("Amadeus Settings", "api_secret")
        else:
            self.api_key = api_key
            self.api_secret = api_secret
            
        if not self.api_key or not self.api_secret:
            frappe.throw(_("Amadeus API credentials not configured. Please set them in Amadeus Settings."))
    
    def authenticate(self):
        """
        Authenticate with Amadeus API and get access token
        """
        url = f"{self.base_url}/v1/security/oauth2/token"
        headers = {
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {
            "grant_type": "client_credentials",
            "client_id": self.api_key,
            "client_secret": self.api_secret
        }
        
        try:
            response = requests.post(url, headers=headers, data=data)
            response.raise_for_status()
            
            result = response.json()
            self.token = result.get("access_token")
            self.token_expiry = datetime.now().timestamp() + result.get("expires_in", 1800)
            
            return self.token
        except requests.exceptions.RequestException as e:
            frappe.log_error(f"Amadeus Authentication Error: {str(e)}", "Amadeus API")
            frappe.throw(_("Failed to authenticate with Amadeus API. Please check your credentials."))
    
    def get_headers(self):
        """
        Get headers for API requests with authentication
        """
        # Check if token is expired or not set
        if not self.token or datetime.now().timestamp() >= self.token_expiry:
            self.authenticate()
            
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def search_flights(self, origin, destination, departure_date, return_date=None, adults=1, children=0, infants=0, travel_class="ECONOMY"):
        """
        Search for flights using Amadeus Flight Offers Search API
        
        Args:
            origin (str): Origin city/airport code (e.g., 'LHR')
            destination (str): Destination city/airport code (e.g., 'JFK')
            departure_date (str): Departure date in YYYY-MM-DD format
            return_date (str, optional): Return date in YYYY-MM-DD format for round trips
            adults (int, optional): Number of adult passengers
            children (int, optional): Number of child passengers
            infants (int, optional): Number of infant passengers
            travel_class (str, optional): Travel class (ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST)
            
        Returns:
            dict: Flight search results
        """
        url = f"{self.base_url}/v2/shopping/flight-offers"
        
        # Build request payload
        payload = {
            "currencyCode": "USD",
            "originDestinations": [
                {
                    "id": "1",
                    "originLocationCode": origin,
                    "destinationLocationCode": destination,
                    "departureDateTimeRange": {
                        "date": departure_date
                    }
                }
            ],
            "travelers": [],
            "sources": ["GDS"],
            "searchCriteria": {
                "maxFlightOffers": 20,
                "flightFilters": {
                    "cabinRestrictions": [
                        {
                            "cabin": travel_class,
                            "coverage": "MOST_SEGMENTS",
                            "originDestinationIds": ["1"]
                        }
                    ]
                }
            }
        }
        
        # Add return flight if return_date is provided
        if return_date:
            payload["originDestinations"].append({
                "id": "2",
                "originLocationCode": destination,
                "destinationLocationCode": origin,
                "departureDateTimeRange": {
                    "date": return_date
                }
            })
            payload["searchCriteria"]["flightFilters"]["cabinRestrictions"][0]["originDestinationIds"].append("2")
        
        # Add travelers
        for i in range(adults):
            payload["travelers"].append({
                "id": str(i + 1),
                "travelerType": "ADULT"
            })
            
        for i in range(children):
            payload["travelers"].append({
                "id": str(adults + i + 1),
                "travelerType": "CHILD"
            })
            
        for i in range(infants):
            payload["travelers"].append({
                "id": str(adults + children + i + 1),
                "travelerType": "INFANT"
            })
        
        try:
            headers = self.get_headers()
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            return response.json()
        except requests.exceptions.RequestException as e:
            frappe.log_error(f"Amadeus Flight Search Error: {str(e)}", "Amadeus API")
            frappe.throw(_("Failed to search flights. Please try again later."))
    
    def get_flight_price(self, flight_offer):
        """
        Get price for a specific flight offer
        
        Args:
            flight_offer (dict): Flight offer object from search results
            
        Returns:
            dict: Flight price details
        """
        url = f"{self.base_url}/v1/shopping/flight-offers/pricing"
        
        payload = {
            "data": {
                "type": "flight-offers-pricing",
                "flightOffers": [flight_offer]
            }
        }
        
        try:
            headers = self.get_headers()
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            return response.json()
        except requests.exceptions.RequestException as e:
            frappe.log_error(f"Amadeus Flight Price Error: {str(e)}", "Amadeus API")
            frappe.throw(_("Failed to get flight price. Please try again later."))
    
    def get_airport_info(self, airport_code):
        """
        Get information about an airport
        
        Args:
            airport_code (str): IATA airport code (e.g., 'LHR')
            
        Returns:
            dict: Airport information
        """
        url = f"{self.base_url}/v1/reference-data/locations/{airport_code}"
        params = {
            "subType": "AIRPORT"
        }
        
        try:
            headers = self.get_headers()
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            return response.json()
        except requests.exceptions.RequestException as e:
            frappe.log_error(f"Amadeus Airport Info Error: {str(e)}", "Amadeus API")
            frappe.throw(_("Failed to get airport information. Please try again later."))
    
    def search_airports(self, keyword):
        """
        Search for airports by keyword
        
        Args:
            keyword (str): Search keyword (city name, airport name, etc.)
            
        Returns:
            dict: List of matching airports
        """
        url = f"{self.base_url}/v1/reference-data/locations"
        params = {
            "subType": "AIRPORT,CITY",
            "keyword": keyword,
            "page[limit]": 10
        }
        
        try:
            headers = self.get_headers()
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            return response.json()
        except requests.exceptions.RequestException as e:
            frappe.log_error(f"Amadeus Airport Search Error: {str(e)}", "Amadeus API")
            frappe.throw(_("Failed to search airports. Please try again later."))
