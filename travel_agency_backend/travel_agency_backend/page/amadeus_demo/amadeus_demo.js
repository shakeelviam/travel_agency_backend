frappe.pages['amadeus-demo'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Amadeus API Showcase',
        single_column: true
    });

    // Add content
    setupAmadeusDemo(page);
};

frappe.pages['amadeus-demo'].on_page_show = function() {
    // This ensures tab functionality works when page is shown
    setupTabEvents();
};

function setupTabEvents() {
    // Fix tab navigation
    $('.nav-tabs a').off('click').on('click', function(e) {
        e.preventDefault();
        $(this).tab('show');
    });
}

function setupAmadeusDemo(page) {
    // Create sections
    var html = `
        <div class="amadeus-demo-container">
            <div class="section-tabs">
                <ul class="nav nav-tabs" role="tablist">
                    <li class="active">
                        <a href="#flight-apis" role="tab" data-toggle="tab">Flight APIs</a>
                    </li>
                    <li>
                        <a href="#airport-apis" role="tab" data-toggle="tab">Airport & City APIs</a>
                    </li>
                    <li>
                        <a href="#hotel-apis" role="tab" data-toggle="tab">Hotel APIs</a>
                    </li>
                </ul>
                
                <div class="tab-content">
                    <div role="tabpanel" class="tab-pane active" id="flight-apis">
                        <h3>Flight Search</h3>
                        <div class="well">
                            <div class="row">
                                <div class="col-md-6 form-group">
                                    <label>Origin (Airport Code)</label>
                                    <input type="text" class="form-control" id="flight-origin" placeholder="e.g. JFK">
                                </div>
                                <div class="col-md-6 form-group">
                                    <label>Destination (Airport Code)</label>
                                    <input type="text" class="form-control" id="flight-destination" placeholder="e.g. LHR">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 form-group">
                                    <label>Departure Date</label>
                                    <input type="date" class="form-control" id="flight-departure">
                                </div>
                                <div class="col-md-6 form-group">
                                    <label>Return Date (Optional)</label>
                                    <input type="date" class="form-control" id="flight-return">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-12">
                                    <button class="btn btn-primary" id="search-flights-btn">Search Flights</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="api-response" id="flight-response" style="display:none;">
                            <h4>API Response</h4>
                            <pre><code></code></pre>
                        </div>
                    </div>
                    
                    <div role="tabpanel" class="tab-pane" id="airport-apis">
                        <h3>Airport Search</h3>
                        <div class="well">
                            <div class="row">
                                <div class="col-md-12 form-group">
                                    <label>Search Query</label>
                                    <input type="text" class="form-control" id="airport-query" placeholder="e.g. London, JFK, Dubai">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-12">
                                    <button class="btn btn-primary" id="search-airports-btn">Search Airports</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="api-response" id="airport-response" style="display:none;">
                            <h4>API Response</h4>
                            <pre><code></code></pre>
                        </div>
                    </div>
                    
                    <div role="tabpanel" class="tab-pane" id="hotel-apis">
                        <h3>Hotel Search</h3>
                        <div class="well">
                            <div class="row">
                                <div class="col-md-6 form-group">
                                    <label>City Code</label>
                                    <input type="text" class="form-control" id="hotel-city" placeholder="e.g. PAR">
                                </div>
                                <div class="col-md-6 form-group">
                                    <label>Adults</label>
                                    <input type="number" class="form-control" id="hotel-adults" value="1">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-6 form-group">
                                    <label>Check-in Date</label>
                                    <input type="date" class="form-control" id="hotel-checkin">
                                </div>
                                <div class="col-md-6 form-group">
                                    <label>Check-out Date</label>
                                    <input type="date" class="form-control" id="hotel-checkout">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-md-12">
                                    <button class="btn btn-primary" id="search-hotels-btn">Search Hotels</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="api-response" id="hotel-response" style="display:none;">
                            <h4>API Response</h4>
                            <pre><code></code></pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    $(html).appendTo(page.body);
    
    // Initialize tabs
    setupTabEvents();
    
    // Add event listeners
    $('#search-flights-btn').on('click', function() {
        var origin = $('#flight-origin').val();
        var destination = $('#flight-destination').val();
        var departure = $('#flight-departure').val();
        var returnDate = $('#flight-return').val();
        
        if (!origin || !destination || !departure) {
            frappe.msgprint('Please fill all required fields');
            return;
        }
        
        var args = {
            origin: origin,
            destination: destination,
            departure_date: departure
        };
        
        if (returnDate) {
            args.return_date = returnDate;
        }
        
        frappe.show_alert({
            message: __('Searching flights...'),
            indicator: 'blue'
        });
        
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flights',
            args: args,
            callback: function(r) {
                $('#flight-response').show();
                $('#flight-response pre code').text(JSON.stringify(r.message, null, 2));
                $('html, body').animate({
                    scrollTop: $('#flight-response').offset().top - 50
                }, 500);
            }
        });
    });
    
    $('#search-airports-btn').on('click', function() {
        var query = $('#airport-query').val();
        
        if (!query) {
            frappe.msgprint('Please enter a search query');
            return;
        }
        
        frappe.show_alert({
            message: __('Searching airports...'),
            indicator: 'blue'
        });
        
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_airports',
            args: {
                query: query
            },
            callback: function(r) {
                $('#airport-response').show();
                $('#airport-response pre code').text(JSON.stringify(r.message, null, 2));
                $('html, body').animate({
                    scrollTop: $('#airport-response').offset().top - 50
                }, 500);
            }
        });
    });
    
    $('#search-hotels-btn').on('click', function() {
        var cityCode = $('#hotel-city').val();
        var checkin = $('#hotel-checkin').val();
        var checkout = $('#hotel-checkout').val();
        var adults = $('#hotel-adults').val();
        
        if (!cityCode || !checkin || !checkout) {
            frappe.msgprint('Please fill all required fields');
            return;
        }
        
        frappe.show_alert({
            message: __('Searching hotels...'),
            indicator: 'blue'
        });
        
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_hotels',
            args: {
                cityCode: cityCode,
                checkInDate: checkin,
                checkOutDate: checkout,
                adults: adults
            },
            callback: function(r) {
                $('#hotel-response').show();
                $('#hotel-response pre code').text(JSON.stringify(r.message, null, 2));
                $('html, body').animate({
                    scrollTop: $('#hotel-response').offset().top - 50
                }, 500);
            }
        });
    });
    
    // Add some CSS
    frappe.dom.set_style(`
        .amadeus-demo-container {
            padding: 15px;
        }
        .section-tabs {
            margin-top: 20px;
        }
        .tab-content {
            padding: 20px 0;
        }
        .well {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .api-response {
            border: 1px solid #ddd;
            border-radius: 5px;
            margin-top: 20px;
        }
        .api-response h4 {
            background-color: #f5f5f5;
            padding: 10px 15px;
            margin: 0;
            border-bottom: 1px solid #ddd;
        }
        .api-response pre {
            margin: 0;
            padding: 15px;
            max-height: 400px;
            overflow: auto;
        }
    `);
}
