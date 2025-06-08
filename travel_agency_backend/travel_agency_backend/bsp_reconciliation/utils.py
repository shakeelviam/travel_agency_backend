import frappe
from frappe import _
from frappe.utils import flt, cint, getdate, nowdate
import csv
import io
import re


def standardize_ticket_number(ticket_number):
    """Standardize ticket number format by removing spaces, dashes and other non-digits"""
    if not ticket_number:
        return ""
        
    # Remove all non-digits
    cleaned = re.sub(r'\D', '', ticket_number)
    
    # Ensure it's 13 digits for a typical ticket number
    if len(cleaned) > 13:
        cleaned = cleaned[-13:]  # Take last 13 digits
        
    return cleaned


def find_matching_flight_bookings(ticket_number):
    """Find Flight Booking Entry GDS that match the given ticket number"""
    if not ticket_number:
        return []
        
    std_ticket = standardize_ticket_number(ticket_number)
    
    # Try exact match first
    matches = frappe.get_all(
        "Flight Booking Entry GDS",
        filters={"ticket_number": std_ticket},
        fields=["name", "parent", "passenger", "passenger_name", "airline", "airline_code", 
               "ticket_issue_date", "base_fare", "tax_amount", "commission_amount", "total_amount"]
    )
    
    if not matches:
        # Try partial match
        matches = frappe.get_all(
            "Flight Booking Entry GDS",
            filters={"ticket_number": ["like", f"%{std_ticket}%"]},
            fields=["name", "parent", "passenger", "passenger_name", "airline", "airline_code",
                   "ticket_issue_date", "base_fare", "tax_amount", "commission_amount", "total_amount"]
        )
        
    return matches


def get_purchase_invoice_status(trip_booking):
    """Get Purchase Invoice status for a Trip Booking"""
    purchase_invoice_ids = frappe.db.get_value("Trip Booking", trip_booking, "purchase_invoice_ids") or ""
    
    if not purchase_invoice_ids:
        return {
            "invoice": None,
            "status": "Not Invoiced"
        }
    
    # Get the first Purchase Invoice
    pi_list = purchase_invoice_ids.split(",")
    if not pi_list:
        return {
            "invoice": None,
            "status": "Not Invoiced"
        }
        
    purchase_invoice = pi_list[0].strip()
    
    # Check if it's for BSP
    pi_doc = frappe.get_doc("Purchase Invoice", purchase_invoice)
    is_bsp = False
    
    if pi_doc.supplier:
        is_bsp = "BSP" in pi_doc.supplier or "IATA" in pi_doc.supplier
    
    # Check payment status
    status = pi_doc.status
    if status == "Paid":
        payment_status = "Paid"
    elif status == "Unpaid":
        payment_status = "Unpaid"
    elif status == "Partly Paid":
        payment_status = "Partially Paid"
    else:
        payment_status = "Unknown"
        
    return {
        "invoice": purchase_invoice,
        "status": payment_status,
        "is_bsp": is_bsp,
        "amount": pi_doc.grand_total
    }


def parse_bsp_file(file_content, file_type="HOT"):
    """Parse BSP file content based on file type"""
    if not file_content:
        return {
            "entries": [],
            "total_amount": 0
        }
    
    if isinstance(file_content, bytes):
        file_content = file_content.decode('utf-8')
        
    # Determine file format and delimiter
    delimiter = detect_delimiter(file_content)
    entries = []
    
    # Read CSV content
    reader = csv.reader(io.StringIO(file_content), delimiter=delimiter)
    
    try:
        headers = next(reader)  # Skip header row
    except StopIteration:
        return {
            "entries": [],
            "total_amount": 0
        }
    
    # Map column indices based on headers
    col_map = map_columns(headers)
    
    for row in reader:
        if len(row) < 4:  # Minimum required columns
            continue
            
        # Extract data using column mapping
        entry = extract_entry_data(row, col_map, file_type)
        if entry:
            entries.append(entry)
    
    # Calculate total amount
    total_amount = sum(flt(entry.get("total_amount")) for entry in entries)
    
    # Extract period from filename or first entry
    period = extract_period(file_content, entries)
    
    return {
        "entries": entries,
        "total_amount": total_amount,
        "period": period
    }


