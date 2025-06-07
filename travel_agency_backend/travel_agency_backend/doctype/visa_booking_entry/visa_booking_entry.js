// Copyright (c) 2025, Shakeel Mohammed Viam and contributors
// For license information, please see license.txt

// Import flt function for number handling
const flt = frappe.utils.flt;

frappe.ui.form.on('Visa Booking Entry', {
    passenger: function(frm, cdt, cdn) {
        // Fetch passenger name when passenger is selected
        const row = locals[cdt][cdn];
        if (row.passenger) {
            frappe.db.get_value('Passenger', row.passenger, 'full_name', function(r) {
                if (r && r.full_name) {
                    frappe.model.set_value(cdt, cdn, 'passenger_name', r.full_name);
                }
            });
        }
    },
    
    form_render: function(frm, cdt, cdn) {
        // Fetch passenger name when form is rendered
        const row = locals[cdt][cdn];
        if (row.passenger) {
            frappe.db.get_value('Passenger', row.passenger, 'full_name', function(r) {
                if (r && r.full_name) {
                    frappe.model.set_value(cdt, cdn, 'passenger_name', r.full_name);
                }
            });
        }
    },
    
    supplier_cost: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },
    
    markup: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },
    
    service_fee: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    }
});

// Function to calculate total amount
function calculate_total(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    const supplier_cost = flt(row.supplier_cost) || 0;
    const markup = flt(row.markup) || 0;
    const service_fee = flt(row.service_fee) || 0;
    
    // Calculate total amount
    const total_amount = supplier_cost + markup + service_fee;
    
    // Update the total amount field
    frappe.model.set_value(cdt, cdn, 'total_amount', total_amount);
}
