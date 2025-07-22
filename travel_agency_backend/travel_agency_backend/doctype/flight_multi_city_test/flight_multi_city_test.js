// Copyright (c) 2025, Travel Agency and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Multi City Test', {
	refresh: function(frm) {
		// Show flight multicity section
		frm.set_df_property("flight_multicity_section", "hidden", 0);
		frm.set_df_property("segments", "hidden", 0);
		
		// Add Passenger Segment button
		if (frm.doc.docstatus === 0) {
			frm.add_custom_button("Add Passenger Segment", () => {
				frappe.prompt(
					[
						{
							fieldname: "passenger",
							label: "Select Passenger",
							fieldtype: "Link",
							options: "Passenger",
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
						},
						{
							fieldname: "date_of_travel",
							label: "Date of Travel",
							fieldtype: "Date",
							reqd: 1,
						}
					],
					(values) => {
						// Add a new row to the segments table
						const child = frm.add_child("segments", {
							passenger: values.passenger,
							from_location: values.from_location,
							to_location: values.to_location,
							date_of_travel: values.date_of_travel
						});
						frm.refresh_field("segments");
						update_route_summary(frm);
					},
					"Add Passenger Segment",
					"Add"
				);
			});
		}
	},
	
	customer: function(frm) {
		// You can add customer-related logic here if needed
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
	
	passenger: function(frm, cdt, cdn) {
		// You can add passenger-specific logic here if needed
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
		.map(segment => {
			const passengerInfo = segment.passenger ? `(${segment.passenger})` : '';
			return `${segment.from_location}-${segment.to_location}${passengerInfo}`;
		});
	
	frm.set_value('route_summary', routes.join(' / '));
}
