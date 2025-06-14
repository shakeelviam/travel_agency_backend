// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

const flt = frappe.utils.flt;

frappe.ui.form.on('Flight Booking Entry GDS', {
    refresh: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
        add_done_button(frm);
    },

    form_render: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
        toggle_return_fields(frm, cdt, cdn);
        add_done_button(frm);
    },

    markup: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },

    supplier_cost: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },

    trip_type: function(frm, cdt, cdn) {
        toggle_return_fields(frm, cdt, cdn);
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

// Show/hide return_sector and return_date
function toggle_return_fields(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const grid_rows = cur_frm.fields_dict[row.parentfield].grid.grid_rows;
    let grid_row = grid_rows.find(gr => gr.doc.name === cdn);
    if (!grid_row) return;

    const is_return = row.trip_type === "Return";

    grid_row.toggle_editable("return_sector", is_return);
    grid_row.toggle_display("return_sector", is_return);
    grid_row.toggle_editable("return_date", is_return);
    grid_row.toggle_display("return_date", is_return);

    if (!is_return) {
        frappe.model.set_value(cdt, cdn, "return_sector", "");
        frappe.model.set_value(cdt, cdn, "return_date", "");
    }
}
