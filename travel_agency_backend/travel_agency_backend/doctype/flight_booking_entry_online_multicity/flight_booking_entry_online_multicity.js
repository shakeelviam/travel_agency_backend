// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Booking Entry Online Multicity', {
	refresh: function(frm) {
		// Calculate totals when form is refreshed
		calculate_total(frm);
	},
	
	supplier_cost: function(frm) {
		calculate_total(frm);
	},
	
	markup: function(frm) {
		calculate_total(frm);
	}
});

// Calculate total amount
function calculate_total(frm) {
	const supplier_cost = flt(frm.doc.supplier_cost) || 0;
	const markup = flt(frm.doc.markup) || 0;
	
	frm.set_value('total_amount', supplier_cost + markup);
}
