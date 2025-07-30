// Total price calculation for multi-city flight booking
frappe.provide("travel_agency.trip_booking.totals");

// Calculate totals for a passenger
travel_agency.trip_booking.totals.calculate_passenger_totals = function(frm, passenger) {
    if (!frm.doc.flight_booking_entry_multicity || !passenger) return { 
        supplier_cost: 0, 
        markup: 0, 
        selling_price: 0 
    };
    
    // Get segments for this passenger
    let segments = frm.doc.flight_booking_entry_multicity.filter(
        row => row.passenger === passenger
    );
    
    // Calculate totals
    let totalSupplierCost = 0;
    let totalMarkup = 0;
    let totalSellingPrice = 0;
    
    segments.forEach(segment => {
        totalSupplierCost += segment.supplier_cost ? parseFloat(segment.supplier_cost) : 0;
        totalMarkup += segment.markup ? parseFloat(segment.markup) : 0;
        totalSellingPrice += segment.selling_price ? parseFloat(segment.selling_price) : 0;
    });
    
    return {
        supplier_cost: totalSupplierCost,
        markup: totalMarkup,
        selling_price: totalSellingPrice
    };
};

// Calculate totals for all passengers
travel_agency.trip_booking.totals.calculate_all_totals = function(frm) {
    if (!frm.doc.flight_booking_entry_multicity) return {
        supplier_cost: 0,
        markup: 0,
        selling_price: 0,
        passenger_count: 0
    };
    
    // Get unique passengers
    let passengers = [...new Set(frm.doc.flight_booking_entry_multicity.map(row => row.passenger))];
    
    // Calculate totals
    let totalSupplierCost = 0;
    let totalMarkup = 0;
    let totalSellingPrice = 0;
    
    passengers.forEach(passenger => {
        const passengerTotals = travel_agency.trip_booking.totals.calculate_passenger_totals(frm, passenger);
        totalSupplierCost += passengerTotals.supplier_cost;
        totalMarkup += passengerTotals.markup;
        totalSellingPrice += passengerTotals.selling_price;
    });
    
    return {
        supplier_cost: totalSupplierCost,
        markup: totalMarkup,
        selling_price: totalSellingPrice,
        passenger_count: passengers.length
    };
};

// Update the Trip Booking form with totals
travel_agency.trip_booking.totals.update_trip_booking_totals = function(frm) {
    if (!frm.doc.flight_multicity_supplier) return;
    
    // Check if we have parent-level pricing fields set
    const parentSupplierCost = frm.doc.flight_multicity_total_supplier_cost || 0;
    const parentMarkup = frm.doc.flight_multicity_total_markup || 0;
    
    // If parent-level fields are set manually, use those values
    if (parentSupplierCost > 0 || parentMarkup > 0) {
        // Calculate selling price based on parent-level fields
        const sellingPrice = parentSupplierCost + parentMarkup;
        frm.set_value('flight_multicity_total_selling_price', sellingPrice);
        frm.set_value('total_amount', sellingPrice);
    } else {
        // Otherwise calculate from segments
        const totals = travel_agency.trip_booking.totals.calculate_all_totals(frm);
        
        // Update the Trip Booking form with the totals
        frm.set_value('flight_multicity_total_supplier_cost', totals.supplier_cost);
        frm.set_value('flight_multicity_total_markup', totals.markup);
        frm.set_value('flight_multicity_total_selling_price', totals.selling_price);
        
        // Update the main total_amount field for the Trip Booking
        frm.set_value('total_amount', totals.selling_price);
    }
    
    frm.refresh_field('flight_multicity_total_supplier_cost');
    frm.refresh_field('flight_multicity_total_markup');
    frm.refresh_field('flight_multicity_total_selling_price');
    frm.refresh_field('total_amount');
};

