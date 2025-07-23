// Copyright (c) 2023, Shakeel Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Flight Multi City Test', {
	refresh: function(frm) {
		// Clear existing custom buttons to avoid duplicates on refresh
		frm.clear_custom_buttons();
		
		// Hide all sections initially - EVERYTHING is hidden by default
		frm.set_df_property("flight_multicity_section", "hidden", 1);
		frm.set_df_property("service_details_section", "hidden", 1);
		frm.set_df_property("segments", "hidden", 1);
		
		// Update route summary
		update_route_summary(frm);
		
		// Show sections only if data exists
		if (frm.doc.passenger) {
			frm.set_df_property("flight_multicity_section", "hidden", 0);
			frm.set_df_property("service_details_section", "hidden", 0);
			frm.set_df_property("segments", "hidden", 0);
		}
		
		// Add Flight Segment button in draft state
		if (frm.doc.docstatus === 0 && frm.doc.passenger) {
			frm.add_custom_button(__('Add Flight Segment'), function() {
				// Add a new segment
				const segment = frappe.model.add_child(frm.doc, 'Flight Multi City Segment', 'segments');
				frm.refresh_field('segments');
				
				// Open dialog to edit segment details
				edit_flight_segment(frm, segment.name);
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
	
	passenger: function(frm) {
		// Fetch passenger name when passenger is selected
		if (frm.doc.passenger) {
			frappe.db.get_value('Passenger', frm.doc.passenger, 'full_name', function(r) {
				if (r && r.full_name) {
					frm.set_value('passenger_name', r.full_name);
				}
			});
			
			// Show the sections
			frm.set_df_property("flight_multicity_section", "hidden", 0);
			frm.set_df_property("service_details_section", "hidden", 0);
			frm.set_df_property("segments", "hidden", 0);
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

// Function to edit flight segment
function edit_flight_segment(frm, segment_name) {
	let row = locals['Flight Multi City Segment'][segment_name];
	
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
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'airline', values.airline);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'date_of_travel', values.date_of_travel);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'from_location', values.from_location);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'to_location', values.to_location);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'flight_number', values.flight_number);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'booking_class', values.booking_class);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'ticket_number', values.ticket_number);
		frappe.model.set_value('Flight Multi City Segment', segment_name, 'pnr', values.pnr);
		
		// Refresh the form
		frm.refresh_field('segments');
		
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
	if (!frm.doc.passenger) {
		frappe.msgprint(__('Please select a passenger first'));
		return;
	}

	if (!frm.doc.segments || frm.doc.segments.length === 0) {
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
	frm.set_value('total', total);
}

// Function to update route summary
function update_route_summary(frm) {
	if (!frm.doc.passenger || !frm.doc.segments || frm.doc.segments.length === 0) {
		frm.set_value('route_summary', '');
		return;
	}

	// Get passenger name
	const passengerName = frm.doc.passenger_name || frm.doc.passenger;

	// Build route summary from segments
	const routes = frm.doc.segments
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

	// Set the route summary
	if (routes) {
		frm.set_value('route_summary', `${passengerName}: ${routes}`);
	} else {
		frm.set_value('route_summary', '');
	}
}
