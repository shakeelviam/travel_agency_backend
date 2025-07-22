# Copyright (c) 2025, Travel Agency and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class FlightMultiCityTest(Document):
	def validate(self):
		# Set the item based on the Service Type
		if not self.item:
			service_type = "Flight Booking Multi City"
			item_code = frappe.db.get_value("Service Type", service_type, "item_code")
			if item_code:
				self.item = item_code
		
		# Calculate total from supplier cost, markup, and commission
		self.total_amount = (self.supplier_cost or 0) + (self.markup or 0) - (self.commission or 0)
		
		# Update route summary
		self.update_route_summary()
		
		# Set naming series if not already set
		if not self.naming_series:
			self.naming_series = "FMCT-.YYYY.-"
	
	def update_route_summary(self):
		"""Update the route summary based on segments"""
		if not self.segments:
			self.route_summary = ""
			return
			
		routes = []
		for segment in self.segments:
			if segment.from_location and segment.to_location:
				passenger_info = f"({segment.passenger})" if segment.passenger else ""
				routes.append(f"{segment.from_location}-{segment.to_location}{passenger_info}")
				
		self.route_summary = " / ".join(routes) if routes else ""
