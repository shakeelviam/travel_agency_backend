import frappe
from frappe import _
from frappe.utils import flt, cint, getdate, nowdate
import csv
import io
import re
import datetime


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


def standardize_passenger_name(passenger_name):
    """Standardize passenger name for comparison
    Handles variations like SMITH/JOHN MR vs John Smith"""
    if not passenger_name:
        return ""
        
    # Convert to uppercase for case-insensitive comparison
    name = passenger_name.upper()
    
    # Remove common titles and separators
    name = re.sub(r'\b(MR|MRS|MISS|MS|DR|PROF|REV|SIR)\b', '', name)
    name = re.sub(r'[^A-Z0-9]', '', name)  # Remove non-alphanumeric chars
    
    return name


def compare_passenger_names(name1, name2, threshold=0.7):
    """Compare two passenger names with tolerance for common discrepancies
    Returns True if names are similar enough, False otherwise"""
    if not name1 or not name2:
        return False
        
    # Standardize both names
    std_name1 = standardize_passenger_name(name1)
    std_name2 = standardize_passenger_name(name2)
    
    # Empty names after standardization
    if not std_name1 or not std_name2:
        return False
    
    # Exact match after standardization
    if std_name1 == std_name2:
        return True
    
    # Check if one is a substring of the other
    if std_name1 in std_name2 or std_name2 in std_name1:
        return True
    
    # Check for major components - assuming both have first and last name 
    # First try to split by common separators if they exist
    segments1 = re.findall(r'[A-Z]+', std_name1)
    segments2 = re.findall(r'[A-Z]+', std_name2)
    
    # Check if major parts match
    common_segments = set(segments1).intersection(set(segments2))
    if len(common_segments) >= 1 and (len(segments1) > 1 or len(segments2) > 1):
        return True
        
    # For short names or initials, be more strict
    return False


def find_matching_flight_bookings(ticket_number, passenger_name=None, pnr=None):
    """Find Flight Booking Entry GDS that match the given ticket number
    - First tries exact ticket match
    - Then partial ticket match 
    - Then combines with passenger name similarity
    - Finally falls back to PNR if provided"""
    if not ticket_number:
        return []
        
    std_ticket = standardize_ticket_number(ticket_number)
    results = []
    
    # Step 1: Try exact ticket match first (highest priority)
    exact_matches = frappe.get_all(
        "Flight Booking Entry GDS",
        filters={"ticket_number": std_ticket},
        fields=["name", "parent", "passenger", "passenger_name", "airline", "airline_code", 
               "ticket_issue_date", "base_fare", "tax_amount", "commission_amount", "total_amount", "pnr"]
    )
    
    if exact_matches:
        # If passenger name provided, check for best match among exact ticket matches
        if passenger_name and len(exact_matches) > 1:
            for match in exact_matches:
                if compare_passenger_names(passenger_name, match.passenger_name):
                    results.append(match)
                    break
            # If no name match found, use first exact ticket match
            if not results:
                results.append(exact_matches[0])
        else:
            results.extend(exact_matches)
        return results
    
    # Step 2: Try partial ticket match
    partial_matches = frappe.get_all(
        "Flight Booking Entry GDS",
        filters={"ticket_number": ["like", f"%{std_ticket}%"]},
        fields=["name", "parent", "passenger", "passenger_name", "airline", "airline_code",
               "ticket_issue_date", "base_fare", "tax_amount", "commission_amount", "total_amount", "pnr"]
    )
    
    if partial_matches:
        # If passenger name provided, filter by name similarity
        if passenger_name:
            for match in partial_matches:
                if compare_passenger_names(passenger_name, match.passenger_name):
                    results.append(match)
            # If no name match found, use all partial matches
            if not results:
                results.extend(partial_matches)
        else:
            results.extend(partial_matches)
        return results
    
    # Step 3: If PNR provided and no matches yet, try matching by PNR
    if pnr and not results:
        pnr_matches = frappe.get_all(
            "Flight Booking Entry GDS",
            filters={"pnr": pnr},
            fields=["name", "parent", "passenger", "passenger_name", "airline", "airline_code",
                   "ticket_issue_date", "base_fare", "tax_amount", "commission_amount", "total_amount", "pnr"]
        )
        
        if pnr_matches and passenger_name:
            # If passenger name provided, find the best match
            for match in pnr_matches:
                if compare_passenger_names(passenger_name, match.passenger_name):
                    results.append(match)
                    break
            # If no name match found, use the first PNR match
            if not results:
                results.append(pnr_matches[0])
        elif pnr_matches:
            results.extend(pnr_matches)
            
    return results


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
            
            # Format dates to DD-MM-YYYY when encountered
            if field == "issue_date" and entry[field]:
                date_obj = parse_date_string(entry[field])
                if date_obj:
                    entry[field] = format_date_display(date_obj)
    
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
    return getdate().strftime("%d-%m-%Y")


def format_date_display(date_obj):
    """Format date for display in DD-MM-YYYY format"""
    if not date_obj:
        return ""
    
    if isinstance(date_obj, str):
        date_obj = parse_date_string(date_obj)
        if not date_obj:
            return ""
    
    return date_obj.strftime('%d-%m-%Y')


def parse_date_string(date_str):
    """Parse date string to datetime object with multiple format support"""
    if not date_str:
        return None
        
    # Define formats to try (DD-MM-YYYY first, then others)
    formats = ['%d-%m-%Y', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d.%m.%Y']
    
    for fmt in formats:
        try:
            return datetime.datetime.strptime(date_str, fmt)
        except ValueError:
            continue
    
    return None
