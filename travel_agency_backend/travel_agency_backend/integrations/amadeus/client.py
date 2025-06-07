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
        # Using test environment - exact URL as specified in Amadeus developer portal
        self.base_url = "https://test.api.amadeus.com"
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
        Authenticate with Amadeus API using OAuth2
        """
        url = f"{self.base_url}/v1/security/oauth2/token"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "client_credentials",
            "client_id": self.api_key,
            "client_secret": self.api_secret
        }
        
        # Short log title to avoid truncation
        frappe.log_error(
            f"Auth attempt with key: {self.api_key[:4]}...{self.api_key[-4:] if len(self.api_key) > 8 else ''}", 
            "Amadeus Auth"
        )
        
        try:
            response = requests.post(url, headers=headers, data=data)
            
            # Short log title to avoid truncation
            if response.status_code != 200:
                frappe.log_error(
                    f"Auth failed: {response.status_code}", 
                    "Amadeus Auth"
                )
            
            response.raise_for_status()
            result = response.json()
            self.token = result.get("access_token")
            self.token_expiry = datetime.now().timestamp() + result.get("expires_in", 1800)
            return self.token
        except requests.exceptions.HTTPError as e:
            # Handle HTTP errors (e.g., 401 Unauthorized)
            error_msg = "Invalid credentials"
            if hasattr(e, 'response') and hasattr(e.response, 'json'):
                try:
                    error_data = e.response.json()
                    if 'error_description' in error_data:
                        error_msg = error_data['error_description']
                except:
                    pass
            
            frappe.log_error(f"Auth error: {error_msg}", "Amadeus Auth")
            frappe.throw(_(f"Authentication failed: {error_msg}. Please check your API key and secret."))
            # Handle other request exceptions (like connection errors)
            frappe.log_error(f"Amadeus Authentication Error: {str(e)}", "Amadeus API")
            frappe.throw(_(f"Failed to connect to Amadeus API: {str(e)}. Please check your network connection."))
        except Exception as e:
            # Handle any other unexpected errors
            frappe.log_error(f"Unexpected error during Amadeus authentication: {str(e)}", "Amadeus API")
            frappe.throw(_(f"An unexpected error occurred: {str(e)}"))
    
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
        # Using the simpler GET endpoint for Flight Offers Search
        url = f"{self.base_url}/v2/shopping/flight-offers"
        
        # Build query parameters according to Amadeus documentation
        params = {
            "originLocationCode": origin,
            "destinationLocationCode": destination,
            "departureDate": departure_date,
            "adults": adults,
            "currencyCode": "USD",
            "max": 20  # Maximum number of offers to return
        }
        
        # Add optional parameters
        if return_date:
            params["returnDate"] = return_date
            
        if children and int(children) > 0:
            params["children"] = children
            
        if infants and int(infants) > 0:
            params["infants"] = infants
            
        if travel_class and travel_class != "ECONOMY":
            params["travelClass"] = travel_class
        
        try:
            headers = self.get_headers()
            
            # Short log title to avoid truncation
            frappe.log_error(
                f"Search: {origin} to {destination}", 
                "Flight Search"
            )
            
            # Make GET request with query parameters
            response = requests.get(url, headers=headers, params=params)
            
            # Short log title for response
            if response.status_code != 200:
                frappe.log_error(
                    f"Search failed: {response.status_code}", 
                    "Flight Search"
                )
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            error_msg = "API error"
            if hasattr(e, 'response'):
                error_msg = f"HTTP {e.response.status_code}"
                try:
                    error_data = e.response.json()
                    if 'errors' in error_data and len(error_data['errors']) > 0:
                        error_msg = error_data['errors'][0].get('detail', 'Unknown error')[:100]
                except:
                    pass
            
            frappe.log_error(f"Search error: {error_msg}", "Flight Search")
            frappe.throw(_(f"Flight search failed: {error_msg}"))
        except requests.exceptions.RequestException as e:
            frappe.log_error(f"Network error: {str(e)[:100]}", "Flight Search")
            frappe.throw(_("Network error. Please check your connection and try again."))
        except Exception as e:
            frappe.log_error(f"Error: {str(e)[:100]}", "Flight Search")
            frappe.throw(_(f"Error: {str(e)[:100]}"))
    
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
            
            # Short log title
            frappe.log_error(
                f"Price check for flight offer", 
                "Price Check"
            )
            
            response = requests.post(url, headers=headers, json=payload)
            
            # Short log title for response
            if response.status_code != 200:
                frappe.log_error(
                    f"Price check failed: {response.status_code}", 
                    "Price Check"
                )
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            error_msg = "API error"
            if hasattr(e, 'response'):
                error_msg = f"HTTP {e.response.status_code}"
                try:
                    error_data = e.response.json()
                    if 'errors' in error_data and len(error_data['errors']) > 0:
                        error_msg = error_data['errors'][0].get('detail', 'Unknown error')[:100]
                except:
                    pass
            
            frappe.log_error(f"Price error: {error_msg}", "Price Check")
            frappe.throw(_(f"Price check failed: {error_msg}"))
        except requests.exceptions.RequestException as e:
            frappe.log_error(f"Network error: {str(e)[:100]}", "Price Check")
            frappe.throw(_("Network error. Please check your connection and try again."))
        except Exception as e:
            frappe.log_error(f"Error: {str(e)[:100]}", "Price Check")
            frappe.throw(_(f"Error: {str(e)[:100]}"))
    
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
