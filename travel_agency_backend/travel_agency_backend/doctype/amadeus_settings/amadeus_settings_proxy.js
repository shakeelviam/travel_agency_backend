frappe.ui.form.on('Amadeus Settings', {
    refresh: function(frm) {
        // Add Direct API Testing section
        frm.add_custom_button(__('Test Authentication (Direct)'), function() {
            frappe.call({
                method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.get_token',
                callback: function(r) {
                    if (r.message && r.message.success) {
                        frappe.msgprint({
                            title: __('Authentication Successful'),
                            indicator: 'green',
                            message: __('Successfully authenticated with Amadeus API using direct proxy.<br><br>' +
                                'Access token received: ' + r.message.access_token.substring(0, 5) + '...' +
                                r.message.access_token.substring(r.message.access_token.length - 5) + 
                                '<br>Token expires in: ' + r.message.expires_in + ' seconds')
                        });
                    } else {
                        frappe.msgprint({
                            title: __('Authentication Failed'),
                            indicator: 'red',
                            message: __('Failed to authenticate with Amadeus API using direct proxy.<br><br>' +
                                'Error: ' + (r.message ? JSON.stringify(r.message.error) : 'Unknown error'))
                        });
                    }
                }
            });
        }, __('Direct API Proxy'));
        
        frm.add_custom_button(__('Search Airports (Direct)'), function() {
            frappe.prompt([
                {'fieldname': 'query', 'fieldtype': 'Data', 'label': 'Search Query', 'reqd': 1}
            ],
            function(values) {
                frappe.call({
                    method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_airports',
                    args: {
                        query: values.query
                    },
                    callback: function(r) {
                        if (r.message && r.message.success) {
                            let airports = r.message.airports;
                            let message = '<ul>';
                            
                            airports.forEach(function(airport) {
                                message += `<li><strong>${airport.iataCode}</strong> - ${airport.name} (${airport.address.cityName}, ${airport.address.countryName})</li>`;
                            });
                            
                            message += '</ul>';
                            
                            frappe.msgprint({
                                title: __('Airport Search Results'),
                                indicator: 'green',
                                message: message || __('No airports found.'),
                                wide: true
                            });
                        } else {
                            frappe.msgprint({
                                title: __('Search Failed'),
                                indicator: 'red',
                                message: __('Failed to search airports.<br><br>Error: ' + 
                                    (r.message ? JSON.stringify(r.message.error) : 'Unknown error'))
                            });
                        }
                    }
                });
            },
            __('Search Airports'),
            __('Search')
            );
        }, __('Direct API Proxy'));
        
        frm.add_custom_button(__('Search Flights (Direct)'), function() {
            frappe.prompt([
                {'fieldname': 'origin', 'fieldtype': 'Data', 'label': 'Origin (e.g. JFK)', 'reqd': 1},
                {'fieldname': 'destination', 'fieldtype': 'Data', 'label': 'Destination (e.g. LHR)', 'reqd': 1},
                {'fieldname': 'departure_date', 'fieldtype': 'Date', 'label': 'Departure Date', 'reqd': 1},
                {'fieldname': 'return_date', 'fieldtype': 'Date', 'label': 'Return Date (Optional)'},
                {'fieldname': 'adults', 'fieldtype': 'Int', 'label': 'Number of Adults', 'default': 1, 'reqd': 1}
            ],
            function(values) {
                frappe.msgprint({
                    title: __('Searching Flights'),
                    indicator: 'blue',
                    message: __('Searching for flights. Please wait...')
                });
                
                frappe.call({
                    method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flights',
                    args: {
                        origin: values.origin,
                        destination: values.destination,
                        departure_date: values.departure_date,
                        return_date: values.return_date,
                        adults: values.adults
                    },
                    callback: function(r) {
                        if (r.message && r.message.success) {
                            let flightOffers = r.message.flight_offers;
                            let message = `<p>Found ${flightOffers.length} flight offers</p>`;
                            
                            if (flightOffers.length > 0) {
                                message += '<ul>';
                                flightOffers.slice(0, 5).forEach(function(offer, index) {
                                    let firstSegment = offer.itineraries[0].segments[0];
                                    let lastSegment = offer.itineraries[0].segments[offer.itineraries[0].segments.length - 1];
                                    
                                    message += `<li><strong>Option ${index + 1}</strong>: ${firstSegment.departure.iataCode} → ${lastSegment.arrival.iataCode} | 
                                        ${firstSegment.departure.at.slice(0, 10)} | 
                                        ${offer.price.currency} ${offer.price.total}</li>`;
                                });
                                
                                if (flightOffers.length > 5) {
                                    message += `<li>...and ${flightOffers.length - 5} more options</li>`;
                                }
                                
                                message += '</ul>';
                            }
                            
                            frappe.msgprint({
                                title: __('Flight Search Results'),
                                indicator: 'green',
                                message: message,
                                wide: true
                            });
                        } else {
                            frappe.msgprint({
                                title: __('Search Failed'),
                                indicator: 'red',
                                message: __('Failed to search flights.<br><br>Error: ' + 
                                    (r.message ? JSON.stringify(r.message.error) : 'Unknown error'))
                            });
                        }
                    }
                });
            },
            __('Search Flights'),
            __('Search')
            );
        }, __('Direct API Proxy'));
    }
});
