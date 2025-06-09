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
