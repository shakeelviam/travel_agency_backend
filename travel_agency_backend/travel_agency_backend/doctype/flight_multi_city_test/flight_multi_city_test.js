// Copyright (c) 2025, Travel Agency and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Multi City Test', {
	refresh: function(frm) {
		// Add any custom buttons or actions here
	},
	
	supplier_cost: function(frm) {
		calculate_total(frm);
	},
	
	markup: function(frm) {
		calculate_total(frm);
	},
	
	commission: function(frm) {
		calculate_total(frm);
	}
});

// Handle child table events
frappe.ui.form.on('Flight Multi City Segment', {
	segments_add: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	segments_remove: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	origin: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	destination: function(frm, cdt, cdn) {
		update_route_summary(frm);
	}
});

// Helper functions
function calculate_total(frm) {
	const supplier_cost = frm.doc.supplier_cost || 0;
	const markup = frm.doc.markup || 0;
	const commission = frm.doc.commission || 0;
	
	frm.set_value('total_amount', supplier_cost + markup - commission);
}

function update_route_summary(frm) {
	if (!frm.doc.segments || frm.doc.segments.length === 0) {
		frm.set_value('route_summary', '');
		return;
	}
	
	const routes = frm.doc.segments
		.filter(segment => segment.origin && segment.destination)
		.map(segment => `${segment.origin}-${segment.destination}`);
	
	frm.set_value('route_summary', routes.join(' / '));
}
