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
        
        // Attach event handler for Book Now buttons - FOR DEMONSTRATION ONLY
        $('.book-now').on('click', function() {
            // Get the booking information based on the button clicked
            let bookingDetails = [];
            let bookingType;
            
            if (type === 'flight') {
                const row = $(this).closest('tr');
                const cells = row.find('td');
                bookingType = 'Flight';
                
                bookingDetails = [
                    {label: 'Airline', value: $(cells[0]).text()},
                    {label: 'Route', value: $(cells[1]).text()},
                    {label: 'Departure', value: $(cells[2]).text()},
                    {label: 'Price', value: $(cells[3]).text()}
                ];
            } else if (type === 'hotel') {
                const panel = $(this).closest('.panel');
                const hotelName = panel.find('.panel-heading h4').text();
                const priceText = panel.find('p:contains("Price")').text().replace('Price:', '').trim();
                const locationText = panel.find('p:contains("Location")').text().replace('Location:', '').trim();
                
                bookingType = 'Hotel';
                bookingDetails = [
                    {label: 'Hotel Name', value: hotelName},
                    {label: 'Location', value: locationText},
                    {label: 'Price', value: priceText},
                    {label: 'Check-in Date', value: $('#hotel-checkin').val()},
                    {label: 'Check-out Date', value: $('#hotel-checkout').val()}
                ];
            }
            
            // Create a nice looking dialog to display the booking information
            let dialogHTML = `
                <div class="booking-preview">
                    <div class="demo-alert alert alert-info">
                        <i class="fa fa-info-circle"></i> 
                        <strong>Demonstration Only:</strong> This is a preview of what would be sent to your booking system.
                    </div>
                    <h4>${bookingType} Booking Details</h4>
                    <table class="table table-bordered">
                        <tbody>
            `;
            
            // Add all booking details to the table
            bookingDetails.forEach(detail => {
                dialogHTML += `
                    <tr>
                        <th width="30%">${detail.label}</th>
                        <td>${detail.value}</td>
                    </tr>
                `;
            });
            
            dialogHTML += `
                        </tbody>
                    </table>
                </div>
            `;
            
            // Show the dialog
            const d = new frappe.ui.Dialog({
                title: 'Booking Preview (Demo Only)',
                fields: [{
                    fieldname: 'booking_html',
                    fieldtype: 'HTML',
                    options: dialogHTML
                }],
                primary_action_label: 'Close',
                primary_action: function() {
                    d.hide();
                }
            });
            
            d.show();
            
            // Add custom class for styling
            d.$wrapper.find('.modal-dialog').css('width', '550px');
            d.$wrapper.find('.booking-preview .demo-alert').css('margin-bottom', '15px');
        });
    };

    // Initialize everything
    setupDefaultDates();
    setupEventHandlers();
};
