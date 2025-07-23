frappe.ui.form.on('Flight Booking Entry Multicity', {
    refresh: function(frm) {
        // Calculate selling price when supplier_cost or markup changes
        frm.add_fetch('supplier_cost', '', 'selling_price');
        frm.add_fetch('markup', '', 'selling_price');
    },
    
    supplier_cost: function(frm) {
        calculate_selling_price(frm);
    },
    
    markup: function(frm) {
        calculate_selling_price(frm);
    }
});

function calculate_selling_price(frm) {
    const supplier_cost = frm.doc.supplier_cost || 0;
    const markup = frm.doc.markup || 0;
    frm.set_value('selling_price', supplier_cost + markup);
}
