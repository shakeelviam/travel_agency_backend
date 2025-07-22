// Copyright (c) 2025, Travel Agency and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Multi City Test', {
	refresh: function(frm) {
		// Only show the basic fields initially
		// Hide all sections except basic fields
		if (!frm.doc.passengers || frm.doc.passengers.length === 0) {
			// Hide all sections except the basic fields
			frm.set_df_property("section_break_6", "hidden", 1);
			frm.set_df_property("section_break_12", "hidden", 1);
			frm.set_df_property("section_break_14", "hidden", 1);
			frm.set_df_property("passenger_segments_section", "hidden", 1);
		}
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
							
							// Add an empty flight segment row for this passenger
							const segment = frappe.model.add_child(passengerRow, 'segments', 'Flight Multi City Segment');
							
							// Save the form to ensure changes are persisted
							frm.save().then(() => {
								// After saving, render the passenger segments
								render_passenger_segments(frm);
								
								// Update route summary
								update_route_summary(frm);
								
								// Show success message
								frappe.show_alert({
									message: `Passenger ${r.full_name || values.passenger} added with empty flight segment`,
									indicator: 'green'
								}, 5);
							});
						});
					},
					"Add Passenger Segment",
					"Add"
				);
			}).addClass('btn-primary');
		}
		
		// Make sure the passenger_segments_html field is visible
		frm.set_df_property("passenger_segments_html", "hidden", 0);
		
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
	// Find the passenger row
	const passenger_row = frm.doc.passengers.find(p => p.name === passenger_row_name);
	if (!passenger_row) {
		frappe.msgprint("Passenger not found.");
		return;
	}
	
	// Create dialog to add flight segment
	frappe.prompt([
		{
			fieldname: 'airline',
			label: 'Airline',
			fieldtype: 'Link',
			options: 'Airline Master'
		},
		{
			fieldname: 'from_location',
			label: 'From Location',
			fieldtype: 'Link',
			options: 'Sector Master',
			reqd: 1
		},
		{
			fieldname: 'to_location',
			label: 'To Location',
			fieldtype: 'Link',
			options: 'Sector Master',
			reqd: 1
		},
		{
			fieldname: 'date_of_travel',
			label: 'Date of Travel',
			fieldtype: 'Date'
		},
		{
			fieldname: 'flight_number',
			label: 'Flight Number',
			fieldtype: 'Data'
		},
		{
			fieldname: 'booking_class',
			label: 'Booking Class',
			fieldtype: 'Data'
		},
		{
			fieldname: 'ticket_number',
			label: 'Ticket Number',
			fieldtype: 'Data'
		},
		{
			fieldname: 'pnr',
			label: 'PNR',
			fieldtype: 'Data'
		}
	], (values) => {
		// Add segment to the passenger
		const segment = frappe.model.add_child(passenger_row, 'segments', 'Flight Multi City Segment');
		segment.airline = values.airline;
		segment.from_location = values.from_location;
		segment.to_location = values.to_location;
		segment.date_of_travel = values.date_of_travel;
		segment.flight_number = values.flight_number;
		segment.booking_class = values.booking_class;
		segment.ticket_number = values.ticket_number;
		segment.pnr = values.pnr;
		
		// Save the form to ensure changes are persisted
		frm.save().then(() => {
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
		});
	}, 'Add Flight Segment', 'Add');
}