// Enhance view_all_passengers to show totals
travel_agency.trip_booking.totals.enhance_view_all_passengers = function() {
    // Store the original function
    const original_view_all_passengers = travel_agency.trip_booking.view_all_passengers;
    
    // Replace with enhanced version
    travel_agency.trip_booking.view_all_passengers = function(frm) {
        if (!frm.doc.flight_booking_entry_multicity || frm.doc.flight_booking_entry_multicity.length === 0) {
            frappe.msgprint(__("No flight segments found."));
            return;
        }
        
        // Get unique passengers
        let passengers = [...new Set(frm.doc.flight_booking_entry_multicity.map(row => row.passenger))];
        
        if (passengers.length === 0) {
            frappe.msgprint(__("No passengers found."));
            return;
        }
        
        // Create HTML for each passenger
        let html = `<div class="passenger-list">`;
        
        // Calculate grand totals
        const grandTotals = travel_agency.trip_booking.totals.calculate_all_totals(frm);
        
        // Add grand totals section
        html += `
            <div class="grand-totals alert alert-info" style="margin-bottom: 20px;">
                <h4>Flight Multi City Summary</h4>
                <div class="row">
                    <div class="col-md-3">
                        <strong>Passengers:</strong> ${grandTotals.passenger_count}
                    </div>
                    <div class="col-md-3">
                        <strong>Total Supplier Cost:</strong> ${format_currency(grandTotals.supplier_cost, frm.doc.currency || "INR")}
                    </div>
                    <div class="col-md-3">
                        <strong>Total Markup:</strong> ${format_currency(grandTotals.markup, frm.doc.currency || "INR")}
                    </div>
                    <div class="col-md-3">
                        <strong>Total Selling Price:</strong> ${format_currency(grandTotals.selling_price, frm.doc.currency || "INR")}
                    </div>
                </div>
            </div>
        `;
        
        passengers.forEach(passenger => {
            // Get segments for this passenger
            let segments = frm.doc.flight_booking_entry_multicity.filter(
                row => row.passenger === passenger
            );
            
            // Sort segments by segment number
            segments.sort((a, b) => a.segment_number - b.segment_number);
            
            // Calculate passenger totals
            const passengerTotals = travel_agency.trip_booking.totals.calculate_passenger_totals(frm, passenger);
            
            // Create route summary
            let routePoints = segments.map(s => s.from_location);
            // Add the last destination
            if (segments.length > 0) {
                routePoints.push(segments[segments.length - 1].to_location);
            }
            let route = routePoints.join(' → ');
            
            html += `
                <div class="passenger-card" style="margin-bottom: 15px; padding: 10px; border: 1px solid #d1d8dd; border-radius: 4px;">
                    <h4>${passenger}</h4>
                    <p><strong>Route:</strong> ${route}</p>
                    <p><strong>Segments:</strong> ${segments.length}</p>
                    <div class="row">
                        <div class="col-md-4">
                            <p><strong>Total Supplier Cost:</strong> ${format_currency(passengerTotals.supplier_cost, frm.doc.currency || "INR")}</p>
                        </div>
                        <div class="col-md-4">
                            <p><strong>Total Markup:</strong> ${format_currency(passengerTotals.markup, frm.doc.currency || "INR")}</p>
                        </div>
                        <div class="col-md-4">
                            <p><strong>Total Selling Price:</strong> ${format_currency(passengerTotals.selling_price, frm.doc.currency || "INR")}</p>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-default view-segments" 
                        data-passenger="${passenger}">
                        View Segments
                    </button>
                    <button class="btn btn-sm btn-primary add-segment" 
                        data-passenger="${passenger}">
                        Add Segment
                    </button>
                </div>
            `;
        });
        
        html += `</div>`;
        
        // Create dialog
        let d = new frappe.ui.Dialog({
            title: 'Flight Multi City Passengers',
            fields: [
                {
                    fieldtype: 'HTML',
                    fieldname: 'passenger_viewer',
                    options: html
                }
            ],
            primary_action_label: 'Close',
            primary_action: () => d.hide()
        });
        
        d.show();
        
        // Add event handlers for buttons
        d.$wrapper.find('.view-segments').on('click', function() {
            const passenger = $(this).data('passenger');
            d.hide();
            travel_agency.trip_booking.view_passenger_segments(frm, passenger);
        });
        
        d.$wrapper.find('.add-segment').on('click', function() {
            const passenger = $(this).data('passenger');
            travel_agency.trip_booking.last_passenger = passenger;
            d.hide();
            travel_agency.trip_booking.add_flight_segment(frm);
        });
    };
};

// Initialize the enhancements
$(document).ready(function() {
    travel_agency.trip_booking.totals.enhance_view_all_passengers();
});

// Update Trip Booking form
frappe.ui.form.on('Trip Booking', {
    refresh: function(frm) {
        if (frm.doc.flight_multicity_supplier) {
            travel_agency.trip_booking.totals.update_trip_booking_totals(frm);
        }
    },
    
    flight_booking_entry_multicity_add: function(frm) {
        // Update totals when a segment is added
        travel_agency.trip_booking.totals.update_trip_booking_totals(frm);
    },
    
    flight_booking_entry_multicity_remove: function(frm) {
        // Update totals when a segment is removed
        travel_agency.trip_booking.totals.update_trip_booking_totals(frm);
    },
    
    // Handle parent-level pricing field changes
    flight_multicity_total_supplier_cost: function(frm) {
        travel_agency.trip_booking.totals.update_trip_booking_totals(frm);
    },
    
    flight_multicity_total_markup: function(frm) {
        travel_agency.trip_booking.totals.update_trip_booking_totals(frm);
    }
});
