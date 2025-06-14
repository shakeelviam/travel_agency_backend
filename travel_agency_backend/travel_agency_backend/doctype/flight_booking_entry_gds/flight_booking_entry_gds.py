# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class FlightBookingEntryGDS(Document):
	def validate(self):
		# Set the item based on the Service Type
		if not self.item:
			service_type = "Flight GDS"
			item_code = frappe.db.get_value("Service Type", service_type, "item_code")
			if item_code:
				self.item = item_code
		
		# Calculate supplier_cost as sum of base_fare and taxes
		self.supplier_cost = (self.base_fare or 0) + (self.taxes or 0)
		
		# Calculate total_amount as supplier_cost + markup
		self.total_amount = (self.supplier_cost or 0) + (self.markup or 0)