def detect_delimiter(file_content):
    """Detect the delimiter used in a CSV file"""
    first_line = file_content.split('\n')[0]
    
    if ',' in first_line:
        return ','
    elif ';' in first_line:
        return ';'
    elif '\t' in first_line:
        return '\t'
    else:
        return ','  # Default to comma


def map_columns(headers):
    """Map column headers to standard field names"""
    col_map = {
        "ticket_number": -1,
        "passenger_name": -1,
        "airline_code": -1,
        "issue_date": -1,
        "base_fare": -1,
        "tax_amount": -1,
        "commission_amount": -1,
        "total_amount": -1
    }
    
    for i, header in enumerate(headers):
        header_lower = header.lower()
        
        if any(x in header_lower for x in ["ticket", "document", "doc#"]):
            col_map["ticket_number"] = i
        elif any(x in header_lower for x in ["passenger", "name", "pax"]):
            col_map["passenger_name"] = i
        elif any(x in header_lower for x in ["airline", "carrier", "validating carrier"]):
            col_map["airline_code"] = i
        elif any(x in header_lower for x in ["issue", "date"]):
            col_map["issue_date"] = i
        elif any(x in header_lower for x in ["fare", "base"]):
            col_map["base_fare"] = i
        elif any(x in header_lower for x in ["tax", "taxes"]):
            col_map["tax_amount"] = i
        elif any(x in header_lower for x in ["commission", "comm"]):
            col_map["commission_amount"] = i
        elif any(x in header_lower for x in ["total", "amount", "net amount"]):
            col_map["total_amount"] = i
    
    return col_map


def extract_entry_data(row, col_map, file_type):
    """Extract BSP entry data from a CSV row"""
    # Skip empty rows or invalid data
    if not row or (col_map["ticket_number"] >= 0 and not row[col_map["ticket_number"]]):
        return None
    
    entry = {}
    
    # Extract basic data
    for field, col_idx in col_map.items():
        if col_idx >= 0 and col_idx < len(row):
            entry[field] = row[col_idx].strip()
    
    # Set defaults for missing fields
    if "ticket_number" not in entry or not entry["ticket_number"]:
        return None  # Skip entries without ticket number
        
    if "passenger_name" not in entry or not entry["passenger_name"]:
        entry["passenger_name"] = "Unknown Passenger"
        
    if "airline_code" not in entry or not entry["airline_code"]:
        # Try to extract airline code from ticket number (first 3 digits)
        if len(entry["ticket_number"]) >= 3:
            entry["airline_code"] = entry["ticket_number"][:3]
        else:
            entry["airline_code"] = "Unknown"
    
    # Convert amounts to float
    for amount_field in ["base_fare", "tax_amount", "commission_amount", "total_amount"]:
        if amount_field in entry:
            try:
                entry[amount_field] = flt(entry[amount_field].replace(',', ''))
            except:
                entry[amount_field] = 0
        else:
            entry[amount_field] = 0
    
    # Handle refunds and ADM/ACM
    if file_type == "RET":
        entry["total_amount"] = -abs(entry["total_amount"])
    
    return entry


def extract_period(file_content, entries):
    """Extract BSP reporting period from file content or entries"""
    # Try to find a period identifier in the file
    period_patterns = [
        r'Period[:\s]+([0-9/]+)',
        r'Reporting Period[:\s]+([0-9/]+)',
        r'BSP Report[:\s]+([0-9/]+)'
    ]
    
    for pattern in period_patterns:
        match = re.search(pattern, file_content, re.IGNORECASE)
        if match:
            return match.group(1)
    
    # If entries exist, use the issue date of first entry
    if entries and "issue_date" in entries[0]:
        return entries[0]["issue_date"]
    
    # Fall back to current date
    return getdate().strftime("%Y/%m")
