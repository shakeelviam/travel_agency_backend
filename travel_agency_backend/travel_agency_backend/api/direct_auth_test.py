#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import requests
import argparse
import json
import time
import re

def direct_auth_test(api_key=None, api_secret=None, test_mode=True):
    """
    Direct authentication test to Amadeus API using raw requests
    Bypasses any framework code to ensure direct communication
    """
    print("\n=== DIRECT AMADEUS AUTHENTICATION TEST ===\n")
    
    if not api_key or not api_secret:
        print("No credentials provided. Please enter your credentials:")
        api_key = input("API Key: ").strip()
        api_secret = input("API Secret: ").strip()
    
    # Print masked values for verification
    print(f"API Key: {api_key[:4]}...{api_key[-4:] if len(api_key) >= 8 else ''} (length: {len(api_key)})")
    print(f"API Secret: {api_secret[:2]}...{api_secret[-2:] if len(api_secret) >= 4 else ''} (length: {len(api_secret)})")
    
    # Check for common issues
    check_credentials_format(api_key, api_secret)
    
    # Select the correct base URL based on mode
    base_url = "https://test.api.amadeus.com" if test_mode else "https://api.amadeus.com"
    auth_url = f"{base_url}/v1/security/oauth2/token"
    
    print(f"\nUsing {'TEST' if test_mode else 'PRODUCTION'} environment: {base_url}")
    print(f"Authentication URL: {auth_url}")
    
    # Set up auth request
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": api_key,
        "client_secret": api_secret
    }
    
    print("\nSending direct authentication request...")
    start_time = time.time()
    
    try:
        response = requests.post(auth_url, headers=headers, data=data)
        elapsed = time.time() - start_time
        
        print(f"Response received in {elapsed:.2f} seconds")
        print(f"Status code: {response.status_code}")
        
        # Print headers
        print("\nResponse headers:")
        for header, value in response.headers.items():
            if header.lower() not in ['set-cookie']:
                print(f"  {header}: {value}")
        
        # Print response body
        print("\nResponse body:")
        try:
            response_json = response.json()
            print(json.dumps(response_json, indent=2))
            
            if response.status_code == 200:
                print("\n✅ SUCCESS: Authentication successful!")
                if 'access_token' in response_json:
                    token = response_json['access_token']
                    print(f"Token received: {token[:5]}...{token[-5:]} (length: {len(token)})")
                return True
            else:
                print("\n❌ FAILED: Authentication failed")
                return False
        except:
            print(response.text)
            print("\n❌ FAILED: Authentication failed")
            return False
    except Exception as e:
        print(f"\n⚠️ ERROR: {str(e)}")
        return False

def check_credentials_format(api_key, api_secret):
    """Check for common credential format issues"""
    issues = []
    
    # Check for whitespace
    if api_key != api_key.strip() or api_secret != api_secret.strip():
        issues.append("⚠️ WARNING: Whitespace detected in credentials")
    
    # Check length
    if len(api_key) != 32:
        issues.append(f"⚠️ WARNING: API key length ({len(api_key)}) is not standard (expected 32 chars)")
    
    if len(api_secret) != 16:
        issues.append(f"⚠️ WARNING: API secret length ({len(api_secret)}) is not standard (expected 16 chars)")
    
    # Check for non-alphanumeric characters
    if not api_key.isalnum():
        issues.append("⚠️ WARNING: API key contains non-alphanumeric characters")
    
    if not api_secret.isalnum():
        issues.append("⚠️ WARNING: API secret contains non-alphanumeric characters")
    
    # Print issues
    if issues:
        print("\nPotential credential format issues:")
        for issue in issues:
            print(f"  {issue}")
    else:
        print("\n✅ Credential format looks good (correct length and character types)")

def main():
    # Hardcoded working credentials for direct testing
    working_key = "GieAZZPHFJPkzhhMBuSejkTLXPAHVSlF"
    working_secret = "sGdcWGk7T2o3t3tG"
    
    print("\n=== TESTING WITH HARDCODED WORKING CREDENTIALS ===\n")
    success = direct_auth_test(working_key, working_secret, True)  # True = use test environment
    
    if success:
        print("\n✅ These credentials work! Use them in your Amadeus Settings page.\n") 
        print(f"API Key: {working_key}")
        print(f"API Secret: {working_secret}")
        print("\nNote: If you're having trouble saving these in Frappe, there might be an issue with your encryption key.")
        print("Try updating them directly through the UI instead of through the console.")
    else:
        print("\n❌ Authentication failed even with hardcoded credentials.")
        print("This could indicate a network, firewall, or Amadeus API issue.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test Amadeus API authentication directly")
    parser.add_argument("--key", help="API Key for Amadeus")
    parser.add_argument("--secret", help="API Secret for Amadeus")
    parser.add_argument("--prod", action="store_true", help="Use production environment instead of test")
    parser.add_argument("--test-hardcoded", action="store_true", help="Test with hardcoded working credentials")
    
    args = parser.parse_args()
    
    if args.test_hardcoded:
        main()
    else:
        direct_auth_test(args.key, args.secret, not args.prod)
