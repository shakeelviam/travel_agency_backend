frappe.pages['amadeus-demo'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Amadeus API Showcase',
        single_column: true
    });

    // Include HTML content directly
    $(wrapper).find('.layout-main-section').html(`
        <div class="container">
            <!-- Flight Search Panel -->
            <div class="panel panel-default">
                <div class="panel-heading">
                    <h3 class="panel-title">Flight Search</h3>
                </div>
                <div class="panel-body">
                    <div class="row">
                        <div class="col-md-4 form-group">
                            <label>Origin Airport Code</label>
                            <input type="text" class="form-control" id="flight-origin" placeholder="e.g. JFK">
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Destination Airport Code</label>
                            <input type="text" class="form-control" id="flight-destination" placeholder="e.g. LHR">
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Departure Date</label>
                            <input type="date" class="form-control" id="flight-date">
                        </div>
                    </div>
                    <button id="btn-search-flights" class="btn btn-primary">Search Flights</button>
                </div>
            </div>

            <!-- Airport Search Panel -->
            <div class="panel panel-default">
                <div class="panel-heading">
                    <h3 class="panel-title">Airport Search</h3>
                </div>
                <div class="panel-body">
                    <div class="row">
                        <div class="col-md-12 form-group">
                            <label>Search Query</label>
                            <input type="text" class="form-control" id="airport-query" placeholder="e.g. JFK or New York">
                        </div>
                    </div>
                    <button id="btn-search-airports" class="btn btn-primary">Search Airports</button>
                </div>
            </div>

            <!-- Hotel Search Panel -->
            <div class="panel panel-default">
                <div class="panel-heading">
                    <h3 class="panel-title">Hotel Search</h3>
                </div>
                <div class="panel-body">
                    <div class="row">
                        <div class="col-md-4 form-group">
                            <label>City Code</label>
                            <input type="text" class="form-control" id="hotel-city" placeholder="e.g. LON">
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Check-in Date</label>
                            <input type="date" class="form-control" id="hotel-checkin">
                        </div>
                        <div class="col-md-4 form-group">
                            <label>Check-out Date</label>
                            <input type="date" class="form-control" id="hotel-checkout">
                        </div>
                    </div>
                    <button id="btn-search-hotels" class="btn btn-primary">Search Hotels</button>
                </div>
            </div>

            <!-- Results Container -->
            <div id="api-results" class="well" style="display:none; margin-top: 20px;"></div>
        </div>
    `);

    // Set default dates
    const setupDefaultDates = function() {
        // Set dates for next week and next week + 3 days
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        const nextWeekStr = nextWeek.toISOString().split('T')[0];
        
        const nextWeekPlus3 = new Date();
        nextWeekPlus3.setDate(nextWeekPlus3.getDate() + 10);
        const nextWeekPlus3Str = nextWeekPlus3.toISOString().split('T')[0];
        
        // Set default dates for all date inputs
        $('#flight-date').val(nextWeekStr);
        $('#hotel-checkin').val(nextWeekStr);
        $('#hotel-checkout').val(nextWeekPlus3Str);
    };
    
    // Set up event handlers
    const setupEventHandlers = function() {
        $('#btn-search-flights').on('click', function() {
            var origin = $('#flight-origin').val();
            var destination = $('#flight-destination').val();
            var date = $('#flight-date').val();
            
            if (!origin || !destination || !date) {
                frappe.msgprint('Please fill all required fields');
                return;
            }
            
            // Show loading
            $('#api-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching flights...</p></div>').show();
            
            frappe.call({
                method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flights',
                args: {
                    origin: origin,
                    destination: destination,
                    departure_date: date
                },
                callback: function(r) {
                    showResults(r.message, 'flight');
                }
            });
        });
        
        $('#btn-search-airports').on('click', function() {
            var query = $('#airport-query').val();
            
            if (!query) {
                frappe.msgprint('Please enter a search term');
                return;
            }
            
            // Show loading
            $('#api-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching airports...</p></div>').show();
            
            frappe.call({
                method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_airports',
                args: {
                    query: query
                },
                callback: function(r) {
                    showResults(r.message, 'airport');
                }
            });
        });
        
        $('#btn-search-hotels').on('click', function() {
            var cityCode = $('#hotel-city').val();
            var checkInDate = $('#hotel-checkin').val();
            var checkOutDate = $('#hotel-checkout').val();
            
            if (!cityCode || !checkInDate || !checkOutDate) {
                frappe.msgprint('Please fill all required fields');
                return;
            }
            
            // Show loading
            $('#api-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching hotels...</p></div>').show();
            
            frappe.call({
                method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_hotels',
                args: {
                    cityCode: cityCode,
                    checkInDate: checkInDate,
                    checkOutDate: checkOutDate,
                    adults: 1
                },
                callback: function(r) {
                    showResults(r.message, 'hotel');
                }
            });
        });
    };

    // Show formatted results
    const showResults = function(data, type) {
        var html = '';
        
        if (!data || (type === 'flight' && !data.flight_offers) || 
            ((type === 'airport' || type === 'hotel') && !data.data)) {
            html = '<div class="alert alert-warning">No results found</div>';
            $('#api-results').html(html).show();
            return;
        }
        
        if (type === 'flight') {
            // Flight results
            var flights = data.flight_offers;
            html = '<h4>' + flights.length + ' Flights Found</h4>';
            html += '<table class="table table-bordered">';
            html += '<thead><tr><th>Airline</th><th>Route</th><th>Departure</th><th>Price</th><th>Action</th></tr></thead>';
            html += '<tbody>';
            
            for (var i = 0; i < flights.length; i++) {
                var flight = flights[i];
                var segment = flight.itineraries[0].segments[0];
                var lastSegment = flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1];
                var route = segment.departure.iataCode + ' → ' + lastSegment.arrival.iataCode;
                var departureDate = new Date(segment.departure.at).toLocaleString();
                var price = flight.price.total + ' ' + flight.price.currency;
                
                html += '<tr>';
                html += '<td>' + segment.carrierCode + '</td>';
                html += '<td>' + route + '</td>';
                html += '<td>' + departureDate + '</td>';
                html += '<td>' + price + '</td>';
                html += '<td><button class="btn btn-sm btn-primary book-now">Book Now</button></td>';
                html += '</tr>';
            }
            
            html += '</tbody></table>';
        } else if (type === 'airport') {
            // Airport results
            var airports = data.data;
            html = '<h4>' + airports.length + ' Airports Found</h4>';
            html += '<table class="table table-bordered">';
            html += '<thead><tr><th>Name</th><th>Code</th><th>City</th><th>Country</th></tr></thead>';
            html += '<tbody>';
            
            for (var i = 0; i < airports.length; i++) {
                var airport = airports[i];
                var address = airport.address || {};
                
                html += '<tr>';
                html += '<td>' + (airport.name || 'N/A') + '</td>';
                html += '<td>' + (airport.iataCode || 'N/A') + '</td>';
                html += '<td>' + (address.cityName || 'N/A') + '</td>';
                html += '<td>' + (address.countryName || address.countryCode || 'N/A') + '</td>';
                html += '</tr>';
            }
            
            html += '</tbody></table>';
        } else if (type === 'hotel') {
            // Hotel results
            var hotels = data.data;
            html = '<h4>' + hotels.length + ' Hotels Found</h4>';
            html += '<div class="row">';
            
            for (var i = 0; i < hotels.length; i++) {
                var hotel = hotels[i].hotel || {};
                var offer = (hotels[i].offers && hotels[i].offers.length > 0) ? hotels[i].offers[0] : {};
                var price = (offer.price) ? offer.price.total + ' ' + offer.price.currency : 'N/A';
                var address = hotel.address || {};
                var location = [address.cityName, address.countryName].filter(Boolean).join(', ');
                
                html += '<div class="col-md-6" style="margin-bottom: 15px;">';
                html += '<div class="panel panel-default">';
                html += '<div class="panel-heading"><h4 style="margin: 0;">' + (hotel.name || 'Hotel') + '</h4></div>';
                html += '<div class="panel-body">';
                html += '<p><strong>Location:</strong> ' + location + '</p>';
                html += '<p><strong>Price:</strong> ' + price + '</p>';
                html += '<button class="btn btn-primary book-now">Book Now</button>';
                html += '</div></div></div>';
            }
            
            html += '</div>';
        }
        
        $('#api-results').html(html).show();
        
        // Attach event handler for Book Now buttons - FULL DEMO BOOKING FLOW
        $('.book-now').on('click', function() {
            // Store reference to the selected item
            let selectedItem;
            let bookingType;
            let flightOffer;
            let hotelOffer;
            
            if (type === 'flight') {
                const row = $(this).closest('tr');
                const rowIndex = row.index();
                flightOffer = data.flight_offers[rowIndex];
                bookingType = 'flight';
                
                selectedItem = {
                    type: 'flight',
                    airline: row.find('td').eq(0).text(),
                    route: row.find('td').eq(1).text(),
                    departure: row.find('td').eq(2).text(),
                    price: row.find('td').eq(3).text(),
                    raw_data: flightOffer
                };
            } else if (type === 'hotel') {
                const panel = $(this).closest('.panel');
                const panelIndex = $('.panel').index(panel) / 2; // Approximate index
                hotelOffer = data.data[Math.floor(panelIndex)];
                bookingType = 'hotel';
                
                selectedItem = {
                    type: 'hotel',
                    name: panel.find('.panel-heading h4').text(),
                    location: panel.find('p:contains("Location")').text().replace('Location:', '').trim(),
                    price: panel.find('p:contains("Price")').text().replace('Price:', '').trim(),
                    checkin: $('#hotel-checkin').val(),
                    checkout: $('#hotel-checkout').val(),
                    raw_data: hotelOffer
                };
            }
            
            startBookingFlow(selectedItem, bookingType);
        });
        
        function startBookingFlow(selectedItem, bookingType) {
            // Step 1: Customer Information
            showCustomerInfoStep(selectedItem, bookingType);
        }
        
        function showCustomerInfoStep(selectedItem, bookingType) {
            // Define fields based on booking type
            let fields = [
                {label: 'Full Name', fieldname: 'full_name', fieldtype: 'Data', reqd: 1},
                {label: 'Email', fieldname: 'email', fieldtype: 'Data', reqd: 1},
                {label: 'Phone', fieldname: 'phone', fieldtype: 'Data'}
            ];
            
            if (bookingType === 'flight') {
                fields = fields.concat([
                    {fieldtype: 'Section Break', label: 'Passenger Details'},
                    {label: 'Date of Birth', fieldname: 'dob', fieldtype: 'Date'},
                    {label: 'Passport Number', fieldname: 'passport', fieldtype: 'Data'},
                    {label: 'Special Requirements', fieldname: 'special_requirements', fieldtype: 'Small Text'}
                ]);
            } else if (bookingType === 'hotel') {
                fields = fields.concat([
                    {fieldtype: 'Section Break', label: 'Stay Details'},
                    {label: 'Number of Guests', fieldname: 'guests', fieldtype: 'Int', default: 1},
                    {label: 'Number of Rooms', fieldname: 'rooms', fieldtype: 'Int', default: 1},
                    {label: 'Special Requests', fieldname: 'special_requests', fieldtype: 'Small Text'}
                ]);
            }
            
            const d = new frappe.ui.Dialog({
                title: `Book ${bookingType.charAt(0).toUpperCase() + bookingType.slice(1)} - Customer Information`,
                fields: fields,
                primary_action_label: 'Proceed to Payment',
                primary_action: function(values) {
                    d.hide();
                    showPaymentStep(selectedItem, values, bookingType);
                }
            });
            
            d.show();
        }
        
        function showPaymentStep(selectedItem, customerInfo, bookingType) {
            // Parse price from selectedItem
            let priceText = selectedItem.price;
            let price = 0;
            let currency = 'EUR';
            
            if (priceText) {
                const priceParts = priceText.split(' ');
                if (priceParts.length > 0) {
                    price = parseFloat(priceParts[0]);
                    if (priceParts.length > 1) {
                        currency = priceParts[1];
                    }
                }
            }
            
            const d = new frappe.ui.Dialog({
                title: 'Payment Details',
                fields: [
                    {fieldtype: 'HTML', fieldname: 'payment_summary', options: `
                        <div class="payment-summary well">
                            <h4>Booking Summary</h4>
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>${bookingType === 'flight' ? 'Flight' : 'Hotel'}:</strong> ${bookingType === 'flight' ? selectedItem.route : selectedItem.name}</p>
                                    <p><strong>Customer:</strong> ${customerInfo.full_name}</p>
                                </div>
                                <div class="col-md-6 text-right">
                                    <h3>${price.toFixed(2)} ${currency}</h3>
                                </div>
                            </div>
                        </div>
                    `},
                    {fieldtype: 'Section Break', label: 'Card Information'},
                    {label: 'Card Number', fieldname: 'card_number', fieldtype: 'Data', reqd: 1, default: '4111 1111 1111 1111'},
                    {fieldtype: 'Column Break'},
                    {label: 'Expiry', fieldname: 'card_expiry', fieldtype: 'Data', reqd: 1, default: '12/25'},
                    {fieldtype: 'Column Break'},
                    {label: 'CVV', fieldname: 'card_cvv', fieldtype: 'Password', reqd: 1, default: '123'}
                ],
                primary_action_label: 'Pay & Complete Booking',
                primary_action: function(values) {
                    // Show processing indicator
                    d.$wrapper.find('.modal-content').append(
                        `<div class="payment-processing" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,255,255,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;flex-direction:column;">
                            <i class="fa fa-circle-o-notch fa-spin fa-3x text-primary"></i>
                            <p class="text-center" style="margin-top:15px;font-size:16px;">Processing payment...</p>
                        </div>`
                    );
                    
                    // Prepare data for API call
                    let apiData;
                    if (bookingType === 'flight') {
                        apiData = {
                            passenger_name: customerInfo.full_name,
                            email: customerInfo.email,
                            phone: customerInfo.phone,
                            passport: customerInfo.passport,
                            dob: customerInfo.dob,
                            special_requirements: customerInfo.special_requirements,
                            flight: selectedItem.raw_data
                        };
                        
                        // Make API call to simulate booking
                        setTimeout(function() {
                            frappe.call({
                                method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.simulate_flight_booking',
                                args: {
                                    flight_data: apiData
                                },
                                callback: function(r) {
                                    d.hide();
                                    showConfirmationStep(r.message, customerInfo, selectedItem, bookingType);
                                }
                            });
                        }, 2000); // Simulate processing time
                    } else {
                        apiData = {
                            guest_name: customerInfo.full_name,
                            email: customerInfo.email,
                            phone: customerInfo.phone,
                            rooms: customerInfo.rooms,
                            guests: customerInfo.guests,
                            special_requests: customerInfo.special_requests,
                            check_in: selectedItem.checkin,
                            check_out: selectedItem.checkout,
                            hotel: selectedItem.raw_data,
                            price: price.toString(),
                            currency: currency
                        };
                        
                        // Make API call to simulate booking
                        setTimeout(function() {
                            frappe.call({
                                method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.simulate_hotel_booking',
                                args: {
                                    hotel_data: apiData
                                },
                                callback: function(r) {
                                    d.hide();
                                    showConfirmationStep(r.message, customerInfo, selectedItem, bookingType);
                                }
                            });
                        }, 2000); // Simulate processing time
                    }
                }
            });
            
            d.show();
        }
        
        function showConfirmationStep(confirmation, customerInfo, selectedItem, bookingType) {
            let contentHTML = '';
            
            if (confirmation.error) {
                contentHTML = `
                    <div class="alert alert-danger">
                        <i class="fa fa-exclamation-circle"></i>
                        <strong>Booking Failed</strong>
                        <p>${confirmation.error}</p>
                    </div>
                `;
            } else {
                // Success message with confirmation details
                contentHTML = `
                    <div class="text-center" style="margin-bottom: 20px;">
                        <i class="fa fa-check-circle text-success" style="font-size: 48px;"></i>
                        <h3 class="text-success">Booking Confirmed!</h3>
                    </div>
                    
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h3 class="panel-title">Booking Reference</h3>
                        </div>
                        <div class="panel-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>Booking ID:</strong> ${confirmation.booking_id}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Status:</strong> <span class="label label-success">${confirmation.status}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h3 class="panel-title">${bookingType === 'flight' ? 'Flight' : 'Hotel'} Details</h3>
                        </div>
                        <div class="panel-body">
                `;
                
                if (bookingType === 'flight') {
                    contentHTML += `
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>Route:</strong> ${selectedItem.route}</p>
                                    <p><strong>Airline:</strong> ${selectedItem.airline}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Departure:</strong> ${selectedItem.departure}</p>
                                    <p><strong>Price:</strong> ${selectedItem.price}</p>
                                </div>
                            </div>
                    `;
                } else {
                    contentHTML += `
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>Hotel:</strong> ${selectedItem.name}</p>
                                    <p><strong>Location:</strong> ${selectedItem.location}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Check-in:</strong> ${selectedItem.checkin}</p>
                                    <p><strong>Check-out:</strong> ${selectedItem.checkout}</p>
                                    <p><strong>Price:</strong> ${selectedItem.price}</p>
                                </div>
                            </div>
                    `;
                }
                
                contentHTML += `
                        </div>
                    </div>
                    
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h3 class="panel-title">Guest Information</h3>
                        </div>
                        <div class="panel-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>Name:</strong> ${customerInfo.full_name}</p>
                                    <p><strong>Email:</strong> ${customerInfo.email}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Phone:</strong> ${customerInfo.phone || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="panel panel-default">
                        <div class="panel-heading">
                            <h3 class="panel-title">Payment Information</h3>
                        </div>
                        <div class="panel-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <p><strong>Amount:</strong> ${confirmation.payment.amount} ${confirmation.payment.currency}</p>
                                    <p><strong>Transaction ID:</strong> ${confirmation.payment.transaction_id}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Status:</strong> <span class="label label-success">${confirmation.payment.status}</span></p>
                                    <p><strong>Date:</strong> ${confirmation.confirmation_timestamp}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="well" style="margin-top: 20px;">
                        <div class="text-center">
                            <p><i class="fa fa-info-circle"></i> This is a demonstration booking. In a production environment, an email would be sent with these details.</p>
                        </div>
                    </div>
                `;
            }
            
            const d = new frappe.ui.Dialog({
                title: 'Booking Confirmation',
                fields: [{
                    fieldtype: 'HTML',
                    fieldname: 'confirmation_html',
                    options: contentHTML
                }],
                primary_action_label: 'Done',
                primary_action: function() {
                    d.hide();
                }
            });
            
            d.show();
            
            // Make the dialog wider
            d.$wrapper.find('.modal-dialog').css('width', '650px');
        }
    };

    // Initialize everything
    setupDefaultDates();
    setupEventHandlers();
};
