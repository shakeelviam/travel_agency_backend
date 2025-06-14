// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

const flt = frappe.utils.flt;

frappe.ui.form.on('Flight Booking Entry GDS', {
    refresh: function(frm, cdt, cdn) {
        calculate_supplier_cost(frm, cdt, cdn);
        calculate_total(frm, cdt, cdn);
    },

    form_render: function(frm, cdt, cdn) {
        calculate_supplier_cost(frm, cdt, cdn);
        calculate_total(frm, cdt, cdn);
        toggle_return_fields(frm, cdt, cdn);
    },

    base_fare: function(frm, cdt, cdn) {
        calculate_supplier_cost(frm, cdt, cdn);
    },

    taxes: function(frm, cdt, cdn) {
        calculate_supplier_cost(frm, cdt, cdn);
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

// Calculate supplier_cost = base_fare + taxes
function calculate_supplier_cost(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const base_fare = flt(row.base_fare || 0);
    const taxes = flt(row.taxes || 0);

    const supplier_cost = base_fare + taxes;
    frappe.model.set_value(cdt, cdn, 'supplier_cost', supplier_cost);
}

// Calculate total = supplier_cost + markup
function calculate_total(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const supplier_cost = flt(row.supplier_cost || 0);
    const markup = flt(row.markup || 0);

    const total_amount = supplier_cost + markup;
    frappe.model.set_value(cdt, cdn, 'total_amount', total_amount);
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