function render_passenger_segments(frm) {
	if (!frm.doc.passengers || frm.doc.passengers.length === 0) {
		frm.set_df_property('passenger_segments_html', 'options', '<div class="text-muted">No passengers added yet</div>');
		return;
	}
	
	// Build HTML for each passenger's segments
	let html = '<div class="passenger-segments-wrapper">';
	
	frm.doc.passengers.forEach(passenger => {
		// Add passenger header with clear styling
		html += `
			<div class="passenger-segments-container" style="margin-bottom: 30px; border: 1px solid #d1d8dd; border-radius: 4px; padding: 15px; background-color: #f9f9f9;">
				<h4 style="margin-top: 0; padding-bottom: 10px; border-bottom: 1px solid #d1d8dd;">
					<i class="fa fa-user"></i> ${passenger.passenger_name || passenger.passenger}
				</h4>
		`;
		
		// Add segments table with better styling
		html += `
			<div class="table-responsive">
				<table class="table table-bordered table-hover" style="background-color: white;">
					<thead>
						<tr>
							<th style="width: 12%;">Airline</th>
							<th style="width: 12%;">Date of Travel</th>
							<th style="width: 12%;">From</th>
							<th style="width: 12%;">To</th>
							<th style="width: 10%;">Flight #</th>
							<th style="width: 8%;">Class</th>
							<th style="width: 12%;">Ticket #</th>
							<th style="width: 10%;">PNR</th>
							<th style="width: 12%;">Actions</th>
						</tr>
					</thead>
					<tbody>
		`;
		
		// Add segment rows
		if (passenger.segments && passenger.segments.length > 0) {
			passenger.segments.forEach(segment => {
				html += `
					<tr>
						<td>${segment.airline || ''}</td>
						<td>${segment.date_of_travel ? frappe.datetime.str_to_user(segment.date_of_travel) : ''}</td>
						<td>${segment.from_location || ''}</td>
						<td>${segment.to_location || ''}</td>
						<td>${segment.flight_number || ''}</td>
						<td>${segment.booking_class || ''}</td>
						<td>${segment.ticket_number || ''}</td>
						<td>${segment.pnr || ''}</td>
						<td>
							<button class="btn btn-xs btn-default edit-segment-btn" 
								data-passenger="${passenger.name}" 
								data-segment="${segment.name}">
								<i class="fa fa-pencil"></i> Edit
							</button>
							<button class="btn btn-xs btn-danger delete-segment-btn" 
								data-passenger="${passenger.name}" 
								data-segment="${segment.name}">
								<i class="fa fa-trash"></i>
							</button>
						</td>
					</tr>
				`;
			});
		} else {
			// No segments message
			html += `
				<tr>
					<td colspan="9" class="text-center text-muted">
						No flight segments added yet
					</td>
				</tr>
			`;
		}
		
		// Close table
		html += `
					</tbody>
				</table>
			</div>
			
			<div class="row" style="margin-top: 10px;">
				<div class="col-xs-12">
					<button class="btn btn-sm btn-primary add-segment-btn" 
						data-passenger="${passenger.name}">
						<i class="fa fa-plus"></i> Add Flight Segment
					</button>
				</div>
			</div>
		</div>
		`;
	});
	
	html += '</div>';
	
	// Set the HTML content
	frm.set_df_property('passenger_segments_html', 'options', html);
	
	// Add event handlers for the buttons
	setTimeout(() => {
		// Add segment button
		$('.add-segment-btn').on('click', function() {
			const passengerName = $(this).data('passenger');
			add_flight_segment_for_passenger(frm, passengerName);
		});
		
		// Edit segment button
		$('.edit-segment-btn').on('click', function() {
			const passengerName = $(this).data('passenger');
			const segmentName = $(this).data('segment');
			edit_flight_segment(frm, passengerName, segmentName);
		});
		
		// Delete segment button
		$('.delete-segment-btn').on('click', function() {
			const passengerName = $(this).data('passenger');
			const segmentName = $(this).data('segment');
			delete_flight_segment(frm, passengerName, segmentName);
		});
	}, 100);
}

