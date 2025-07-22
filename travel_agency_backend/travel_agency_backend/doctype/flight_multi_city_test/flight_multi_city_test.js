// Copyright (c) 2025, Travel Agency and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Multi City Test', {
	refresh: function(frm) {
		// Show flight multicity section
		frm.set_df_property("flight_multicity_section", "hidden", 0);
		
		// Add Passenger Segment button
		if (frm.doc.docstatus === 0) {
			frm.add_custom_button("Add Passenger Segment", () => {
				frappe.prompt(
					[
						{
							fieldname: "passenger",
							label: "Passenger",
							fieldtype: "Link",
							options: "Passenger",
							reqd: 1,
						}
					],
					(values) => {
						// Check if passenger already exists
						const existingPassenger = (frm.doc.passengers || []).find(p => p.passenger === values.passenger);
						if (existingPassenger) {
							frappe.msgprint(`Passenger ${values.passenger} already exists in this booking.`);
							return;
						}
						
						// Add a new passenger row
						const passengerRow = frm.add_child("passengers", {
							passenger: values.passenger
						});
						
						// Fetch passenger name
						frappe.db.get_value('Passenger', values.passenger, 'full_name', function(r) {
							if (r && r.full_name) {
								frappe.model.set_value(passengerRow.doctype, passengerRow.name, 'passenger_name', r.full_name);
							}
							
							// Refresh the form
							frm.refresh_field("passengers");
							
							// Directly add flight segment for this passenger
							add_flight_segment_for_passenger(frm, passengerRow.name);
						});
					},
					"Add Passenger Segment",
					"Add"
				);
			});
		}
		
		// Render passenger segments in a custom HTML section
		render_passenger_segments(frm);
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

// Handle passenger child table events
frappe.ui.form.on('Flight Multi City Passenger', {
	passengers_add: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	passengers_remove: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	passenger: function(frm, cdt, cdn) {
		// Fetch passenger name when passenger is selected
		const row = locals[cdt][cdn];
		if (row.passenger) {
			frappe.db.get_value('Passenger', row.passenger, 'full_name', function(r) {
				if (r && r.full_name) {
					frappe.model.set_value(cdt, cdn, 'passenger_name', r.full_name);
				}
			});
			update_route_summary(frm);
		}
	},
	
	// Add button to add flight segments for this passenger and make segments table visible
	form_render: function(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		if (frm.doc.docstatus === 0) {
			const grid_row = cur_frm.fields_dict.passengers.grid.grid_rows_by_docname[cdn];
			if (grid_row) {
				// Add a button to add flight segments
				if (!$(grid_row.wrapper).find('.add-flight-btn').length) {
					$(grid_row.wrapper).find('.grid-row-check').closest('.row-check').append(
						`<button class="btn btn-xs btn-primary add-flight-btn" data-name="${cdn}">
							Add Flight
						</button>`
					);
					
					$(grid_row.wrapper).find('.add-flight-btn').click(function() {
						const passenger_row_name = $(this).attr('data-name');
						add_flight_segment_for_passenger(frm, passenger_row_name);
						return false; // Prevent event bubbling
					});
				}
				
				// Force open the row to show the segments table
				if (!grid_row.doc.__expanded) {
					grid_row.toggle_view();
				}
				
				// Make sure the segments table is visible
				setTimeout(() => {
					// Find the segments field and make it visible
					const segments_field = $(grid_row.form.wrapper).find('.frappe-control[data-fieldname="segments"]');
					if (segments_field.length) {
						segments_field.show();
						
						// Add a header to make it clear this is the flight segments table
						if (!segments_field.prev('.flight-segments-header').length) {
							segments_field.before(`
								<div class="flight-segments-header" style="margin-top: 15px; margin-bottom: 5px; font-weight: bold;">
									Flight Segments for ${row.passenger_name || row.passenger}
								</div>
							`);
						}
					}
				}, 300);
			}
		}
	}
});

// Handle segment child table events
frappe.ui.form.on('Flight Multi City Segment', {
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

// Function to add flight segment for a specific passenger
function add_flight_segment_for_passenger(frm, passenger_row_name) {
	// Get the passenger row
	const passenger_row = locals["Flight Multi City Passenger"][passenger_row_name];
	if (!passenger_row) return;
	
	frappe.prompt(
		[
			{
				fieldname: "airline",
				label: "Airline",
				fieldtype: "Link",
				options: "Airline",
				reqd: 1
			},
			{
				fieldname: "date_of_travel",
				label: "Date of Travel",
				fieldtype: "Date",
				reqd: 1
			},
			{
				fieldname: "from_location",
				label: "From Location",
				fieldtype: "Link",
				options: "Airport",
				reqd: 1
			},
			{
				fieldname: "to_location",
				label: "To Location",
				fieldtype: "Link",
				options: "Airport",
				reqd: 1
			},
			{
				fieldname: "flight_number",
				label: "Flight Number",
				fieldtype: "Data"
			},
			{
				fieldname: "booking_class",
				label: "Booking Class",
				fieldtype: "Data"
			},
			{
				fieldname: "ticket_number",
				label: "Ticket Number",
				fieldtype: "Data"
			},
			{
				fieldname: "pnr",
				label: "PNR",
				fieldtype: "Data"
			}
		],
		(values) => {
			// Add a new segment row
			const segment = frappe.model.add_child(passenger_row, "segments", "Flight Multi City Segment");
			
			// Set values
			frappe.model.set_value(segment.doctype, segment.name, "airline", values.airline);
			frappe.model.set_value(segment.doctype, segment.name, "date_of_travel", values.date_of_travel);
			frappe.model.set_value(segment.doctype, segment.name, "from_location", values.from_location);
			frappe.model.set_value(segment.doctype, segment.name, "to_location", values.to_location);
			frappe.model.set_value(segment.doctype, segment.name, "flight_number", values.flight_number);
			frappe.model.set_value(segment.doctype, segment.name, "booking_class", values.booking_class);
			
			// Set ticket number and PNR at segment level
			if (values.ticket_number) {
				frappe.model.set_value(segment.doctype, segment.name, "ticket_number", values.ticket_number);
			}
			if (values.pnr) {
				frappe.model.set_value(segment.doctype, segment.name, "pnr", values.pnr);
			}
			
			// Save the form to ensure changes are persisted
			frm.save().then(() => {
				// After saving, make sure the passenger row is expanded
				setTimeout(() => {
					const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[passenger_row_name];
					if (grid_row && !grid_row.doc.__expanded) {
						grid_row.toggle_view();
					}
					
					// Refresh fields and update route summary
					frm.refresh_field("passengers");
					update_route_summary(frm);
					
					// Re-render the passenger segments in the custom HTML view
					render_passenger_segments(frm);
					
					// Show success message
					frappe.show_alert({
						message: `Flight segment added for ${passenger_row.passenger_name || passenger_row.passenger}`,
						indicator: 'green'
					}, 5);
				}, 500);
			});
		},
		"Add Flight Segment",
		"Add"
	);
}

function render_passenger_segments(frm) {
	const wrapper = frm.get_field('passenger_segments_html').$wrapper;
	wrapper.empty();
	
	if (!frm.doc.passengers || frm.doc.passengers.length === 0) {
		wrapper.html('<div class="text-muted">No passengers added yet</div>');
		return;
	}
	
	// Create a container for all passengers
	const container = $('<div class="passenger-segments-container"></div>');
	wrapper.append(container);
	
	// Add CSS styles
	const styles = `
		<style>
			.passenger-segments-container {
				margin-bottom: 20px;
			}
			.passenger-card {
				border: 1px solid #d1d8dd;
				border-radius: 4px;
				margin-bottom: 15px;
				background-color: #f9f9f9;
			}
			.passenger-header {
				padding: 10px 15px;
				background-color: #f0f4f7;
				border-bottom: 1px solid #d1d8dd;
				font-weight: bold;
				display: flex;
				justify-content: space-between;
				align-items: center;
			}
			.passenger-segments {
				padding: 0;
			}
			.segment-table {
				width: 100%;
				border-collapse: collapse;
			}
			.segment-table th {
				background-color: #eef1f5;
				padding: 8px;
				text-align: left;
				border-bottom: 1px solid #d1d8dd;
				font-weight: bold;
			}
			.segment-table td {
				padding: 8px;
				border-bottom: 1px solid #e3e8ee;
			}
			.segment-table tr:last-child td {
				border-bottom: none;
			}
			.add-segment-btn {
				margin: 10px 15px;
			}
			.no-segments {
				padding: 15px;
				text-align: center;
				color: #8d99a6;
			}
		</style>
	`;
	container.append(styles);
	
	// Render each passenger and their segments
	frm.doc.passengers.forEach(passenger => {
		const passengerCard = $(`<div class="passenger-card" data-passenger="${passenger.name}"></div>`);
		container.append(passengerCard);
		
		// Passenger header
		const passengerHeader = $(`
			<div class="passenger-header">
				<div>${passenger.passenger_name || passenger.passenger}</div>
			</div>
		`);
		passengerCard.append(passengerHeader);
		
		// Passenger segments
		const passengerSegments = $('<div class="passenger-segments"></div>');
		passengerCard.append(passengerSegments);
		
		if (!passenger.segments || passenger.segments.length === 0) {
			passengerSegments.append('<div class="no-segments">No flight segments added yet</div>');
		} else {
			// Create table for segments
			const table = $(`
				<table class="segment-table">
					<thead>
						<tr>
							<th>Airline</th>
							<th>From</th>
							<th>To</th>
							<th>Date</th>
							<th>Flight #</th>
							<th>Class</th>
							<th>Ticket #</th>
							<th>PNR</th>
						</tr>
					</thead>
					<tbody></tbody>
				</table>
			`);
			passengerSegments.append(table);
			
			// Add segments to table
			passenger.segments.forEach(segment => {
				const row = $(`
					<tr>
						<td>${segment.airline || ''}</td>
						<td>${segment.from_location || ''}</td>
						<td>${segment.to_location || ''}</td>
						<td>${segment.date_of_travel ? frappe.datetime.str_to_user(segment.date_of_travel) : ''}</td>
						<td>${segment.flight_number || ''}</td>
						<td>${segment.booking_class || ''}</td>
						<td>${segment.ticket_number || ''}</td>
						<td>${segment.pnr || ''}</td>
					</tr>
				`);
				table.find('tbody').append(row);
			});
		}
		
		// Add segment button
		if (frm.doc.docstatus === 0) {
			const addButton = $(`<button class="btn btn-xs btn-default add-segment-btn">Add Flight</button>`);
			passengerCard.append(addButton);
			
			addButton.on('click', () => {
				add_flight_segment_for_passenger(frm, passenger.name);
			});
		}
	});
}

function update_route_summary(frm) {
	if (!frm.doc.passengers || frm.doc.passengers.length === 0) {
		frm.set_value('route_summary', '');
		return;
	}
	
	// Build route summary for each passenger
	const passengerRoutes = [];
	
	frm.doc.passengers.forEach(passenger => {
		if (!passenger.segments || passenger.segments.length === 0) return;
		
		const routes = passenger.segments
			.filter(segment => segment.from_location && segment.to_location)
			.map(segment => {
				let routeInfo = `${segment.from_location}-${segment.to_location}`;
				
				// Add flight number if available
				if (segment.flight_number) {
					routeInfo += ` (${segment.flight_number})`;
				}
				
				// Add date if available
				if (segment.date_of_travel) {
					const formattedDate = frappe.datetime.str_to_user(segment.date_of_travel);
					routeInfo += ` on ${formattedDate}`;
				}
				
				return routeInfo;
			});
		
		if (routes.length > 0) {
			passengerRoutes.push(`${passenger.passenger_name || passenger.passenger}: ${routes.join(' / ')}`);
		}
	});
	
	frm.set_value('route_summary', passengerRoutes.join(' | '));
}
