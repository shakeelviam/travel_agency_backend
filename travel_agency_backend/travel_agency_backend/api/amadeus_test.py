#!/usr/bin/env python
# -*- coding: utf-8 -*-

import requests
import json
import frappe
from frappe import _

def test_amadeus_auth():
    """
    Simple diagnostic function to test Amadeus API authentication
    """
    # Get credentials from Amadeus Settings
    api_key = frappe.db.get_single_value("Amadeus Settings", "api_key")
    api_secret = frappe.db.get_single_value("Amadeus Settings", "api_secret")
    
    # Use the direct values for testing if needed
    # api_key = "GieAZZPHFJPkzhhMBuSejKTLXPAHVSIF"
    # api_secret = "sGdcWGk7T2c3t3tG"
    
    # Print masked values for verification
    print(f"Using API Key: {api_key[:4]}...{api_key[-4:]}")
    
    # Explicit test environment URL
    base_url = "https://test.api.amadeus.com"
    auth_url = f"{base_url}/v1/security/oauth2/token"
    
    # Set up auth request
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": api_key,
        "client_secret": api_secret
    }
    
    # Detailed debug info
    print("Making authentication request to:", auth_url)
    
    try:
        # Make the request with full response details
        response = requests.post(auth_url, headers=headers, data=data)
        
        # Print status and headers for debugging
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {json.dumps(dict(response.headers), indent=2)}")
        
        # Print response content
        try:
            print(f"Response Body: {json.dumps(response.json(), indent=2)}")
        except:
            print(f"Raw Response: {response.text}")
            
        # Check if successful
        if response.status_code == 200:
            print("Authentication SUCCESSFUL! Token received.")
            return True
        else:
            print(f"Authentication FAILED with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

@frappe.whitelist()
def run_amadeus_test():
    """
    Run the Amadeus authentication test and return results as JSON
    """
    try:
        result = test_amadeus_auth()
        return {"success": result, "message": "See server logs for detailed output"}
    except Exception as e:
        return {"success": False, "message": str(e)}
