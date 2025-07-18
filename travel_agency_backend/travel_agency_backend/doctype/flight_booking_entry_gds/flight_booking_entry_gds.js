// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

const flt = frappe.utils.flt;

frappe.ui.form.on('Flight Booking Entry GDS', {
    refresh: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
        add_done_button(frm);
        setup_sector_auto_numbering(frm);
    },

    form_render: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
        toggle_fields_by_trip_type(frm, cdt, cdn);
        add_done_button(frm);
    },

    markup: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },

    supplier_cost: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },

    trip_type: function(frm, cdt, cdn) {
        toggle_fields_by_trip_type(frm, cdt, cdn);
    },

    passenger: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (row.passenger) {
            frappe.db.get_value('Passenger', row.passenger, 'full_name', function(r) {
                if (r && r.full_name) {
                    frappe.model.set_value(cdt, cdn, 'passenger_name', r.full_name);
                }
            });
        }
    }
});

// Calculate total = supplier_cost + markup
function calculate_total(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const supplier_cost = flt(row.supplier_cost || 0);
    const markup = flt(row.markup || 0);

    const total_amount = supplier_cost + markup;
    frappe.model.set_value(cdt, cdn, 'total_amount', total_amount);
}

// Add DONE button to the form
function add_done_button(frm) {
    // Only add button if this is a child form (in grid edit mode)
    if (!frm.is_new() && frm.doc.parenttype === "Trip Booking") {
        // Remove existing button if any to avoid duplicates
        $('.page-actions .btn-done').remove();
        
        // Add DONE button to the form footer
        const $doneBtn = $(`<button class="btn btn-primary btn-done">${__('DONE')}</button>`)
            .appendTo($('.page-actions'))
            .on('click', function() {
                // Calculate total amount
                const supplier_cost = flt(frm.doc.supplier_cost) || 0;
                const markup = flt(frm.doc.markup) || 0;
                const total_amount = supplier_cost + markup;
                
                // Update total amount
                frm.set_value('total_amount', total_amount);
                
                // Save the form
                frm.save();
                
                // Show success message
                frappe.show_alert({
                    message: __('Calculations updated successfully!'),
                    indicator: 'green'
                }, 3);
                
                // Close the form
                frappe.ui.form.close_grid_form();
                
                // Refresh the parent form's table
                const parentForm = frappe.ui.form.get_open_grid_form();
                if (parentForm) {
                    parentForm.frm.refresh_field('flight_booking_entry_gds');
                }
            });
        
        // Make the button more prominent
        $doneBtn.css({
            'font-weight': 'bold',
            'font-size': '14px',
            'margin-right': '10px'
        });
    }
}

// Setup auto-numbering for multi-city sectors
function setup_sector_auto_numbering(frm) {
    if (!frm) return;
    
    // Only setup if this is a multi-city trip
    if (frm.doc.trip_type !== "Multi City") return;
    
    // Add event handlers for the sectors table
    frm.fields_dict.sectors.grid.wrapper.on('grid-row-render', function(e) {
        renumber_sectors(frm);
    });
    
    frm.fields_dict.sectors.grid.wrapper.on('grid-row-removed', function(e) {
        renumber_sectors(frm);
    });
    
    // Initial numbering
    renumber_sectors(frm);
}

// Renumber all sectors in sequence
function renumber_sectors(frm) {
    if (!frm || !frm.doc.sectors) return;
    
    // Update segment numbers
    frm.doc.sectors.forEach((sector, idx) => {
        if (sector.segment_number !== (idx + 1)) {
            frappe.model.set_value(sector.doctype, sector.name, 'segment_number', idx + 1);
        }
    });
    
    frm.refresh_field('sectors');
}

// Show/hide fields based on trip type
function toggle_fields_by_trip_type(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const grid_rows = cur_frm.fields_dict[row.parentfield]?.grid?.grid_rows;
    let grid_row = grid_rows?.find(gr => gr.doc.name === cdn);
    
    // Setup auto-numbering for sectors if this is a multi-city trip
    if (row.trip_type === "Multi City" && !cdt) {
        setup_sector_auto_numbering(frm);
    }
    
    // Handle both standalone form and grid form
    if (grid_row) {
        // Grid form (child table)
        const is_return = row.trip_type === "Return";
        const is_multi_city = row.trip_type === "Multi City";
        const is_single_trip = !is_return && !is_multi_city;

        // Return trip fields
        grid_row.toggle_editable("return_sector", is_return);
        grid_row.toggle_display("return_sector", is_return);
        grid_row.toggle_editable("return_date", is_return);
        grid_row.toggle_display("return_date", is_return);
        
        // Single/Return trip fields
        const single_trip_fields = ["from_sector", "to_sector", "flight_number", "booking_class", "travel_date"];
        single_trip_fields.forEach(field => {
            if (grid_row.fields_dict[field]) {
                grid_row.toggle_display(field, !is_multi_city);
                grid_row.toggle_editable(field, !is_multi_city);
            }
        });

        // Clear fields based on trip type
        if (!is_return) {
            frappe.model.set_value(cdt, cdn, "return_sector", "");
            frappe.model.set_value(cdt, cdn, "return_date", "");
        }
        
        if (is_multi_city) {
            // Clear single/return trip fields
            single_trip_fields.concat(["return_sector", "return_date"]).forEach(field => {
                frappe.model.set_value(cdt, cdn, field, "");
            });
        } else {
            // Clear multi-city fields
            if (row.sectors && row.sectors.length) {
                frappe.model.set_value(cdt, cdn, "sectors", []);
            }
        }
    } else {
        // Standalone form
        const is_return = frm.doc.trip_type === "Return";
        const is_multi_city = frm.doc.trip_type === "Multi City";
        const is_single_trip = !is_return && !is_multi_city;

        // Return trip fields
        frm.toggle_display(["return_sector", "return_date"], is_return);
        frm.toggle_reqd(["return_sector", "return_date"], is_return);
        
        // Single/Return trip fields
        const single_trip_fields = ["from_sector", "to_sector", "flight_number", "booking_class", "travel_date"];
        frm.toggle_display(single_trip_fields, !is_multi_city);
        frm.toggle_reqd(["from_sector", "to_sector"], !is_multi_city);
        
        // Multi-city fields
        frm.toggle_display(["multi_city_section", "sectors"], is_multi_city);
        frm.toggle_reqd("sectors", is_multi_city);

        // Clear fields based on trip type
        if (!is_return && frm.doc.return_sector) {
            frm.set_value("return_sector", "");
            frm.set_value("return_date", "");
        }
        
        if (is_multi_city) {
            // Clear single/return trip fields
            single_trip_fields.concat(["return_sector", "return_date"]).forEach(field => {
                if (frm.doc[field]) frm.set_value(field, "");
            });
            
            // Add at least one sector if none exist
            if (!frm.doc.sectors || !frm.doc.sectors.length) {
                frm.add_child('sectors', {
                    segment_number: 1
                });
                frm.refresh_field('sectors');
            }
        } else if (frm.doc.sectors && frm.doc.sectors.length) {
            // Clear multi-city fields
            frm.set_value("sectors", []);
        }
    }
}
