frappe.ui.form.on('Insurance Booking Entry', {
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

function calculate_total(frm, cdt, cdn) {
    const row = locals[cdt][cdn];
    row.total_amount = (row.supplier_cost || 0) + (row.markup || 0) + (row.service_fee || 0);
    refresh_field('total_amount', row.name, 'insurance_booking_entry');
}
