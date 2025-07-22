// Copyright (c) 2025, Travel Agency and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Multi City Test', {
	refresh: function(frm) {
		// Show flight multicity section
		frm.set_df_property("flight_multicity_section", "hidden", 0);
		frm.set_df_property("segments", "hidden", 0);
		
		// Add Flight Segment button
		if (frm.doc.docstatus === 0) {
			frm.add_custom_button("Add Flight Segment", () => {
				
				frappe.prompt(
					[
						{
							fieldname: "airline",
							label: "Airline",
							fieldtype: "Link",
							options: "Airline Master",
						},
						{
							fieldname: "date_of_travel",
							label: "Date of Travel",
							fieldtype: "Date",
							reqd: 1,
						},
						{
							fieldname: "from_location",
							label: "From Location",
							fieldtype: "Link",
							options: "Sector Master",
							reqd: 1,
						},
						{
							fieldname: "to_location",
							label: "To Location",
							fieldtype: "Link",
							options: "Sector Master",
							reqd: 1,
						}
					],
					(values) => {
						// Add a new row to the segments table
						const child = frm.add_child("segments", {
							airline: values.airline,
							date_of_travel: values.date_of_travel,
							from_location: values.from_location,
							to_location: values.to_location
						});
						frm.refresh_field("segments");
						update_route_summary(frm);
					},
					"Add Flight Segment",
					"Add"
				);
			});
		}
	},
	
	customer: function(frm) {
		// You can add customer-related logic here if needed
	},
	
	passenger: function(frm) {
		// Update route summary when passenger changes
		update_route_summary(frm);
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
	
	from_location: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	to_location: function(frm, cdt, cdn) {
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
		.filter(segment => segment.from_location && segment.to_location)
		.map(segment => `${segment.from_location}-${segment.to_location}`);
	
	const passengerInfo = frm.doc.passenger ? `Passenger: ${frm.doc.passenger} | ` : '';
	frm.set_value('route_summary', passengerInfo + 'Route: ' + routes.join(' / '));
}
