// Copyright (c) 2025, Travel Agency and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Multi City Test', {
	refresh: function(frm) {
		// Clear existing custom buttons to avoid duplicates on refresh
		frm.clear_custom_buttons();
		
		// Hide all sections initially - EVERYTHING is hidden by default
		frm.set_df_property("flight_multicity_section", "hidden", 1);
		frm.set_df_property("service_details_section", "hidden", 1);
		frm.set_df_property("passengers", "hidden", 1);
		
		// Update route summary
		update_route_summary(frm);
		
		// Show sections only if data exists
		if (frm.doc.passengers && frm.doc.passengers.length > 0) {
			frm.set_df_property("flight_multicity_section", "hidden", 0);
			frm.set_df_property("service_details_section", "hidden", 0);
			frm.set_df_property("passengers", "hidden", 0);
			
			// Ensure all passenger segments are visible if they exist
			frm.doc.passengers.forEach(passenger => {
				if (passenger.segments && passenger.segments.length > 0) {
					const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[passenger.name];
					if (grid_row) {
						grid_row.toggle_display('segments', true);
						grid_row.open();
					}
				}
			});
		}
		
		// Add Passenger Segment button in draft state
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
						
						// Unhide the sections before adding data
						frm.set_df_property("flight_multicity_section", "hidden", 0);
						frm.set_df_property("service_details_section", "hidden", 0);
						frm.set_df_property("passengers", "hidden", 0);
						
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
								// Update route summary
								update_route_summary(frm);
								
								// Find the grid row for this passenger to ensure segments are visible
								const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[passengerRow.name];
								if (grid_row) {
									// Make sure the segments field is visible
									grid_row.toggle_display('segments', true);
									grid_row.open();
								}
								
								// Scroll to the passenger table
								frm.scroll_to_field("passengers");
								
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
	
	// Add button to add flight segment for this passenger
	form_render: function(frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		
		// Find the grid row for this passenger
		const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[cdn];
		if (!grid_row) return;
		
		// Add button to add flight segment only if it doesn't exist already
		if (!grid_row.wrapper.find('.add-segment-btn').length) {
			const $add_btn = $(`<button class="btn btn-xs btn-default add-segment-btn">
				<i class="fa fa-plus"></i> Add Flight Segment
			</button>`)
			.appendTo(grid_row.wrapper.find('.data-row .col.col-xs-12'))
			.on('click', function() {
				add_flight_segment_for_passenger(frm, cdn);
				return false;
			});
		}
		
		// Ensure the segments table is visible
		if (row.segments && row.segments.length > 0) {
			// Make sure the segments field is visible
			grid_row.toggle_display('segments', true);
			grid_row.open();
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
	},
	
	airline: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	flight_number: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	date_of_travel: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	// Add edit and delete buttons to each segment row
	form_render: function(frm, cdt, cdn) {
		const segment = locals[cdt][cdn];
		const parent_field = segment.parentfield;
		const parent_name = segment.parent;
		
		// Find the grid row for this segment
		const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[parent_name];
		if (!grid_row) return;
		
		// Find the nested grid row for this segment
		const segment_grid = grid_row.doc.segments;
		if (!segment_grid) return;
		
		// Make sure the parent row is open to show segments
		grid_row.toggle_display('segments', true);
		grid_row.open();
		
		// We need to find the grid row for this specific segment
		const segment_grid_rows = grid_row.fields_dict.segments.grid.grid_rows;
		for (let i = 0; i < segment_grid_rows.length; i++) {
			if (segment_grid_rows[i].doc.name === cdn) {
				const $row = $(segment_grid_rows[i].wrapper);
				
				// Add edit and delete buttons if they don't exist already
				if (!$row.find('.edit-segment-btn').length) {
					const $action_wrapper = $(`<div class="btn-group pull-right" style="margin-top: 3px;"></div>`);
					
					// Edit button
					const $edit_btn = $(`<button class="btn btn-xs btn-default edit-segment-btn">
						<i class="fa fa-pencil"></i>
					</button>`)
					.appendTo($action_wrapper)
					.on('click', function() {
						edit_flight_segment(frm, parent_name, cdn);
						return false;
					});
					
					// Delete button
					const $delete_btn = $(`<button class="btn btn-xs btn-danger delete-segment-btn">
						<i class="fa fa-trash"></i>
					</button>`)
					.appendTo($action_wrapper)
					.on('click', function() {
						delete_flight_segment(frm, parent_name, cdn);
						return false;
					});
					
					$action_wrapper.appendTo($row.find('.row-index'));
				}
				
				// Ensure all fields are visible
				const fields = ['airline', 'from_location', 'to_location', 'date_of_travel', 'flight_number', 'booking_class', 'ticket_number', 'pnr'];
				fields.forEach(field => {
					segment_grid_rows[i].toggle_display(field, true);
				});
				
				break;
			}
		}
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
			
			// Find the grid row for this passenger to ensure segments are visible
			const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[passenger_row_name];
			if (grid_row) {
				// Make sure the segments field is visible
				grid_row.toggle_display('segments', true);
				grid_row.open();
			}
			
			// Show success message
			frappe.show_alert({
				message: `Flight segment added for ${passenger_row.passenger_name || passenger_row.passenger}`,
				indicator: 'green'
			}, 5);
		});
	}, 'Add Flight Segment', 'Add');
}

// We're using standard Frappe UI - no need for custom HTML rendering

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
			options: 'Airline Master',
			default: segment.airline
		},
		{
			fieldname: 'from_location',
			label: 'From Location',
			fieldtype: 'Link',
			options: 'Sector Master',
			reqd: 1,
			default: segment.from_location
		},
		{
			fieldname: 'to_location',
			label: 'To Location',
			fieldtype: 'Link',
			options: 'Sector Master',
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
			
			// Find the grid row for this passenger to ensure segments are visible
			const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[passenger_row_name];
			if (grid_row) {
				// Make sure the segments field is visible
				grid_row.toggle_display('segments', true);
				grid_row.open();
			}
			
			// Show success message
			frappe.show_alert({
				message: `Flight segment updated for ${passenger_row.passenger_name || passenger_row.passenger}`,
				indicator: 'green'
			}, 5);
		});
	}, 'Edit Flight Segment', 'Update');
}

// Function to delete a flight segment
function delete_flight_segment(frm, parent_name, segment_name) {
	// Find the passenger row
	const passenger_row = frm.doc.passengers.find(p => p.name === parent_name);
	if (!passenger_row) {
		frappe.msgprint("Passenger not found.");
		return;
	}
	
	// Find the segment index
	const segment_index = passenger_row.segments.findIndex(s => s.name === segment_name);
	if (segment_index === -1) {
		frappe.msgprint("Flight segment not found.");
		return;
	}
	
	// Confirm deletion
	frappe.confirm(
		`Are you sure you want to delete this flight segment?`,
		function() {
			// Remove the segment
			frappe.model.clear_doc("Flight Multi City Segment", segment_name);
			
			// Save the form to ensure changes are persisted
			frm.save().then(() => {
				// Refresh fields and update route summary
				frm.refresh_field("passengers");
				update_route_summary(frm);
				
				// Find the grid row for this passenger to ensure it stays open
				const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[parent_name];
				if (grid_row) {
					// Make sure the segments field is visible and row is open
					grid_row.toggle_display('segments', true);
					grid_row.open();
				}
				
				// Show success message
				frappe.show_alert({
					message: `Flight segment deleted for ${passenger_row.passenger_name || passenger_row.passenger}`,
					indicator: 'green'
				}, 5);
			});
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
