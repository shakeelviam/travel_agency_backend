// Batch operations for multi-city flight booking
frappe.provide("travel_agency.trip_booking.batch");

// Add multiple segments at once
travel_agency.trip_booking.batch.add_multiple_segments = function(frm) {
    if (!frm.doc.flight_multicity_supplier) {
        frappe.msgprint(__("Please select a supplier first."));
        return;
    }
    
    // Get existing passengers
    let existing_passengers = [];
    if (frm.doc.flight_booking_entry_multicity && frm.doc.flight_booking_entry_multicity.length > 0) {
        existing_passengers = frm.doc.flight_booking_entry_multicity.map(row => row.passenger);
        // Remove duplicates
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
            default: travel_agency.trip_booking.last_passenger || ""
        }
    ];
    
    // If there are existing passengers, add a select option
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
    
    // Add HTML for batch entry
    fields.push({
        fieldtype: 'Section Break',
        label: 'Flight Segments'
    });
    
    fields.push({
        fieldtype: 'HTML',
        fieldname: 'segments_html',
        options: `
            <div class="batch-segments-container">
                <div class="alert alert-info">
                    Enter all flight segments for this passenger. All segments will be added at once.
                </div>
                <table class="table table-bordered batch-segments-table">
                    <thead>
                        <tr>
                            <th style="width: 5%">Segment</th>
                            <th style="width: 15%">From</th>
                            <th style="width: 15%">To</th>
                            <th style="width: 15%">Date</th>
                            <th style="width: 15%">Airline</th>
                            <th style="width: 10%">Flight #</th>
                            <th style="width: 10%">Class</th>
                            <th style="width: 15%">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="batch_segments_tbody">
                        <!-- Rows will be added here dynamically -->
                    </tbody>
                </table>
                <button class="btn btn-xs btn-default add-batch-segment">Add Segment</button>
            </div>
        `
    });
    
    // Add pricing fields
    fields.push({
        fieldtype: 'Section Break',
        label: 'Pricing (Applied to all segments)'
    });
    
    fields.push({
        fieldtype: 'Currency',
        fieldname: 'supplier_cost',
        label: 'Supplier Cost'
    });
    
    fields.push({
        fieldtype: 'Currency',
        fieldname: 'markup',
        label: 'Markup'
    });
    
    // Create dialog
    let d = new frappe.ui.Dialog({
        title: 'Add Multiple Flight Segments',
        fields: fields,
        primary_action_label: 'Add All Segments',
        primary_action: function(values) {
            // Save the last passenger for better UX
            travel_agency.trip_booking.last_passenger = values.passenger;
            
            // Get segment data from the table
            const segments = [];
            d.$wrapper.find('#batch_segments_tbody tr').each(function() {
                const $row = $(this);
                segments.push({
                    segment_number: parseInt($row.find('.segment-number').text()),
                    from_location: $row.find('.from-location').val(),
                    to_location: $row.find('.to-location').val(),
                    date_of_travel: $row.find('.date-of-travel').val(),
                    airline: $row.find('.airline').val(),
                    flight_number: $row.find('.flight-number').val(),
                    booking_class: $row.find('.booking-class').val()
                });
            });
            
            if (segments.length === 0) {
                frappe.msgprint(__("Please add at least one segment."));
                return;
            }
            
            // Validate required fields
            let valid = true;
            segments.forEach((segment, idx) => {
                if (!segment.from_location || !segment.to_location || !segment.date_of_travel) {
                    frappe.msgprint(__(`Segment ${idx + 1} is missing required fields.`));
                    valid = false;
                }
            });
            
            if (!valid) return;
            
            // Add all segments
            segments.forEach(segment => {
                let child = frm.add_child('flight_booking_entry_multicity');
                
                // Set passenger and segment data
                child.passenger = values.passenger;
                child.segment_number = segment.segment_number;
                child.from_location = segment.from_location;
                child.to_location = segment.to_location;
                child.date_of_travel = segment.date_of_travel;
                child.airline = segment.airline;
                child.flight_number = segment.flight_number;
                child.booking_class = segment.booking_class;
                
                // Set pricing if provided
                if (values.supplier_cost) {
                    child.supplier_cost = values.supplier_cost;
                }
                if (values.markup) {
                    child.markup = values.markup;
                }
                
                // Calculate selling price
                if (child.supplier_cost && child.markup) {
                    child.selling_price = child.supplier_cost + child.markup;
                }
            });
            
            frm.refresh_field('flight_booking_entry_multicity');
            
            // Show success message
            frappe.show_alert({
                message: __(`${segments.length} flight segments added for passenger ${values.passenger}`),
                indicator: 'green'
            }, 5);
            
            d.hide();
        }
    });
    
    d.show();
    
    // Setup batch segment functionality
    d.$wrapper.find('.add-batch-segment').on('click', function() {
        const rowCount = d.$wrapper.find('#batch_segments_tbody tr').length;
        const newRow = $(`
            <tr>
                <td class="segment-number">${rowCount + 1}</td>
                <td>
                    <div class="form-group">
                        <div class="control-input">
                            <input type="text" class="form-control from-location" data-fieldtype="Link" data-fieldname="from_location" data-options="Sector Master">
                        </div>
                    </div>
                </td>
                <td>
                    <div class="form-group">
                        <div class="control-input">
                            <input type="text" class="form-control to-location" data-fieldtype="Link" data-fieldname="to_location" data-options="Sector Master">
                        </div>
                    </div>
                </td>
                <td>
                    <div class="form-group">
                        <div class="control-input">
                            <input type="date" class="form-control date-of-travel" data-fieldtype="Date" data-fieldname="date_of_travel">
                        </div>
                    </div>
                </td>
                <td>
                    <div class="form-group">
                        <div class="control-input">
                            <input type="text" class="form-control airline" data-fieldtype="Link" data-fieldname="airline" data-options="Airline Master">
                        </div>
                    </div>
                </td>
                <td>
                    <div class="form-group">
                        <div class="control-input">
                            <input type="text" class="form-control flight-number" data-fieldtype="Data" data-fieldname="flight_number">
                        </div>
                    </div>
                </td>
                <td>
                    <div class="form-group">
                        <div class="control-input">
                            <input type="text" class="form-control booking-class" data-fieldtype="Data" data-fieldname="booking_class">
                        </div>
                    </div>
                </td>
                <td>
                    <button class="btn btn-xs btn-danger remove-segment">Remove</button>
                </td>
            </tr>
        `);
        
        d.$wrapper.find('#batch_segments_tbody').append(newRow);
        
        // Auto-fill from_location based on previous to_location
        if (rowCount > 0) {
            const prevToLocation = d.$wrapper.find(`#batch_segments_tbody tr:nth-child(${rowCount}) .to-location`).val();
            if (prevToLocation) {
                newRow.find('.from-location').val(prevToLocation);
            }
        }
        
        // Setup autocomplete for from_location and to_location
        newRow.find('.from-location, .to-location').each(function() {
            $(this).autocomplete({
                source: function(request, response) {
                    frappe.db.get_link_options('Sector Master', request.term, {}).then(result => {
                        response(result);
                    });
                },
                minLength: 2
            });
        });
        
        // Setup autocomplete for airline
        newRow.find('.airline').autocomplete({
            source: function(request, response) {
                frappe.db.get_link_options('Airline Master', request.term, {}).then(result => {
                    response(result);
                });
            },
            minLength: 2
        });
        
        // Remove segment handler
        newRow.find('.remove-segment').on('click', function() {
            $(this).closest('tr').remove();
            // Renumber rows
            d.$wrapper.find('#batch_segments_tbody tr').each(function(idx) {
                $(this).find('.segment-number').text(idx + 1);
            });
        });
        
        return false; // Prevent form submission
    });
    
    // Add initial row
    d.$wrapper.find('.add-batch-segment').trigger('click');
};

// Update Trip Booking form to include batch operations
frappe.ui.form.on('Trip Booking', {
    refresh: function(frm) {
        // Add batch operations button if supplier is selected
        if (frm.doc.flight_multicity_supplier) {
            frm.add_custom_button(__('Add Multiple Segments'), function() {
                travel_agency.trip_booking.batch.add_multiple_segments(frm);
            }, __('Flight Multi City'));
        }
    }
});
