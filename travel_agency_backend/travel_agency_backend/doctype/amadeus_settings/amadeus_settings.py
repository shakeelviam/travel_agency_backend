# -*- coding: utf-8 -*-
# Copyright (c) 2025, Shakeel Mohammed Viam and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document

class AmadeusSettings(Document):
    def validate(self):
        if self.enabled:
            if not self.api_key:
                frappe.throw("API Key is required when Amadeus integration is enabled")
            if not self.api_secret:
                frappe.throw("API Secret is required when Amadeus integration is enabled")
