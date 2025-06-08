import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, cint, getdate, nowdate


class BSPSettlement(Document):
    def validate(self):
        self.validate_amounts()
        self.calculate_balance()
    
    def validate_amounts(self):
        """Validate settlement amounts"""
        if flt(self.total_amount) < 0:
            frappe.throw(_("Total Amount cannot be negative"))
            
        if flt(self.paid_amount) < 0:
            frappe.throw(_("Paid Amount cannot be negative"))
    
    def calculate_balance(self):
        """Calculate balance amount"""
        self.balance_amount = flt(self.total_amount) - flt(self.paid_amount)
    
    def before_submit(self):
        """Ensure all entries are marked as settled"""
        for entry in self.reconciliation_entries:
            entry.status = "Settled"
    
    def on_submit(self):
        """Create Journal Entry for settlement if not already created"""
        if not self.journal_entry:
            je = self.create_journal_entry()
            self.db_set("journal_entry", je.name)
    
    def create_journal_entry(self):
        """Create Journal Entry for BSP Settlement"""
        company = frappe.defaults.get_user_default("company")
        
        # Get accounts
        bsp_payable_account = self.get_bsp_payable_account(company)
        bank_account = self.get_bank_account(company)
        
        if not bsp_payable_account or not bank_account:
            frappe.throw(_("BSP Payable Account or Bank Account not found. Please configure accounts first."))
        
        # Create Journal Entry
        je = frappe.new_doc("Journal Entry")
        je.posting_date = nowdate()
        je.user_remark = f"BSP Settlement for {self.airline or 'Multiple Airlines'} - {self.reporting_period}"
        je.company = company
        
        # Credit BSP Payable account
        je.append("accounts", {
            "account": bsp_payable_account,
            "credit_in_account_currency": self.balance_amount,
            "reference_type": "BSP Settlement",
            "reference_name": self.name
        })
        
        # Debit Bank account
        je.append("accounts", {
            "account": bank_account,
            "debit_in_account_currency": self.balance_amount
        })
        
        je.insert()
        return je
    
    def get_bsp_payable_account(self, company):
        """Get BSP Payable account based on company"""
        # Try to find an account with "BSP Payable" in the name
        accounts = frappe.get_all(
            "Account",
            filters=[
                ["company", "=", company],
                ["account_type", "=", "Payable"],
                ["account_name", "like", "%BSP%"]
            ],
            fields=["name"]
        )
        
        if accounts:
            return accounts[0].name
        
        # Fall back to Creditors account
        creditors = frappe.get_all(
            "Account",
            filters=[
                ["company", "=", company],
                ["account_type", "=", "Payable"],
                ["is_group", "=", 0]
            ],
            fields=["name"],
            limit=1
        )
        
        return creditors[0].name if creditors else None
    
    def get_bank_account(self, company):
        """Get default Bank account based on company"""
        accounts = frappe.get_all(
            "Account",
            filters=[
                ["company", "=", company],
                ["account_type", "=", "Bank"],
                ["is_group", "=", 0]
            ],
            fields=["name"],
            limit=1
        )
        
        return accounts[0].name if accounts else None


@frappe.whitelist()
def process_bsp_settlements():
    """Process pending BSP settlements based on reconciled entries"""
    # Get all unprocessed BSP entries that have been matched
    reconciled_entries = frappe.get_all(
        "BSP Reconciliation Entry",
        filters={"status": "Matched"}, 
        fields=["name", "bsp_entry", "trip_booking", "purchase_invoice", "payment_status", "bsp_amount"]
    )
    
    # Group entries by BSP reporting period
    period_wise_entries = {}
    for entry in reconciled_entries:
        bsp_entry = frappe.db.get_value("BSP Entry", entry.bsp_entry, ["parent", "airline_code"], as_dict=True)
        if not bsp_entry:
            continue
            
        bsp_file = frappe.get_doc("BSP File", bsp_entry.parent)
        period = bsp_file.reporting_period
        airline = bsp_entry.airline_code
        
        key = f"{airline}|{period}"
        if key not in period_wise_entries:
            period_wise_entries[key] = {
                "airline": airline,
                "period": period,
                "total_amount": 0,
                "paid_amount": 0,
                "entries": []
            }
            
        period_wise_entries[key]["entries"].append(entry)
        period_wise_entries[key]["total_amount"] += flt(entry.bsp_amount)
        
        # Add paid amount if applicable
        if entry.payment_status == "Paid" and entry.purchase_invoice:
            pi_status = frappe.db.get_value("Purchase Invoice", entry.purchase_invoice, "status")
            if pi_status == "Paid":
                period_wise_entries[key]["paid_amount"] += flt(entry.bsp_amount)
                
    # Create settlement documents
    settlements = []
    for key, data in period_wise_entries.items():
        # Check if settlement already exists
        existing = frappe.get_all(
            "BSP Settlement",
            filters={
                "reporting_period": data["period"],
                "airline": ["like", f"%{data['airline']}%"]
            },
            fields=["name"]
        )
        
        if existing:
            settlements.append(existing[0].name)
            continue
            
        # Create settlement entry
        settlement = frappe.new_doc("BSP Settlement")
        settlement.settlement_date = frappe.utils.today()
        settlement.reporting_period = data["period"]
        
        # Find airline master record
        airline_master = frappe.get_all(
            "Airline Master",
            filters={"airline_code": data["airline"]},
            fields=["name"]
        )
        
        if airline_master:
            settlement.airline = airline_master[0].name
            
        settlement.total_amount = data["total_amount"]
        settlement.paid_amount = data["paid_amount"]
        
        # Link reconciliation entries
        for entry in data["entries"]:
            settlement.append("reconciliation_entries", {
                "reconciliation": entry.name,
                "trip_booking": entry.trip_booking,
                "purchase_invoice": entry.purchase_invoice,
                "ticket_number": frappe.db.get_value("BSP Entry", entry.bsp_entry, "ticket_number"),
                "amount": entry.bsp_amount,
                "status": "Pending"
            })
            
        settlement.insert()
        settlements.append(settlement.name)
        
    return settlements
