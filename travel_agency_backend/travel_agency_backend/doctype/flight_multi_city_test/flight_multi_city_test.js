// Copyright (c) 2023, Shakeel Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Multi City Test', {
	refresh: function(frm) {
		// Clear existing custom buttons to avoid duplicates on refresh
		frm.clear_custom_buttons();
		
		// Hide all sections initially
		frm.set_df_property("flight_multicity_section", "hidden", 1);
		frm.set_df_property("service_details_section", "hidden", 1);
		
		// Update route summary
		update_route_summary(frm);
		
		// Show sections if there are passengers
		if (frm.doc.passengers && frm.doc.passengers.length > 0) {
			frm.set_df_property("flight_multicity_section", "hidden", 0);
			frm.set_df_property("service_details_section", "hidden", 0);
		}
		
		// Add Passenger button in draft state
		if (frm.doc.docstatus === 0) {
			frm.add_custom_button(__('Add Passenger'), function() {
				add_new_passenger(frm);
			}).addClass('btn-primary');
			
			// Add Create Invoice button
			frm.add_custom_button(__('Create Invoice'), function() {
				create_invoice(frm);
			});
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
	},
	
	customer: function(frm) {
		// Update customer-related fields if needed
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
		const row = locals[cdt][cdn];
		if (row.passenger) {
			frappe.db.get_value('Passenger', row.passenger, 'full_name', function(r) {
				if (r && r.full_name) {
					frappe.model.set_value(cdt, cdn, 'passenger_name', r.full_name);
					frm.refresh_field('passengers');
				}
			});
		}
		update_route_summary(frm);
	},
	
	passengers_add: function(frm, cdt, cdn) {
		// When a new passenger is added, make sure to show the segments field
		update_route_summary(frm);
	},
	
	passengers_remove: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	form_render: function(frm, cdt, cdn) {
		// This event fires when the form for a row in the grid is rendered
		// We can use it to add custom buttons to each passenger row
		const row = locals[cdt][cdn];
		
		// Find the grid row
		const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[cdn];
		if (grid_row) {
			// Add a button to add flight segments for this passenger
			if (!grid_row.add_segment_button_added && frm.doc.docstatus === 0) {
				const wrapper = grid_row.row.find('.static-area');
				
				// Create a button element
				const button = document.createElement('button');
				button.className = 'btn btn-xs btn-default';
				button.innerHTML = 'Add Flight Segment';
				button.onclick = function() {
					add_flight_segment_for_passenger(frm, cdn);
					return false;
				};
				
				// Append the button to the wrapper
				wrapper.append(button);
				
				// Mark that we've added the button
				grid_row.add_segment_button_added = true;
			}
		}
	}
});

// Add event handlers for segment child table
frappe.ui.form.on('Flight Multi City Segment', {
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
	},
	
	segments_add: function(frm, cdt, cdn) {
		update_route_summary(frm);
	},
	
	segments_remove: function(frm, cdt, cdn) {
		update_route_summary(frm);
	}
});

// Function to add a new passenger
function add_new_passenger(frm) {
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
		const passengerExists = frm.doc.passengers && frm.doc.passengers.some(p => p.passenger === values.passenger);
		
		if (passengerExists) {
			frappe.msgprint(__(`Passenger ${values.passenger} already added.`));
			return;
		}
		
		// Add passenger to the table
		const passenger = frappe.model.add_child(frm.doc, 'Flight Multi City Passenger', 'passengers');
		passenger.passenger = values.passenger;
		
		// Fetch passenger name
		frappe.db.get_value('Passenger', values.passenger, 'full_name', function(r) {
			if (r && r.full_name) {
				passenger.passenger_name = r.full_name;
			}
			
			// Save the form to ensure changes are persisted
			frm.save().then(() => {
				// Refresh fields and update route summary
				frm.refresh_field("passengers");
				update_route_summary(frm);
				
				// Show success message
				frappe.show_alert({
					message: __(`Passenger ${passenger.passenger_name || passenger.passenger} added`),
					indicator: 'green'
				}, 5);
				
				// Open the passenger row and prompt to add a flight segment
				setTimeout(() => {
					const grid_row = frm.fields_dict.passengers.grid.grid_rows_by_docname[passenger.name];
					if (grid_row) {
						grid_row.toggle_view(true); // Open the row
						
						// Ask if they want to add a flight segment
						frappe.confirm(
							__('Do you want to add a flight segment for this passenger?'),
							function() {
								// Yes - add flight segment
								add_flight_segment_for_passenger(frm, passenger.name);
							}
						);
					}
				}, 500);
			});
		});
	}, __('Add Passenger'), __('Add'));
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
	}, __('Add Flight Segment'), __('Add'));
}

