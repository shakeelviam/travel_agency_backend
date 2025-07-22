// Copyright (c) 2025, Travel Agency Backend and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Booking Entry Multicity', {
	refresh: function(frm) {
		// Calculate total on refresh
		calculate_total(frm);
	},
	
	supplier_cost: function(frm) {
		calculate_total(frm);
	},
	
	markup: function(frm) {
		calculate_total(frm);
	},
	
	multi_city_segments_add: function(frm, cdt, cdn) {
		// When a new segment is added, update the route summary
		update_route_summary(frm);
	},
	
	multi_city_segments_remove: function(frm, cdt, cdn) {
		// When a segment is removed, update the route summary
		update_route_summary(frm);
	}
});

// Handle events on the child table
frappe.ui.form.on('Flight Multi City Segment', {
	from_location: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	to_location: function(frm, cdt, cdn) {
		update_route_summary(frm);
	}
});

// Calculate total amount
function calculate_total(frm) {
	let supplier_cost = frm.doc.supplier_cost || 0;
	let markup = frm.doc.markup || 0;
	let total = supplier_cost + markup;
	
	frm.set_value('total_amount', total);
}

// Update route summary based on segments
function update_route_summary(frm) {
	if (!frm.doc.multi_city_segments || frm.doc.multi_city_segments.length === 0) {
		frm.set_value('route_summary', 'No segments defined');
		return;
	}
	
	const segments = frm.doc.multi_city_segments;
	let summary = [];
	
	segments.forEach((segment, index) => {
		if (segment.from_location) {
			summary.push(segment.from_location);
		}
	});
	
	// Add the final destination
	if (segments.length > 0 && segments[segments.length - 1].to_location) {
		summary.push(segments[segments.length - 1].to_location);
	}
	
	frm.set_value('route_summary', summary.join(' → ') || 'Route not defined');
}
