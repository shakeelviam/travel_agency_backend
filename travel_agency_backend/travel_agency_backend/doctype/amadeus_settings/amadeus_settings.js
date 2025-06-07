// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

frappe.ui.form.on('Amadeus Settings', {
	refresh: function(frm) {
		frm.add_custom_button(__('Test Connection'), function() {
			frm.save();
			frappe.call({
				method: 'travel_agency_backend.travel_agency_backend.api.amadeus.test_amadeus_connection',
				callback: function(r) {
					if (r.message && r.message.success) {
						frappe.msgprint({
							title: __('Success'),
							indicator: 'green',
							message: r.message.message
						});
					} else {
						frappe.msgprint({
							title: __('Failed'),
							indicator: 'red',
							message: r.message ? r.message.message : __('Failed to connect to Amadeus API')
						});
					}
				}
			});
		});
		
		frm.add_custom_button(__('Search Flights'), function() {
			if (!frm.doc.api_key || !frm.doc.api_secret) {
				frappe.msgprint(__('Please set API Key and API Secret first'));
				return;
			}
			
			let d = new frappe.ui.Dialog({
				title: __('Search Flights'),
				fields: [
					{
						label: __('Origin'),
						fieldname: 'origin',
						fieldtype: 'Data',
						reqd: 1,
						description: __('Airport code (e.g., LHR)')
					},
					{
						label: __('Destination'),
						fieldname: 'destination',
						fieldtype: 'Data',
						reqd: 1,
						description: __('Airport code (e.g., JFK)')
					},
					{
						label: __('Departure Date'),
						fieldname: 'departure_date',
						fieldtype: 'Date',
						reqd: 1,
						default: frappe.datetime.add_days(frappe.datetime.nowdate(), 7)
					},
					{
						label: __('Trip Type'),
						fieldname: 'trip_type',
						fieldtype: 'Select',
						options: 'One Way\nReturn',
						default: 'One Way',
						onchange: function() {
							let is_return = this.get_value() === 'Return';
							d.set_df_property('return_date', 'hidden', !is_return);
							d.set_df_property('return_date', 'reqd', is_return);
						}
					},
					{
						label: __('Return Date'),
						fieldname: 'return_date',
						fieldtype: 'Date',
						hidden: 1,
						default: frappe.datetime.add_days(frappe.datetime.nowdate(), 14)
					},
					{
						label: __('Passengers'),
						fieldname: 'passengers_section',
						fieldtype: 'Section Break'
					},
					{
						label: __('Adults'),
						fieldname: 'adults',
						fieldtype: 'Int',
						default: 1,
						reqd: 1
					},
					{
						fieldname: 'col_break1',
						fieldtype: 'Column Break'
					},
					{
						label: __('Children'),
						fieldname: 'children',
						fieldtype: 'Int',
						default: 0
					},
					{
						fieldname: 'col_break2',
						fieldtype: 'Column Break'
					},
					{
						label: __('Infants'),
						fieldname: 'infants',
						fieldtype: 'Int',
						default: 0
					},
					{
						fieldname: 'travel_class_section',
						fieldtype: 'Section Break'
					},
					{
						label: __('Travel Class'),
						fieldname: 'travel_class',
						fieldtype: 'Select',
						options: 'ECONOMY\nPREMIUM_ECONOMY\nBUSINESS\nFIRST',
						default: 'ECONOMY'
					}
				],
				primary_action_label: __('Search'),
				primary_action: function(values) {
					d.hide();
					frappe.msgprint(__('Searching for flights...'));
					
					frappe.call({
						method: 'travel_agency_backend.travel_agency_backend.api.amadeus.search_flights',
						args: {
							origin: values.origin,
							destination: values.destination,
							departure_date: values.departure_date,
							return_date: values.trip_type === 'Return' ? values.return_date : null,
							adults: values.adults,
							children: values.children,
							infants: values.infants,
							travel_class: values.travel_class
						},
						callback: function(r) {
							if (r.message && !r.message.error) {
								// Display flight search results
								show_flight_results(r.message);
							} else {
								frappe.msgprint({
									title: __('Error'),
									indicator: 'red',
									message: r.message && r.message.error ? r.message.error : __('Failed to search flights')
								});
							}
						}
					});
				}
			});
			
			d.show();
		});
	}
});

