#!/usr/bin/env python
# -*- coding: utf-8 -*-

import frappe
import requests
import json
import time
from frappe import _
from frappe.utils import now_datetime

@frappe.whitelist()
def run_comprehensive_troubleshooter():
    """
    Run a comprehensive troubleshooting check on Amadeus API configuration
    Tests multiple combinations of environments and credentials
    """
    results = []
    
    # Get current settings
    api_key = frappe.db.get_single_value("Amadeus Settings", "api_key")
    api_secret = frappe.db.get_single_value("Amadeus Settings", "api_secret")
    environment = frappe.db.get_single_value("Amadeus Settings", "environment") or "Test"
    
    if not api_key or not api_secret:
        return {
            "success": False,
            "message": "API credentials are missing in settings"
        }
    
    # Create variations to test
    key_variants = [
        {"name": "Original API Key", "key": api_key},
        {"name": "Trimmed API Key", "key": api_key.strip()},
    ]
    
    secret_variants = [
        {"name": "Original API Secret", "key": api_secret},
        {"name": "Trimmed API Secret", "key": api_secret.strip()},
    ]
    
    environments = ["Test", "Production"]
    if environment not in environments:
        environments.insert(0, environment)
    
    # Prepare summary report
    report = ["=== COMPREHENSIVE AMADEUS AUTHENTICATION TROUBLESHOOTING ==="]
    report.append(f"Started at: {now_datetime()}")
    report.append(f"Current environment setting: {environment}")
    report.append(f"API Key Length: {len(api_key)}, API Secret Length: {len(api_secret)}")
    report.append("")
    
    # Test all combinations
    for env in environments:
        base_url = "https://test.api.amadeus.com" if env == "Test" else "https://api.amadeus.com"
        
        report.append(f"\n=== Testing with {env} Environment ({base_url}) ===\n")
        frappe.publish_realtime("amadeus_troubleshooter_progress", {"message": f"Testing {env} environment..."})
        
        for key_var in key_variants:
            for secret_var in secret_variants:
                key = key_var["key"]
                secret = secret_var["key"]
                
                # Skip if no change from original and it's not the first combination
                if (key_var["name"] == "Original API Key" and secret_var["name"] == "Original API Secret" and 
                    key_variants.index(key_var) > 0 and secret_variants.index(secret_var) > 0):
                    continue
                
                # Format combination name
                combo_name = f"{key_var['name']} + {secret_var['name']}"
                
                report.append(f"Testing combination: {combo_name}")
                result = test_auth_combination(base_url, key, secret)
                results.append({
                    "environment": env,
                    "combination": combo_name,
                    "success": result["success"],
                    "status_code": result.get("status_code"),
                    "message": result.get("message")
                })
                
                # Add results to report
                if result["success"]:
                    report.append(f"  ✅ SUCCESS! Status: {result.get('status_code')}")
                    report.append(f"  Message: {result.get('message')}")
                    report.append("\n  WORKING CREDENTIALS FOUND! Here's what worked:")
                    report.append(f"  Environment: {env}")
                    report.append(f"  API Key: {key_var['name']}")
                    report.append(f"  API Secret: {secret_var['name']}")
                    
                    # Update settings with working combination if found
                    update_settings_with_working_combination(env, key, secret)
                    break
                else:
                    report.append(f"  ❌ FAILED. Status: {result.get('status_code')}")
                    report.append(f"  Error: {result.get('message')}")
            
            # Break outer loop if working combination found
            if any(r["success"] for r in results if r["environment"] == env):
                break
    
    # Add recommendations
    report.append("\n=== ANALYSIS & RECOMMENDATIONS ===\n")
    
    # Check if any combination worked
    if any(r["success"] for r in results):
        working = next(r for r in results if r["success"])
        report.append("✅ SUCCESS: Found a working combination!")
        report.append(f"Environment: {working['environment']}")
        report.append(f"Credentials: {working['combination']}")
        report.append(f"Settings have been updated with the working combination.")
        
        success = True
        message = "Found working credentials and updated settings"
    else:
        report.append("❌ No working combination found.")
        report.append("\nRecommendations:")
        report.append("1. Generate new API credentials in the Amadeus Developer Portal")
        report.append("2. Verify your account status is active in the Amadeus Developer Portal")
        report.append("3. Check if you need to use Production environment instead of Test")
        report.append("4. Contact Amadeus Developer support if issues persist")
        
        # Additional checks
        if any(r["status_code"] == 401 for r in results):
            report.append("\nAll attempts returned 401 Unauthorized, which usually means:")
            report.append("• Invalid credentials")
            report.append("• API key not yet activated (can take up to 30 minutes)")
            report.append("• Your Amadeus Developer account may have issues")
        
        success = False
        message = "No working credential combination found"
    
    frappe.publish_realtime("amadeus_troubleshooter_progress", {"message": "Completed"})
    return {
        "success": success,
        "message": "\n".join(report)
    }

def test_auth_combination(base_url, api_key, api_secret):
    """Test a specific combination of API credentials and environment"""
    auth_url = f"{base_url}/v1/security/oauth2/token"
    
    # Set up auth request
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": api_key,
        "client_secret": api_secret
    }
    
    try:
        response = requests.post(auth_url, headers=headers, data=data, timeout=10)
        
        # Parse response
        try:
            response_data = response.json()
        except:
            response_data = {"error": "Invalid JSON response"}
        
        if response.status_code == 200:
            return {
                "success": True,
                "status_code": response.status_code,
                "message": "Authentication successful"
            }
        else:
            error_msg = "Unknown error"
            if "error_description" in response_data:
                error_msg = response_data["error_description"]
            elif "error" in response_data:
                error_msg = response_data["error"]
            
            return {
                "success": False,
                "status_code": response.status_code,
                "message": error_msg
            }
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "status_code": 0,
            "message": f"Connection error: {str(e)}"
        }

def update_settings_with_working_combination(environment, api_key, api_secret):
    """Update Amadeus Settings with working combination"""
    try:
        settings = frappe.get_doc("Amadeus Settings")
        settings.environment = environment
        settings.api_key = api_key
        settings.api_secret = api_secret
        settings.last_sync_on = now_datetime()
        settings.save()
        frappe.db.commit()
        return True
    except Exception as e:
        frappe.log_error(f"Failed to update settings: {str(e)}", "Amadeus Troubleshooter")
        return False
