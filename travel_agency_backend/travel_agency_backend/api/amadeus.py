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
        # Use short title and limit error message length
        error_msg = str(e)[:100] if str(e) else "Unknown error"
        frappe.log_error(f"API error: {error_msg}", "Flight API")
        return {"error": error_msg}

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
        # Use short title and limit error message length
        error_msg = str(e)[:100] if str(e) else "Unknown error"
        frappe.log_error(f"Price error: {error_msg}", "Flight API")
        return {"error": error_msg}

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
        # Use short title and limit error message length
        error_msg = str(e)[:100] if str(e) else "Unknown error"
        frappe.log_error(f"Airport search error: {error_msg}", "Flight API")
        return {"error": error_msg}

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
            
        # Log exact length of credentials to check for whitespace issues
        frappe.log_error(
            f"API Key length: {len(api_key)}, API Secret length: {len(api_secret)}", 
            "Amadeus Credentials"
        )
            
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
        # Extract meaningful error message
        error_msg = "HTTP Error"
        if hasattr(e, 'response'):
            error_msg = f"HTTP Error {e.response.status_code}"
            try:
                error_data = e.response.json()
                if 'error_description' in error_data:
                    error_msg = error_data['error_description']
                elif 'errors' in error_data and len(error_data['errors']) > 0:
                    error_msg = error_data['errors'][0].get('detail', 'Unknown error')
            except:
                pass
            
            # Log full response for debugging
            try:
                frappe.log_error(
                    f"Response status: {e.response.status_code}\nHeaders: {dict(e.response.headers)}\nBody: {e.response.text}", 
                    "Amadeus Auth Response"
                )
            except:
                pass
        
        # Limit error message length
        error_msg = error_msg[:100] if error_msg else "Unknown error"
        
        # Add note about API key activation
        user_message = f"{error_msg}\n\nNote: New Amadeus API keys may take up to 30 minutes to activate. If you just created your API key, please wait and try again later."
        
        # Use short title for log
        frappe.log_error(f"Connection test: {error_msg}", "API Test")
        
        return {
            "success": False,
            "message": user_message
        }
    except requests.exceptions.RequestException as e:
        # Network-related errors
        error_msg = str(e)[:100] if str(e) else "Network error"
        frappe.log_error(f"Connection error: {error_msg}", "API Test")
        return {
            "success": False,
            "message": f"Network error: {error_msg}. Please check your internet connection."
        }
    except Exception as e:
        # Any other errors
        error_msg = str(e)[:100] if str(e) else "Unknown error"
        frappe.log_error(f"Test error: {error_msg}", "API Test")
        return {
            "success": False,
            "message": f"Error: {error_msg}"
        }

