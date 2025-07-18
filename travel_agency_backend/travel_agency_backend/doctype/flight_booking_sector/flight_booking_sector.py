# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate

class FlightBookingSector(Document):
	def validate(self):
		"""Validate sector data"""
		self.validate_dates()
		self.validate_sectors()
	
	def validate_dates(self):
		"""Validate departure and arrival dates"""
		if self.departure_date and self.arrival_date:
			if getdate(self.departure_date) > getdate(self.arrival_date):
				frappe.throw(_("Arrival date cannot be before departure date in segment {0}").format(self.segment_number))
	
	def validate_sectors(self):
		"""Validate from and to sectors"""
		if self.from_sector and self.to_sector and self.from_sector == self.to_sector:
			frappe.throw(_("From and To sectors cannot be the same in segment {0}").format(self.segment_number))
		
		# Ensure sectors connect properly in a multi-city booking
		if self.parent and self.parentfield == "sectors":
			parent_doc = frappe.get_doc(self.parenttype, self.parent)
			if parent_doc and parent_doc.sectors:
				# Find this sector's position
				for i, sector in enumerate(parent_doc.sectors):
					if sector.name == self.name:
						# Check if there's a previous sector
						if i > 0:
							prev_sector = parent_doc.sectors[i-1]
							# Ensure this sector's from_sector matches previous sector's to_sector
							if self.from_sector != prev_sector.to_sector:
								frappe.msgprint(
									_("Warning: Segment {0}'s departure city does not match segment {1}'s arrival city")
									.format(self.segment_number, prev_sector.segment_number),
									alert=True
								)
								
							# Check if dates are in sequence
							if self.departure_date and prev_sector.arrival_date:
								if getdate(self.departure_date) < getdate(prev_sector.arrival_date):
									frappe.msgprint(
										_("Warning: Segment {0}'s departure date is before segment {1}'s arrival date")
										.format(self.segment_number, prev_sector.segment_number),
										alert=True
									)
						break
