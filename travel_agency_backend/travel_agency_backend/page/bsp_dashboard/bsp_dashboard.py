import frappe
from frappe import _
from frappe.utils import flt, cint, getdate, add_months, today


@frappe.whitelist()
def get_dashboard_data(filters=None):
    """Get data for BSP Dashboard"""
    if not filters:
        filters = {}
        
    if isinstance(filters, str):
        import json
        filters = json.loads(filters)
    
    # Default date range to last month if not provided
    if not filters.get('from_date'):
        filters['from_date'] = add_months(today(), -1)
    if not filters.get('to_date'):
        filters['to_date'] = today()
    
    # Get summary stats
    summary = get_summary_stats(filters)
    
    # Get BSP Files
    bsp_files = get_bsp_files(filters)
    
    # Get Reconciliations
    reconciliations = get_reconciliations(filters)
    
    # Get Settlements
    settlements = get_settlements(filters)
    
    return {
        "summary": summary,
        "bsp_files": bsp_files,
        "reconciliations": reconciliations,
        "settlements": settlements
    }


def get_summary_stats(filters):
    """Get summary statistics for BSP Dashboard"""
    # Initialize summary
    summary = {
        "total_bsp_amount": 0,
        "reconciled_amount": 0,
        "settled_amount": 0,
        "pending_settlement": 0,
        "total_files": 0,
        "total_reconciliations": 0,
        "total_settlements": 0
    }
    
    # Get BSP file stats
    bsp_files = frappe.get_all(
        "BSP File",
        filters={
            "docstatus": 1,
            "from_date": [">=", filters.get('from_date')],
            "to_date": ["<=", filters.get('to_date')]
        },
        fields=["name", "total_amount", "imported_entries"]
    )
    
    summary["total_files"] = len(bsp_files)
    summary["total_bsp_amount"] = sum(flt(file.total_amount) for file in bsp_files)
    
    # Get reconciliation stats
    reconciliations = frappe.get_all(
        "BSP Reconciliation",
        filters={
            "docstatus": 1,
            "creation": ["between", [filters.get('from_date'), filters.get('to_date')]]
        },
        fields=["name", "total_bsp_amount", "total_system_amount", "total_difference"]
    )
    
    summary["total_reconciliations"] = len(reconciliations)
    summary["reconciled_amount"] = sum(flt(rec.total_bsp_amount) for rec in reconciliations)
    
    # Get settlement stats
    settlements = frappe.get_all(
        "BSP Settlement",
        filters={
            "settlement_date": ["between", [filters.get('from_date'), filters.get('to_date')]]
        },
        fields=["name", "total_amount", "paid_amount", "balance_amount"]
    )
    
    summary["total_settlements"] = len(settlements)
    summary["settled_amount"] = sum(flt(settlement.paid_amount) for settlement in settlements)
    summary["pending_settlement"] = sum(flt(settlement.balance_amount) for settlement in settlements)
    
    return summary


def get_bsp_files(filters):
    """Get BSP Files for Dashboard"""
    return frappe.get_all(
        "BSP File",
        filters={
            "from_date": [">=", filters.get('from_date')],
            "to_date": ["<=", filters.get('to_date')],
        },
        fields=[
            "name", "file_type", "reporting_period", "from_date", "to_date", 
            "imported_entries", "total_amount", "status", "docstatus"
        ],
        order_by="creation desc",
        limit=10
    )


def get_reconciliations(filters):
    """Get BSP Reconciliations for Dashboard"""
    reconciliation_filters = {
        "creation": ["between", [filters.get('from_date'), filters.get('to_date')]],
    }
    
    if filters.get('bsp_file'):
        reconciliation_filters["bsp_file"] = filters.get('bsp_file')
    
    return frappe.get_all(
        "BSP Reconciliation",
        filters=reconciliation_filters,
        fields=[
            "name", "bsp_file", "reporting_period", "total_entries", 
            "matched_entries", "discrepancy_entries", "unmatched_entries", 
            "total_bsp_amount", "total_system_amount", "total_difference", "docstatus"
        ],
        order_by="creation desc",
        limit=10
    )


def get_settlements(filters):
    """Get BSP Settlements for Dashboard"""
    settlement_filters = {
        "settlement_date": ["between", [filters.get('from_date'), filters.get('to_date')]],
    }
    
    if filters.get('airline'):
        settlement_filters["airline"] = filters.get('airline')
    
    settlements = frappe.get_all(
        "BSP Settlement",
        filters=settlement_filters,
        fields=[
            "name", "settlement_date", "reporting_period", "airline", 
            "total_amount", "paid_amount", "balance_amount", "journal_entry", "docstatus"
        ],
        order_by="settlement_date desc",
        limit=10
    )
    
    # Get airline names
    for settlement in settlements:
        if settlement.airline:
            settlement["airline_name"] = frappe.db.get_value("Airline Master", settlement.airline, "airline_name") or settlement.airline
            
    return settlements
