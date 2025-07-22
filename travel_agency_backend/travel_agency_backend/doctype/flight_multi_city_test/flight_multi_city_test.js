// Copyright (c) 2023, Shakeel Viam and contributors
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
		}
		
		// Add Passenger button in draft state
		if (frm.doc.docstatus === 0) {
			frm.add_custom_button(__('Add Passenger'), function() {
				// Prompt for passenger selection
				frappe.prompt([
					{
						fieldname: 'passenger',
						label: 'Passenger',
						fieldtype: 'Link',
						options: 'Passenger',
						reqd: 1
					}
				], function(values) {
					// Check if passenger already exists
					const existingPassenger = (frm.doc.passengers || []).find(p => p.passenger === values.passenger);
					if (existingPassenger) {
						frappe.msgprint(`Passenger ${values.passenger} already exists in this booking.`);
						return;
					}
					
					// Add passenger to the list
					const passenger = frappe.model.add_child(frm.doc, 'Flight Multi City Passenger', 'passengers');
					passenger.passenger = values.passenger;
					
					// Fetch passenger name
					frappe.db.get_value('Passenger', values.passenger, 'full_name', function(r) {
						if (r && r.full_name) {
							frappe.model.set_value(passenger.doctype, passenger.name, 'passenger_name', r.full_name);
						}
						
						// Show the sections
						frm.set_df_property("flight_multicity_section", "hidden", 0);
						frm.set_df_property("service_details_section", "hidden", 0);
						frm.set_df_property("passengers", "hidden", 0);
						
						// Add an empty segment for this passenger
						const segment = frappe.model.add_child(passenger, 'Flight Multi City Segment', 'segments');
						
						// Refresh fields
						frm.refresh_field("passengers");
						
						// Save the form to ensure changes are persisted
						frm.save().then(() => {
							// Update route summary
							update_route_summary(frm);
							
							// Show success message
							frappe.show_alert({
								message: `Passenger ${r.full_name || values.passenger} added with empty flight segment`,
								indicator: 'green'
							}, 5);
						});
					});
				}, 'Add Passenger', 'Add');
			}).addClass('btn-primary');
		}
		
		// Add Create Invoice buttons if submitted
		if (frm.doc.docstatus === 1) {
			// Check if invoices already exist
			const salesInvoiceExists = frm.doc.sales_invoice_id;
			const purchaseInvoiceExists = frm.doc.purchase_invoice_ids && frm.doc.purchase_invoice_ids.length > 0;
			
			// Create group for invoice creation buttons
			const createGroup = __('Create');
			
			// Set button color based on invoice existence
			if (!salesInvoiceExists) {
				// Add Sales Invoice button (red if no invoice exists)
				frm.add_custom_button(__('Sales Invoice'), function() {
					frappe.model.open_mapped_doc({
						method: "travel_agency_backend.travel_agency_backend.doctype.flight_multi_city_test.flight_multi_city_test.make_sales_invoice",
						frm: frm,
						callback: function(doc) {
							// Refresh the form after invoice creation
							frm.reload_doc();
						}
					});
				}, createGroup).addClass('btn-danger');
			} else {
				// Add View Sales Invoice button
				frm.add_custom_button(__('View Sales Invoice'), function() {
					frappe.set_route('Form', 'Sales Invoice', frm.doc.sales_invoice_id);
				}, __('View'));
			}
			
			if (!purchaseInvoiceExists) {
				// Add Purchase Invoice button
				frm.add_custom_button(__('Purchase Invoice'), function() {
					frappe.model.open_mapped_doc({
						method: "travel_agency_backend.travel_agency_backend.doctype.flight_multi_city_test.flight_multi_city_test.make_purchase_invoice",
						frm: frm,
						callback: function(doc) {
							// Refresh the form after invoice creation
							frm.reload_doc();
						}
					});
				}, createGroup).addClass('btn-danger');
			} else {
				// Add View Purchase Invoice button
				frm.add_custom_button(__('View Purchase Invoice'), function() {
					// Open the first purchase invoice in the list
					if (frm.doc.purchase_invoice_ids && frm.doc.purchase_invoice_ids.length > 0) {
						frappe.set_route('Form', 'Purchase Invoice', frm.doc.purchase_invoice_ids[0]);
					}
				}, __('View'));
			}
		}
		
		// Make sure all passenger rows are expanded and their flight segments are visible
		if (frm.doc.passengers && frm.doc.passengers.length > 0) {
			frm.doc.passengers.forEach(function(passenger) {
				if (frm.fields_dict.passengers.grid.grid_rows_by_docname[passenger.name]) {
					// Open the passenger row to show segments
					frm.fields_dict.passengers.grid.grid_rows_by_docname[passenger.name].toggle_view(true);
				}
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

// Add event handlers for passenger child table
frappe.ui.form.on('Flight Multi City Passenger', {
	passenger: function(frm, cdt, cdn) {
		// Fetch passenger name when passenger is selected
		let row = locals[cdt][cdn];
		if (row.passenger) {
			frappe.db.get_value('Passenger', row.passenger, 'full_name', function(r) {
				if (r && r.full_name) {
					frappe.model.set_value(cdt, cdn, 'passenger_name', r.full_name);
					frm.refresh_field('passengers');
				}
			});
		}
	},
	
	form_render: function(frm, cdt, cdn) {
		// Add segment buttons when passenger row is rendered
		let row = locals[cdt][cdn];
		let grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[cdn];
		
		if (grid_row && frm.doc.docstatus === 0) {
			// Add button to add segment
			grid_row.add_custom_button(
				__('Add Flight Segment'),
				function() {
					// Add a new segment to this passenger
					const segment = frappe.model.add_child(row, 'Flight Multi City Segment', 'segments');
					frm.refresh_field('passengers');
					
					// Open dialog to edit segment details
					edit_flight_segment(frm, segment.doctype, segment.name, row.name);
				}
			).addClass('btn-primary');
		}
		
		// Always ensure the segments field is visible and row is open
		if (grid_row) {
			// Force the row to be open
			grid_row.toggle_view(true, true); // Force open
			
			// Make segments field visible
			if (grid_row.fields_dict.segments) {
				grid_row.fields_dict.segments.df.hidden = 0;
				grid_row.fields_dict.segments.$wrapper.show();
				
				// Expand the segments grid to show all rows
				if (grid_row.fields_dict.segments.grid) {
					grid_row.fields_dict.segments.grid.grid_pagination.page_length = 50; // Show more rows
					grid_row.fields_dict.segments.grid.refresh();
				}
			}
		}
		
		// Make sure all segment fields are visible
		if (row.segments && row.segments.length > 0 && grid_row && grid_row.fields_dict.segments) {
			const segments_grid = grid_row.fields_dict.segments.grid;
			if (segments_grid && segments_grid.grid_rows) {
				segments_grid.grid_rows.forEach(segment_row => {
					// Ensure all fields are visible for each segment
					const fields = ['airline', 'from_location', 'to_location', 'date_of_travel', 
						'flight_number', 'booking_class', 'ticket_number', 'pnr'];
					fields.forEach(field => {
						if (segment_row.columns_dict && segment_row.columns_dict[field]) {
							segment_row.columns_dict[field].df.hidden = 0;
							segment_row.columns_dict[field].$wrapper.show();
						}
					});
					
					// Force refresh of segment row
					segment_row.refresh();
				});
			}
		}
		
		// Force refresh after a short delay to ensure UI updates
		setTimeout(() => {
			frm.refresh_field('passengers');
		}, 200);
	},
	
	passengers_add: function(frm, cdt, cdn) {
		// Show flight section when passenger is added
		frm.set_df_property("flight_multicity_section", "hidden", 0);
		frm.set_df_property("service_details_section", "hidden", 0);
		frm.set_df_property("passengers", "hidden", 0);
		
		// Update route summary
		update_route_summary(frm);
	},
	
	passengers_remove: function(frm, cdt, cdn) {
		// Hide sections if no passengers remain
		if (!frm.doc.passengers || frm.doc.passengers.length === 0) {
			frm.set_df_property("flight_multicity_section", "hidden", 1);
			frm.set_df_property("service_details_section", "hidden", 1);
			frm.set_df_property("passengers", "hidden", 1);
		}
		
		// Update route summary
		update_route_summary(frm);
	}
});

// Add event handlers for segment child table
frappe.ui.form.on('Flight Multi City Segment', {
	form_render: function(frm, cdt, cdn) {
		// Add edit/delete buttons when segment row is rendered
		let row = locals[cdt][cdn];
		let parent_row = locals["Flight Multi City Passenger"][row.parent];
		let grid_row = null;
		
		// Find the parent grid row first
		let parent_grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[row.parent];
		if (parent_grid_row && parent_grid_row.fields_dict.segments) {
			// Now find the segment grid row
			grid_row = parent_grid_row.fields_dict.segments.grid.grid_rows_by_docname[cdn];
		}
		
		if (grid_row && frm.doc.docstatus === 0) {
			// Add edit button
			grid_row.add_custom_button(
				__('Edit'),
				function() {
					// Open dialog to edit segment details
					edit_flight_segment(frm, cdt, cdn, row.parent);
				}
			);
			
			// Add delete button
			grid_row.add_custom_button(
				__('Delete'),
				function() {
					// Confirm before deleting
					frappe.confirm(
						__('Are you sure you want to delete this flight segment?'),
						function() {
							// Delete the segment
							frappe.model.clear_doc(cdt, cdn);
							frm.refresh_field('passengers');
							update_route_summary(frm);
							
							// Show success message
							frappe.show_alert({
								message: __('Flight segment deleted'),
								indicator: 'green'
							}, 5);
						}
					);
				}
			);
		}
		
		// Ensure all fields are visible for this segment
		if (grid_row) {
			// Make all fields visible
			const fields = ['airline', 'from_location', 'to_location', 'date_of_travel', 
				'flight_number', 'booking_class', 'ticket_number', 'pnr'];
			
			fields.forEach(field => {
				if (grid_row.columns_dict[field]) {
					grid_row.columns_dict[field].df.hidden = 0;
					grid_row.columns_dict[field].$wrapper.show();
				}
			});
			
			// Force grid to refresh
			setTimeout(() => {
				grid_row.refresh();
			}, 100);
		}
	},
	
	segments_add: function(frm, cdt, cdn) {
		// Update route summary when segment is added
		update_route_summary(frm);
	},
	
	segments_remove: function(frm, cdt, cdn) {
		// Update route summary when segment is removed
		update_route_summary(frm);
	},
	
	from_location: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	to_location: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	flight_number: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	date_of_travel: function(frm, cdt, cdn) {
		update_route_summary(frm);
	}
});

// Function to edit flight segment
function edit_flight_segment(frm, cdt, cdn, parent_name) {
	let row = locals[cdt][cdn];
	let parent_row = locals["Flight Multi City Passenger"][parent_name];
	
	// Create dialog with all segment fields
	frappe.prompt([
		{
			fieldname: 'airline',
			label: 'Airline',
			fieldtype: 'Link',
			options: 'Airline Master',
			default: row.airline || ''
		},
		{
			fieldname: 'date_of_travel',
			label: 'Date of Travel',
			fieldtype: 'Date',
			default: row.date_of_travel || frappe.datetime.get_today(),
			reqd: 1
		},
		{
			fieldname: 'from_location',
			label: 'From Location',
			fieldtype: 'Link',
			options: 'Sector Master',
			default: row.from_location || '',
			reqd: 1
		},
		{
			fieldname: 'to_location',
			label: 'To Location',
			fieldtype: 'Link',
			options: 'Sector Master',
			default: row.to_location || '',
			reqd: 1
		},
		{
			fieldname: 'flight_number',
			label: 'Flight Number',
			fieldtype: 'Data',
			default: row.flight_number || ''
		},
		{
			fieldname: 'booking_class',
			label: 'Booking Class',
			fieldtype: 'Data',
			default: row.booking_class || ''
		},
		{
			fieldname: 'ticket_number',
			label: 'Ticket Number',
			fieldtype: 'Data',
			default: row.ticket_number || ''
		},
		{
			fieldname: 'pnr',
			label: 'PNR',
			fieldtype: 'Data',
			default: row.pnr || ''
		}
	], function(values) {
		// Update segment with values from dialog
		frappe.model.set_value(cdt, cdn, 'airline', values.airline);
		frappe.model.set_value(cdt, cdn, 'date_of_travel', values.date_of_travel);
		frappe.model.set_value(cdt, cdn, 'from_location', values.from_location);
		frappe.model.set_value(cdt, cdn, 'to_location', values.to_location);
		frappe.model.set_value(cdt, cdn, 'flight_number', values.flight_number);
		frappe.model.set_value(cdt, cdn, 'booking_class', values.booking_class);
		frappe.model.set_value(cdt, cdn, 'ticket_number', values.ticket_number);
		frappe.model.set_value(cdt, cdn, 'pnr', values.pnr);
		
		// Refresh fields and update route summary
		frm.refresh_field('passengers');
		update_route_summary(frm);
		
		// Save the form to ensure changes are persisted
		frm.save().then(() => {
			// Show success message
			frappe.show_alert({
				message: __('Flight segment updated'),
				indicator: 'green'
			}, 5);
		});
	}, __('Edit Flight Segment'), __('Update'));
}

// Function to update route summary
function update_route_summary(frm) {
	if (!frm.doc.passengers || frm.doc.passengers.length === 0) {
		frm.set_value('route_summary', '');
		return;
	}
	
	const passengerRoutes = [];
	frm.doc.passengers.forEach(passenger => {
		if (!passenger.segments || passenger.segments.length === 0) return;
		
		const routes = passenger.segments
			.filter(segment => segment.from_location && segment.to_location)
			.map(segment => {
				let routeInfo = `${segment.from_location}-${segment.to_location}`;
				if (segment.flight_number) {
					routeInfo += ` (${segment.flight_number})`;
				}
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

// Function to calculate total amount
function calculate_total(frm) {
	const supplier_cost = flt(frm.doc.supplier_cost || 0);
	const markup = flt(frm.doc.markup || 0);
	const commission = flt(frm.doc.commission || 0);
	
	// Calculate total amount
	const total_amount = supplier_cost + markup - commission;
	frm.set_value('total_amount', total_amount);
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
			fieldtype: 'Date',
			reqd: 1
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
				
				// Make sure all segment fields are visible
				const segments_grid = grid_row.fields_dict.segments.grid;
				if (segments_grid && segments_grid.grid_rows) {
					segments_grid.grid_rows.forEach(segment_row => {
						// Ensure all fields are visible for each segment
						const fields = ['airline', 'from_location', 'to_location', 'date_of_travel', 
							'flight_number', 'booking_class', 'ticket_number', 'pnr'];
						fields.forEach(field => {
							segment_row.toggle_display(field, true);
						});
					});
				}
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
			reqd: 1,
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
				
				// Make sure all segment fields are visible
				const segments_grid = grid_row.fields_dict.segments.grid;
				if (segments_grid && segments_grid.grid_rows) {
					segments_grid.grid_rows.forEach(segment_row => {
						// Ensure all fields are visible for each segment
						const fields = ['airline', 'from_location', 'to_location', 'date_of_travel', 
							'flight_number', 'booking_class', 'ticket_number', 'pnr'];
						fields.forEach(field => {
							segment_row.toggle_display(field, true);
						});
					});
				}
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
					
					// Make sure all remaining segment fields are visible
					const segments_grid = grid_row.fields_dict.segments.grid;
					if (segments_grid && segments_grid.grid_rows) {
						segments_grid.grid_rows.forEach(segment_row => {
							// Ensure all fields are visible for each segment
							const fields = ['airline', 'from_location', 'to_location', 'date_of_travel', 
								'flight_number', 'booking_class', 'ticket_number', 'pnr'];
							fields.forEach(field => {
								segment_row.toggle_display(field, true);
							});
						});
					}
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
