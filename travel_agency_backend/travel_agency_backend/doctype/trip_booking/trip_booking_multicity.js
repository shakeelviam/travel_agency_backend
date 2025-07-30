// Custom JS for handling Flight Multi City booking in Trip Booking
// This file should be included in trip_booking.js

frappe.provide("travel_agency.trip_booking");

// Store the last selected passenger for better UX
travel_agency.trip_booking.last_passenger = null;

// Add a flight segment for a specific passenger
travel_agency.trip_booking.add_flight_segment = function(frm) {
    if (!frm.doc.flight_multicity_supplier) {
        frappe.msgprint(__("Please select a supplier first."));
        return;
    }
    
    // Get existing passengers in the multi-city segments
    let existing_passengers = [];
    let last_passenger = null;
    let last_segment = null;
    
    if (frm.doc.flight_booking_entry_multicity && frm.doc.flight_booking_entry_multicity.length > 0) {
        // Get all passengers
        existing_passengers = frm.doc.flight_booking_entry_multicity.map(row => row.passenger);
        
        // Get the last segment added
        last_segment = frm.doc.flight_booking_entry_multicity[frm.doc.flight_booking_entry_multicity.length - 1];
        if (last_segment) {
            last_passenger = last_segment.passenger;
        }
        
        // Remove duplicates from passenger list
        existing_passengers = [...new Set(existing_passengers)];
    }
    
    // Prepare fields for the dialog
    let fields = [
        {
            fieldtype: 'Link',
            fieldname: 'passenger',
            label: 'Passenger',
            options: 'Passenger',
            reqd: 1,
            default: last_passenger || travel_agency.trip_booking.last_passenger || ""
        }
    ];
    
    // If there are existing passengers, add a checkbox to use existing passenger
    if (existing_passengers.length > 0) {
        fields.unshift({
            fieldtype: 'Check',
            fieldname: 'use_existing_passenger',
            label: 'Use Existing Passenger',
            default: 0,
            onchange: function() {
                const use_existing = this.get_value();
                if (use_existing) {
                    this.layout.fields_dict.passenger.df.fieldtype = 'Select';
                    this.layout.fields_dict.passenger.df.options = existing_passengers;
                    if (existing_passengers.length > 0) {
                        this.layout.fields_dict.passenger.set_value(existing_passengers[0]);
                    }
                } else {
                    this.layout.fields_dict.passenger.df.fieldtype = 'Link';
                    this.layout.fields_dict.passenger.df.options = 'Passenger';
                    this.layout.fields_dict.passenger.set_value('');
                }
                this.layout.fields_dict.passenger.refresh();
            }
        });
    }
    
    // Add segment fields
    fields = fields.concat([
        {
            fieldtype: 'Section Break',
            label: 'Segment Details'
        },
        {
            fieldtype: 'Int',
            fieldname: 'segment_number',
            label: 'Segment Number',
            default: 1
        },
        {
            fieldtype: 'Link',
            fieldname: 'airline',
            label: 'Airline',
            options: 'Airline Master'
        },
        {
            fieldtype: 'Column Break'
        },
        {
            fieldtype: 'Link',
            fieldname: 'from_location',
            label: 'From Location',
            options: 'Sector Master',
            reqd: 1
        },
        {
            fieldtype: 'Link',
            fieldname: 'to_location',
            label: 'To Location',
            options: 'Sector Master',
            reqd: 1
        },
        {
            fieldtype: 'Column Break'
        },
        {
            fieldtype: 'Date',
            fieldname: 'date_of_travel',
            label: 'Date of Travel',
            reqd: 1
        },
        {
            fieldtype: 'Data',
            fieldname: 'flight_number',
            label: 'Flight Number'
        },
        {
            fieldtype: 'Section Break',
            label: 'Additional Details'
        },
        {
            fieldtype: 'Data',
            fieldname: 'booking_class',
            label: 'Booking Class'
        },
        {
            fieldtype: 'Data',
            fieldname: 'ticket_number',
            label: 'Ticket Number'
        },
        {
            fieldtype: 'Data',
            fieldname: 'pnr',
            label: 'PNR'
        },
        {
            fieldtype: 'Section Break',
            label: 'Pricing'
        },
        {
            fieldtype: 'Currency',
            fieldname: 'supplier_cost',
            label: 'Supplier Cost'
        },
        {
            fieldtype: 'Currency',
            fieldname: 'markup',
            label: 'Markup'
        },
        {
            fieldtype: 'Check',
            fieldname: 'add_another',
            label: 'Add Another Segment for Same Passenger',
            default: 0
        }
    ]);
    
    // Create dialog
    let d = new frappe.ui.Dialog({
        title: 'Add Flight Segment',
        fields: fields,
        primary_action_label: 'Add',
        primary_action: function(values) {
            // Save the last passenger for better UX
            travel_agency.trip_booking.last_passenger = values.passenger;
            
            // Calculate segment number if not provided
            if (!values.segment_number) {
                // Find existing segments for this passenger
                let existing_segments = frm.doc.flight_booking_entry_multicity.filter(
                    row => row.passenger === values.passenger
                );
                values.segment_number = existing_segments.length + 1;
            }
            
            // Add the segment
            let child = frm.add_child('flight_booking_entry_multicity');
            $.extend(child, values);
            
            // Calculate selling price
            if (child.supplier_cost && child.markup) {
                child.selling_price = child.supplier_cost + child.markup;
            }
            
            // Generate route summary
            child.route_summary = `${child.from_location} → ${child.to_location} | ${child.airline || ''} ${child.flight_number || ''}`;
            
            // Update the main total amount
            travel_agency.trip_booking.totals.update_trip_booking_totals(frm);
            
            frm.refresh_field('flight_booking_entry_multicity');
            
            // Show success message
            frappe.show_alert({
                message: __(`Flight segment added for passenger ${values.passenger}`),
                indicator: 'green'
            }, 5);
            
            // If add another is checked, open the dialog again
            if (values.add_another) {
                d.hide();
                setTimeout(() => {
                    travel_agency.trip_booking.add_flight_segment(frm);
                }, 300);
            } else {
                d.hide();
            }
        }
    });
    
    d.show();
};