function show_flight_results(data) {
	if (!data.data || !data.data.length) {
		frappe.msgprint(__('No flights found matching your criteria'));
		return;
	}
	
	let flights = data.data;
	let html = '<div class="flight-results">';
	
	flights.forEach(function(flight, idx) {
		let price = flight.price;
		let currency = price.currency || 'USD';
		let totalPrice = price.grandTotal;
		
		html += `<div class="flight-card">
			<div class="flight-header">
				<h3>Option ${idx + 1}</h3>
				<div class="flight-price">${currency} ${totalPrice}</div>
			</div>
			<div class="flight-details">`;
		
		flight.itineraries.forEach(function(itinerary, i) {
			let segments = itinerary.segments;
			let firstSegment = segments[0];
			let lastSegment = segments[segments.length - 1];
			
			let departureTime = firstSegment.departure.at;
			let arrivalTime = lastSegment.arrival.at;
			let duration = itinerary.duration;
			
			// Format duration from PT2H30M to 2h 30m
			duration = duration.replace('PT', '').replace('H', 'h ').replace('M', 'm');
			
			html += `<div class="itinerary">
				<div class="itinerary-header">
					${i === 0 ? 'Outbound' : 'Return'} · ${segments.length} ${segments.length > 1 ? 'segments' : 'segment'} · ${duration}
				</div>
				<div class="segment-summary">
					<div class="segment-times">
						<div class="departure-time">${formatDateTime(departureTime)}</div>
						<div class="duration">${duration}</div>
						<div class="arrival-time">${formatDateTime(arrivalTime)}</div>
					</div>
					<div class="segment-airports">
						<div class="departure-airport">${firstSegment.departure.iataCode}</div>
						<div class="arrival-airport">${lastSegment.arrival.iataCode}</div>
					</div>
				</div>
			</div>`;
		});
		
		html += `</div>
			<div class="flight-footer">
				<button class="btn btn-sm btn-primary select-flight" data-flight-idx="${idx}">Select</button>
				<button class="btn btn-sm btn-default view-details" data-flight-idx="${idx}">View Details</button>
			</div>
		</div>`;
	});
	
	html += '</div>';
	
	let d = new frappe.ui.Dialog({
		title: __('Flight Search Results'),
		fields: [
			{
				fieldname: 'results_html',
				fieldtype: 'HTML',
				options: html
			}
		],
		size: 'large'
	});
	
	d.show();
	
	// Add event listeners
	d.$wrapper.find('.select-flight').on('click', function() {
		let idx = $(this).data('flight-idx');
		let flight = flights[idx];
		
		// Here you would typically create a new Flight Booking Entry
		frappe.msgprint(`Selected flight option ${idx + 1}`);
		
		// Example: create a new Flight Booking Entry
		create_flight_booking(flight);
	});
	
	d.$wrapper.find('.view-details').on('click', function() {
		let idx = $(this).data('flight-idx');
		let flight = flights[idx];
		
		show_flight_details(flight, idx);
	});
}

function show_flight_details(flight, idx) {
	let html = '<div class="flight-details-view">';
	
	// Flight header
	html += `<div class="flight-details-header">
		<h3>Flight Option ${idx + 1}</h3>
		<div class="flight-price">${flight.price.currency || 'USD'} ${flight.price.grandTotal}</div>
	</div>`;
	
	// Itineraries
	flight.itineraries.forEach(function(itinerary, i) {
		html += `<div class="itinerary-details">
			<h4>${i === 0 ? 'Outbound' : 'Return'} Journey</h4>`;
		
		// Segments
		itinerary.segments.forEach(function(segment, j) {
			let carrier = segment.carrierCode;
			let flightNumber = segment.number;
			let aircraft = segment.aircraft.code;
			let departureTime = segment.departure.at;
			let arrivalTime = segment.arrival.at;
			let duration = segment.duration;
			
			// Format duration
			duration = duration.replace('PT', '').replace('H', 'h ').replace('M', 'm');
			
			html += `<div class="segment-details">
				<div class="segment-header">
					<div class="carrier">${carrier} ${flightNumber}</div>
					<div class="duration">${duration}</div>
				</div>
				<div class="segment-body">
					<div class="departure">
						<div class="time">${formatTime(departureTime)}</div>
						<div class="date">${formatDate(departureTime)}</div>
						<div class="airport">${segment.departure.iataCode}</div>
					</div>
					<div class="segment-line"></div>
					<div class="arrival">
						<div class="time">${formatTime(arrivalTime)}</div>
						<div class="date">${formatDate(arrivalTime)}</div>
						<div class="airport">${segment.arrival.iataCode}</div>
					</div>
				</div>
				<div class="segment-footer">
					<div class="aircraft">Aircraft: ${aircraft}</div>
					<div class="cabin-class">Class: ${segment.pricingDetailPerAdult?.travelClass || 'Economy'}</div>
				</div>
			</div>`;
		});
		
		html += '</div>';
	});
	
	html += '</div>';
	
	let d = new frappe.ui.Dialog({
		title: __('Flight Details'),
		fields: [
			{
				fieldname: 'details_html',
				fieldtype: 'HTML',
				options: html
			}
		],
		primary_action_label: __('Select This Flight'),
		primary_action: function() {
			d.hide();
			create_flight_booking(flight);
		}
	});
	
	d.show();
}

function create_flight_booking(flight) {
	// Create a new Flight Booking Entry based on the selected flight
	frappe.model.with_doctype('Trip Booking', function() {
		let doc = frappe.model.get_new_doc('Trip Booking');
		
		// Set basic details
		doc.trip_type = flight.itineraries.length > 1 ? 'Return' : 'One Way';
		
		// Set flight details
		let outbound = flight.itineraries[0];
		let firstSegment = outbound.segments[0];
		let lastSegment = outbound.segments[outbound.segments.length - 1];
		
		doc.origin = firstSegment.departure.iataCode;
		doc.destination = lastSegment.arrival.iataCode;
		doc.departure_date = frappe.datetime.user_to_str(new Date(firstSegment.departure.at));
		
		if (flight.itineraries.length > 1) {
			let return_segment = flight.itineraries[1].segments[0];
			doc.return_date = frappe.datetime.user_to_str(new Date(return_segment.departure.at));
		}
		
		// Set pricing
		doc.currency = flight.price.currency || 'USD';
		doc.total_amount = parseFloat(flight.price.grandTotal);
		
		// Open the document
		frappe.set_route('Form', 'Trip Booking', doc.name);
	});
}

// Helper functions for date/time formatting
function formatDateTime(dateTimeStr) {
	let date = new Date(dateTimeStr);
	return frappe.datetime.str_to_user(date, true);
}

function formatDate(dateTimeStr) {
	let date = new Date(dateTimeStr);
	return frappe.datetime.str_to_user(date);
}

function formatTime(dateTimeStr) {
	let date = new Date(dateTimeStr);
	let hours = date.getHours().toString().padStart(2, '0');
	let minutes = date.getMinutes().toString().padStart(2, '0');
	return `${hours}:${minutes}`;
}