function edit_flight_segment(frm, passenger_row_name, segment_name) {
	// Find the passenger row and segment
	const passenger_row = frm.doc.passengers.find(p => p.name === passenger_row_name);
	if (!passenger_row || !passenger_row.segments) return;
	
	const segment = passenger_row.segments.find(s => s.name === segment_name);
	if (!segment) return;
	
	// Create dialog to edit flight segment
	frappe.prompt([
		{
			fieldname: 'airline',
			label: 'Airline',
			fieldtype: 'Link',
			options: 'Airline',
			default: segment.airline
		},
		{
			fieldname: 'from_location',
			label: 'From Location',
			fieldtype: 'Link',
			options: 'Airport',
			reqd: 1,
			default: segment.from_location
		},
		{
			fieldname: 'to_location',
			label: 'To Location',
			fieldtype: 'Link',
			options: 'Airport',
			reqd: 1,
			default: segment.to_location
		},
		{
			fieldname: 'date_of_travel',
			label: 'Date of Travel',
			fieldtype: 'Date',
			default: segment.date_of_travel
		},
		{
			fieldname: 'flight_number',
			label: 'Flight Number',
			fieldtype: 'Data',
			default: segment.flight_number
		},
		{
			fieldname: 'booking_class',
			label: 'Booking Class',
			fieldtype: 'Data',
			default: segment.booking_class
		},
		{
			fieldname: 'ticket_number',
			label: 'Ticket Number',
			fieldtype: 'Data',
			default: segment.ticket_number
		},
		{
			fieldname: 'pnr',
			label: 'PNR',
			fieldtype: 'Data',
			default: segment.pnr
		}
	], (values) => {
		// Update segment values
		frappe.model.set_value(segment.doctype, segment.name, 'airline', values.airline);
		frappe.model.set_value(segment.doctype, segment.name, 'from_location', values.from_location);
		frappe.model.set_value(segment.doctype, segment.name, 'to_location', values.to_location);
		frappe.model.set_value(segment.doctype, segment.name, 'date_of_travel', values.date_of_travel);
		frappe.model.set_value(segment.doctype, segment.name, 'flight_number', values.flight_number);
		frappe.model.set_value(segment.doctype, segment.name, 'booking_class', values.booking_class);
		frappe.model.set_value(segment.doctype, segment.name, 'ticket_number', values.ticket_number);
		frappe.model.set_value(segment.doctype, segment.name, 'pnr', values.pnr);
		
		// Save the form to ensure changes are persisted
		frm.save().then(() => {
			// Refresh fields and update route summary
			frm.refresh_field("passengers");
			update_route_summary(frm);
			
			// Re-render the passenger segments in the custom HTML view
			render_passenger_segments(frm);
			
			// Show success message
			frappe.show_alert({
				message: `Flight segment updated for ${passenger_row.passenger_name || passenger_row.passenger}`,
				indicator: 'green'
			}, 5);
		});
	}, 'Edit Flight Segment', 'Update');
}

function delete_flight_segment(frm, passenger_row_name, segment_name) {
	// Find the passenger row
	const passenger_row = frm.doc.passengers.find(p => p.name === passenger_row_name);
	if (!passenger_row || !passenger_row.segments) return;
	
	// Confirm deletion
	frappe.confirm(
		`Are you sure you want to delete this flight segment?`,
		() => {
			// Yes - delete the segment
			const segment_idx = passenger_row.segments.findIndex(s => s.name === segment_name);
			if (segment_idx !== -1) {
				passenger_row.segments.splice(segment_idx, 1);
				
				// Save the form to ensure changes are persisted
				frm.save().then(() => {
					// Refresh fields and update route summary
					frm.refresh_field("passengers");
					update_route_summary(frm);
					
					// Re-render the passenger segments in the custom HTML view
					render_passenger_segments(frm);
					
					// Show success message
					frappe.show_alert({
						message: `Flight segment deleted for ${passenger_row.passenger_name || passenger_row.passenger}`,
						indicator: 'green'
					}, 5);
				});
			}
		},
		() => {
			// No - do nothing
		}
	);
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
			})
			.join(' | ');
		
		if (routes) {
			passengerRoutes.push(`${passenger.passenger_name || passenger.passenger}: ${routes}`);
		}
	});
	
	frm.set_value('route_summary', passengerRoutes.join(' || '));
}
