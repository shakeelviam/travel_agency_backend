# Copyright (c) 2025, Shakeel Viam and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class FlightMultiCityPassenger(Document):
	def validate(self):
		"""Validate passenger data"""
		pass