// Function to edit flight segment
function edit_flight_segment(frm, passenger_row_name, segment_name) {
	// Find the passenger row
	const passenger_row = frm.doc.passengers.find(p => p.name === passenger_row_name);
	if (!passenger_row) {
		frappe.msgprint("Passenger not found.");
		return;
	}
	
	// Find the segment
	const segment = passenger_row.segments.find(s => s.name === segment_name);
	if (!segment) {
		frappe.msgprint("Flight segment not found.");
		return;
	}
	
	// Create dialog with all segment fields
	frappe.prompt([
		{
			fieldname: 'airline',
			label: 'Airline',
			fieldtype: 'Link',
			options: 'Airline Master',
			default: segment.airline || ''
		},
		{
			fieldname: 'date_of_travel',
			label: 'Date of Travel',
			fieldtype: 'Date',
			default: segment.date_of_travel || frappe.datetime.get_today(),
			reqd: 1
		},
		{
			fieldname: 'from_location',
			label: 'From Location',
			fieldtype: 'Link',
			options: 'Sector Master',
			default: segment.from_location || '',
			reqd: 1
		},
		{
			fieldname: 'to_location',
			label: 'To Location',
			fieldtype: 'Link',
			options: 'Sector Master',
			default: segment.to_location || '',
			reqd: 1
		},
		{
			fieldname: 'flight_number',
			label: 'Flight Number',
			fieldtype: 'Data',
			default: segment.flight_number || ''
		},
		{
			fieldname: 'booking_class',
			label: 'Booking Class',
			fieldtype: 'Data',
			default: segment.booking_class || ''
		},
		{
			fieldname: 'ticket_number',
			label: 'Ticket Number',
			fieldtype: 'Data',
			default: segment.ticket_number || ''
		},
		{
			fieldname: 'pnr',
			label: 'PNR',
			fieldtype: 'Data',
			default: segment.pnr || ''
		}
	], function(values) {
		// Update segment with values from dialog
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'airline', values.airline);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'date_of_travel', values.date_of_travel);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'from_location', values.from_location);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'to_location', values.to_location);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'flight_number', values.flight_number);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'booking_class', values.booking_class);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'ticket_number', values.ticket_number);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'pnr', values.pnr);
		
		// Refresh the form
		frm.refresh_field('passengers');
		
		// Update route summary
		update_route_summary(frm);
		
		// Show success message
		frappe.show_alert({
			message: __('Flight segment updated'),
			indicator: 'green'
		}, 5);
	}, __('Edit Flight Segment'), __('Update'));
}

// Function to create invoice
function create_invoice(frm) {
	if (!frm.doc.passengers || frm.doc.passengers.length === 0) {
		frappe.msgprint(__('Please add at least one passenger'));
		return;
	}

	// Check if any passenger has flight segments
	let hasSegments = false;
	for (const passenger of frm.doc.passengers) {
		if (passenger.segments && passenger.segments.length > 0) {
			hasSegments = true;
			break;
		}
	}

	if (!hasSegments) {
		frappe.msgprint(__('Please add at least one flight segment'));
		return;
	}

	// Create dialog to choose invoice type
	frappe.prompt([
		{
			fieldname: 'invoice_type',
			label: 'Invoice Type',
			fieldtype: 'Select',
			options: 'Sales\nPurchase\nBoth',
			default: 'Sales'
		}
	], function(values) {
		if (values.invoice_type === 'Sales' || values.invoice_type === 'Both') {
			// Create sales invoice
			frappe.model.open_mapped_doc({
				method: "travel_agency_backend.travel_agency_backend.doctype.flight_multi_city_test.flight_multi_city_test.make_sales_invoice",
				frm: frm,
				callback: function(doc) {
					frm.reload_doc();
				}
			});
		}

		if (values.invoice_type === 'Purchase' || values.invoice_type === 'Both') {
			// Create purchase invoice
			frappe.model.open_mapped_doc({
				method: "travel_agency_backend.travel_agency_backend.doctype.flight_multi_city_test.flight_multi_city_test.make_purchase_invoice",
				frm: frm,
				callback: function(doc) {
					frm.reload_doc();
				}
			});
		}
	}, __('Create Invoice'), __('Create'));
}

// Function to calculate total
function calculate_total(frm) {
	const supplier_cost = frm.doc.supplier_cost || 0;
	const markup = frm.doc.markup || 0;
	const commission = frm.doc.commission || 0;

	// Calculate total cost
	const total = supplier_cost + markup - commission;
	frm.set_value('total_amount', total);
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
