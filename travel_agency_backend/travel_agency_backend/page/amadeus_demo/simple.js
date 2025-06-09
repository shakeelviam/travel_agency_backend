// Simple Amadeus API demo
$(document).ready(function() {
    // Set default dates
    setDefaultDates();
    
    // Set up button handlers
    $('#btn-search-flights').click(function() {
        var origin = $('#flight-origin').val();
        var destination = $('#flight-destination').val();
        var date = $('#flight-date').val();
        
        if (!origin || !destination || !date) {
            frappe.msgprint('Please fill all flight search fields');
            return;
        }
        
        $('#api-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching flights...</p></div>').show();
        
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_flights',
            args: {
                origin: origin,
                destination: destination,
                departure_date: date
            },
            callback: function(r) {
                if (r.message && r.message.flight_offers) {
                    showFlights(r.message.flight_offers);
                } else {
                    $('#api-results').html('<div class="alert alert-warning">No flights found</div>');
                }
            },
            error: function() {
                $('#api-results').html('<div class="alert alert-danger">Error searching flights</div>');
            }
        });
    });
    
    $('#btn-search-airports').click(function() {
        var query = $('#airport-query').val();
        
        if (!query) {
            frappe.msgprint('Please enter an airport search term');
            return;
        }
        
        $('#api-results').html('<div class="text-center"><i class="fa fa-spinner fa-spin fa-2x"></i><p>Searching airports...</p></div>').show();
        
        frappe.call({
            method: 'travel_agency_backend.travel_agency_backend.api.amadeus_proxy.search_airports',
            args: {
                query: query
            },
            callback: function(r) {
                if (r.message && r.message.data) {
                    showAirports(r.message.data);
                } else {
                    $('#api-results').html('<div class="alert alert-warning">No airports found</div>');
                }
            },
            error: function() {
                $('#api-results').html('<div class="alert alert-danger">Error searching airports</div>');
            }
        });
    });
    
    $('#btn-search-hotels').click(function() {
        var cityCode = $('#hotel-city').val();
        var checkInDate = $('#hotel-checkin').val();
        var checkOutDate = $('#hotel-checkout').val();
        
        if (!cityCode || !checkInDate || !checkOutDate) {
            frappe.msgprint('Please fill all hotel search fields');
            return;
        }
        
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
                if (r.message && r.message.data) {
                    showHotels(r.message.data);
                } else {
                    $('#api-results').html('<div class="alert alert-warning">No hotels found</div>');
                }
            },
            error: function() {
                $('#api-results').html('<div class="alert alert-danger">Error searching hotels</div>');
            }
        });
    });
});

function setDefaultDates() {
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    $('#flight-date').val(formatDate(tomorrow));
    $('#hotel-checkin').val(formatDate(tomorrow));
    
    var checkout = new Date();
    checkout.setDate(checkout.getDate() + 3);
    $('#hotel-checkout').val(formatDate(checkout));
}

function formatDate(date) {
    var d = new Date(date),
        month = '' + (d.getMonth() + 1),
        day = '' + d.getDate(),
        year = d.getFullYear();

    if (month.length < 2) 
        month = '0' + month;
    if (day.length < 2) 
        day = '0' + day;

    return [year, month, day].join('-');
}

function showFlights(flights) {
    var html = '<h4>' + flights.length + ' Flights Found</h4>';
    html += '<table class="table table-striped">';
    html += '<thead><tr><th>Airline</th><th>Flight</th><th>Departure</th><th>Arrival</th><th>Price</th><th></th></tr></thead>';
    html += '<tbody>';
    
    for (var i = 0; i < flights.length; i++) {
        var flight = flights[i];
        var segments = flight.itineraries[0].segments;
        var firstSeg = segments[0];
        var lastSeg = segments[segments.length - 1];
        
        var departure = new Date(firstSeg.departure.at).toLocaleString();
        var arrival = new Date(lastSeg.arrival.at).toLocaleString();
        var price = flight.price.total + ' ' + flight.price.currency;
        
        html += '<tr>';
        html += '<td>' + firstSeg.carrierCode + '</td>';
        html += '<td>' + firstSeg.departure.iataCode + ' → ' + lastSeg.arrival.iataCode + '</td>';
        html += '<td>' + departure + '</td>';
        html += '<td>' + arrival + '</td>';
        html += '<td>' + price + '</td>';
        html += '<td><button class="btn btn-sm btn-primary book-flight">Book</button></td>';
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    $('#api-results').html(html);
    
    $('.book-flight').click(function() {
        frappe.msgprint("This would create a new booking in your system");
    });
}

function showAirports(airports) {
    var html = '<h4>' + airports.length + ' Airports Found</h4>';
    html += '<table class="table table-striped">';
    html += '<thead><tr><th>Code</th><th>Name</th><th>City</th><th>Country</th></tr></thead>';
    html += '<tbody>';
    
    for (var i = 0; i < airports.length; i++) {
        var airport = airports[i];
        var address = airport.address || {};
        
        html += '<tr>';
        html += '<td>' + (airport.iataCode || 'N/A') + '</td>';
        html += '<td>' + (airport.name || 'N/A') + '</td>';
        html += '<td>' + (address.cityName || 'N/A') + '</td>';
        html += '<td>' + (address.countryName || address.countryCode || 'N/A') + '</td>';
        html += '</tr>';
    }
    
    html += '</tbody></table>';
    $('#api-results').html(html);
}

function showHotels(hotels) {
    var html = '<h4>' + hotels.length + ' Hotels Found</h4>';
    html += '<div class="row">';
    
    for (var i = 0; i < hotels.length; i++) {
        var hotel = hotels[i];
        var hotelInfo = hotel.hotel || {};
        var offer = (hotel.offers && hotel.offers.length > 0) ? hotel.offers[0] : {};
        var price = offer.price ? (offer.price.total + ' ' + offer.price.currency) : 'N/A';
        var address = hotelInfo.address || {};
        
        html += '<div class="col-md-6 col-sm-12" style="margin-bottom:15px;">';
        html += '<div class="panel panel-default">';
        html += '<div class="panel-heading"><h4>' + (hotelInfo.name || 'Hotel') + '</h4></div>';
        html += '<div class="panel-body">';
        html += '<p><b>Location:</b> ' + [address.cityName, address.countryName].filter(Boolean).join(', ') + '</p>';
        html += '<p><b>Price:</b> ' + price + '</p>';
        html += '<button class="btn btn-primary book-hotel">Book Room</button>';
        html += '</div></div></div>';
    }
    
    html += '</div>';
    $('#api-results').html(html);
    
    $('.book-hotel').click(function() {
        frappe.msgprint("This would create a new hotel booking in your system");
    });
}
