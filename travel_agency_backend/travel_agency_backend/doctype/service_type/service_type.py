import frappe
from frappe.model.document import Document
from frappe import _

class ServiceType(Document):
    def after_insert(self):
        """Auto-create service item if not specified"""
        if not self.item_code and self.is_service_item:
            self.create_service_item()
    
    def validate(self):
        """Ensure accounts are properly set"""
        if not self.sales_account and self.income_account:
            self.sales_account = self.income_account
            
        if not self.purchase_account and self.net_fare_account:
            self.purchase_account = self.net_fare_account
    
    def create_service_item(self):
        """Create a service item linked to this service type"""
        try:
            item = frappe.new_doc("Item")
            item.item_code = f"SVC-{self.name.upper().replace(' ', '-')}"
            item.item_name = f"{self.name} Service"
            item.item_group = "Services"
            item.is_stock_item = 0
            item.include_item_in_manufacturing = 0
            item.is_sales_item = 1
            item.is_purchase_item = 1
            
            # Set accounts
            if self.sales_account or self.income_account:
                company = frappe.defaults.get_user_default("Company")
                if company:
                    item.append("item_defaults", {
                        "company": company,
                        "income_account": self.sales_account or self.income_account,
                        "expense_account": self.purchase_account or self.net_fare_account
                    })
            
            # Don't use ignore_permissions
            item.insert()
            self.db_set("item_code", item.name)
            frappe.msgprint(_("Service Item {0} created").format(item.name), alert=True)
            return item.name
        except Exception as e:
            frappe.log_error(f"Error creating service item: {str(e)}", "Service Type Item Creation")
            return None