@frappe.whitelist()
def amadeus_auth_diagnostic():
    """
    Advanced diagnostic function to troubleshoot Amadeus API authentication issues
    
    Makes direct authentication request with detailed logging and diagnostics
    
    Returns:
        dict: Detailed diagnostic results
    """
    try:
        # Get API credentials from settings
        api_key = frappe.db.get_single_value("Amadeus Settings", "api_key")
        api_secret = frappe.db.get_single_value("Amadeus Settings", "api_secret")
        
        # Check for missing credentials
        if not api_key or not api_secret:
            return {
                "success": False,
                "message": _("API credentials are missing. Please enter both API Key and API Secret.")
            }
        
        # Check for whitespace issues
        api_key_stripped = api_key.strip()
        api_secret_stripped = api_secret.strip()
        
        has_whitespace = False
        if api_key != api_key_stripped or api_secret != api_secret_stripped:
            has_whitespace = True
            # Remove whitespace for the test
            api_key = api_key_stripped
            api_secret = api_secret_stripped
        
        # Log credentials details (safely)
        credential_info = {
            "api_key_length": len(api_key),
            "api_key_prefix": api_key[:4] if len(api_key) >= 4 else None,
            "api_key_suffix": api_key[-4:] if len(api_key) >= 4 else None,
            "api_secret_length": len(api_secret),
            "has_whitespace": has_whitespace
        }
        
        frappe.log_error(str(credential_info), "Amadeus Diagnostic - Credentials")
        
        # Start building report
        report = ["=== Amadeus API Authentication Diagnostic Report ==="]
        report.append(f"API Key Length: {len(api_key)} characters")
        report.append(f"API Secret Length: {len(api_secret)} characters")
        
        if has_whitespace:
            report.append("⚠️ WARNING: Whitespace detected in credentials. Testing with whitespace removed.")
        
        # Explicit test environment URL
        base_url = "https://test.api.amadeus.com"
        auth_url = f"{base_url}/v1/security/oauth2/token"
        
        report.append(f"\nAuthentication URL: {auth_url}")
        
        # Set up auth request
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "client_credentials",
            "client_id": api_key,
            "client_secret": api_secret
        }
        
        report.append("\nSending authentication request...")
        
        # Make the request and track timing
        import time
        start_time = time.time()
        
        response = requests.post(auth_url, headers=headers, data=data)
        
        end_time = time.time()
        elapsed_ms = int((end_time - start_time) * 1000)
        
        # Add response info to report
        report.append(f"Response time: {elapsed_ms} ms")
        report.append(f"Status code: {response.status_code}")
        
        # Process response headers
        report.append("\nResponse headers:")
        for header, value in response.headers.items():
            # Skip sensitive headers
            if header.lower() not in ['set-cookie', 'authorization']:
                report.append(f"  {header}: {value}")
        
        # Process response body
        try:
            response_json = response.json()
            response_content = str(response_json)
            
            # Log full response (safely) for analysis
            frappe.log_error(
                f"Status: {response.status_code}\nTime: {elapsed_ms}ms\nResponse: {response_content}", 
                "Amadeus Diagnostic - Response"
            )
            
            # Add to report
            report.append("\nResponse body:")
            if response.status_code == 200:
                # Success case
                report.append(f"  token_type: {response_json.get('token_type')}")
                report.append(f"  expires_in: {response_json.get('expires_in')} seconds")
                # Don't show the actual token
                if 'access_token' in response_json:
                    token = response_json['access_token']
                    token_preview = f"{token[:5]}...{token[-5:]}" if len(token) > 10 else "[redacted]"
                    report.append(f"  access_token: {token_preview} (length: {len(token)})")
            else:
                # Error case - show error details
                if 'error' in response_json:
                    report.append(f"  error: {response_json.get('error')}")
                if 'error_description' in response_json:
                    report.append(f"  error_description: {response_json.get('error_description')}")
                elif 'errors' in response_json and response_json['errors']:
                    for i, error in enumerate(response_json['errors']):
                        report.append(f"  error {i+1}: {error.get('title')} - {error.get('detail')}")
        except Exception as json_error:
            # Fallback to raw text if JSON parsing fails
            report.append("\nResponse is not JSON. Raw content:")
            report.append(response.text[:500] + ("..." if len(response.text) > 500 else ""))
            
        # Add diagnostics and recommendations
        report.append("\n=== Diagnostics ===")
        
        if response.status_code == 200:
            report.append("✅ Authentication successful! The API credentials are working correctly.")
            report.append("\nRecommendation: If you're still having issues with other API calls, check those specific endpoints.")
        else:
            report.append("❌ Authentication failed.")
            
            # Common specific suggestions based on errors
            if response.status_code == 401:
                report.append("\nPossible causes:")
                report.append("1. Incorrect API key or secret")
                report.append("2. API key is too new (remember: it can take up to 30 minutes to activate)")
                report.append("3. API key has been deactivated or is invalid")
                
                report.append("\nRecommendations:")
                report.append("1. Double-check your API key and secret against the Amadeus Developer Portal")
                report.append("2. If you just created the API key, wait 30 minutes and try again")
                report.append("3. Try creating a new API key in the Developer Portal")
            elif response.status_code == 500:
                report.append("\nThis appears to be a server-side issue with Amadeus API.")
                report.append("\nRecommendation: Try again later or contact Amadeus support if the issue persists.")
            
        # Return full report
        success = response.status_code == 200
        
        return {
            "success": success,
            "message": "\n".join(report)
        }
    except Exception as e:
        error_msg = str(e)[:200] if str(e) else "Unknown error"
        frappe.log_error(f"Diagnostic error: {error_msg}", "Amadeus Diagnostic")
        
        return {
            "success": False,
            "message": f"Diagnostic failed: {error_msg}"
        }