// View all segments for a specific passenger
travel_agency.trip_booking.view_passenger_segments = function(frm, passenger) {
    if (!frm.doc.flight_booking_entry_multicity || frm.doc.flight_booking_entry_multicity.length === 0) {
        frappe.msgprint(__("No segments found for this passenger."));
        return;
    }
    
    // Filter segments for this passenger
    let segments = frm.doc.flight_booking_entry_multicity.filter(
        row => row.passenger === passenger
    );
    
    if (segments.length === 0) {
        frappe.msgprint(__(`No segments found for passenger ${passenger}.`));
        return;
    }
    
    // Sort segments by segment number
    segments.sort((a, b) => a.segment_number - b.segment_number);
    
    // Create route summary
    let routePoints = segments.map(s => s.from_location);
    // Add the last destination
    if (segments.length > 0) {
        routePoints.push(segments[segments.length - 1].to_location);
    }
    let routeSummary = routePoints.join(' → ');
    
    // Create HTML table
    let html = `
        <div class="segment-viewer">
            <h4>Flight Segments for ${passenger}</h4>
            <div class="route-summary alert alert-info">
                <strong>Complete Route:</strong> ${routeSummary}
            </div>
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>Segment</th>
                        <th>From</th>
                        <th>To</th>
                        <th>Date</th>
                        <th>Airline</th>
                        <th>Flight</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    segments.forEach(segment => {
        html += `
            <tr>
                <td>${segment.segment_number}</td>
                <td>${segment.from_location}</td>
                <td>${segment.to_location}</td>
                <td>${frappe.datetime.str_to_user(segment.date_of_travel)}</td>
                <td>${segment.airline || ''}</td>
                <td>${segment.flight_number || ''}</td>
                <td>
                    <button class="btn btn-xs btn-default edit-segment" 
                        data-idx="${segment.idx}">
                        Edit
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    // Create dialog
    let d = new frappe.ui.Dialog({
        title: `Flight Segments for ${passenger}`,
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'segment_viewer',
                options: html
            }
        ],
        primary_action_label: 'Close',
        primary_action: () => d.hide()
    });
    
    d.show();
    
    // Add event handlers for edit buttons
    d.$wrapper.find('.edit-segment').on('click', function() {
        const idx = $(this).data('idx');
        d.hide();
        travel_agency.trip_booking.edit_segment(frm, idx);
    });
};

// Edit a segment
travel_agency.trip_booking.edit_segment = function(frm, idx) {
    const segment = frm.doc.flight_booking_entry_multicity[idx - 1];
    if (!segment) return;
    
    // Create dialog with segment data
    let d = new frappe.ui.Dialog({
        title: 'Edit Flight Segment',
        fields: [
            {
                fieldtype: 'Link',
                fieldname: 'passenger',
                label: 'Passenger',
                options: 'Passenger',
                default: segment.passenger,
                read_only: 1
            },
            {
                fieldtype: 'Int',
                fieldname: 'segment_number',
                label: 'Segment Number',
                default: segment.segment_number
            },
            {
                fieldtype: 'Section Break',
                label: 'Segment Details'
            },
            {
                fieldtype: 'Link',
                fieldname: 'airline',
                label: 'Airline',
                options: 'Airline Master',
                default: segment.airline
            },
            {
                fieldtype: 'Column Break'
            },
            {
                fieldtype: 'Link',
                fieldname: 'from_location',
                label: 'From Location',
                options: 'Sector Master',
                reqd: 1,
                default: segment.from_location
            },
            {
                fieldtype: 'Link',
                fieldname: 'to_location',
                label: 'To Location',
                options: 'Sector Master',
                reqd: 1,
                default: segment.to_location
            },
            {
                fieldtype: 'Column Break'
            },
            {
                fieldtype: 'Date',
                fieldname: 'date_of_travel',
                label: 'Date of Travel',
                reqd: 1,
                default: segment.date_of_travel
            },
            {
                fieldtype: 'Data',
                fieldname: 'flight_number',
                label: 'Flight Number',
                default: segment.flight_number
            },
            {
                fieldtype: 'Section Break',
                label: 'Additional Details'
            },
            {
                fieldtype: 'Data',
                fieldname: 'booking_class',
                label: 'Booking Class',
                default: segment.booking_class
            },
            {
                fieldtype: 'Data',
                fieldname: 'ticket_number',
                label: 'Ticket Number',
                default: segment.ticket_number
            },
            {
                fieldtype: 'Data',
                fieldname: 'pnr',
                label: 'PNR',
                default: segment.pnr
            },
            {
                fieldtype: 'Section Break',
                label: 'Pricing'
            },
            {
                fieldtype: 'Currency',
                fieldname: 'supplier_cost',
                label: 'Supplier Cost',
                default: segment.supplier_cost
            },
            {
                fieldtype: 'Currency',
                fieldname: 'markup',
                label: 'Markup',
                default: segment.markup
            }
        ],
        primary_action_label: 'Update',
        primary_action: function(values) {
            // Update segment
            $.extend(segment, values);
            
            // Calculate selling price
            if (segment.supplier_cost && segment.markup) {
                segment.selling_price = segment.supplier_cost + segment.markup;
            }
            
            // Generate route summary
            segment.route_summary = `${segment.from_location} → ${segment.to_location} | ${segment.airline || ''} ${segment.flight_number || ''}`;
            
            // Update the main total amount
            travel_agency.trip_booking.totals.update_trip_booking_totals(frm);
            
            frm.refresh_field('flight_booking_entry_multicity');
            
            // Show success message
            frappe.show_alert({
                message: __(`Flight segment updated`),
                indicator: 'green'
            }, 5);
            
            d.hide();
            
            // Show the segments view again
            setTimeout(() => {
                travel_agency.trip_booking.view_passenger_segments(frm, segment.passenger);
            }, 300);
        }
    });
    
    d.show();
};

// View all passengers with their segments
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
    
    passengers.forEach(passenger => {
        // Get segments for this passenger
        let segments = frm.doc.flight_booking_entry_multicity.filter(
            row => row.passenger === passenger
        );
        
        // Sort segments by segment number
        segments.sort((a, b) => a.segment_number - b.segment_number);
        
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

// Update Trip Booking form
frappe.ui.form.on('Trip Booking', {
    refresh: function(frm) {
        // Add custom buttons for Flight Multi City
        if (frm.doc.flight_multicity_supplier) {
            frm.add_custom_button(__('Add Flight Segment'), function() {
                travel_agency.trip_booking.add_flight_segment(frm);
            }, __('Flight Multi City'));
            
            frm.add_custom_button(__('View All Passengers'), function() {
                travel_agency.trip_booking.view_all_passengers(frm);
            }, __('Flight Multi City'));
        }
    }
});
