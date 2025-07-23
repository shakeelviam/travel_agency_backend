frappe.ui.form.on('Flight Multi City Test', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button(__('Add Passenger'), function() {
                frappe.prompt([
                    {
                        label: 'Passenger',
                        fieldname: 'passenger',
                        fieldtype: 'Link',
                        options: 'Passenger',
                        reqd: 1
                    }
                ],
                function(values) {
                    // Check for duplicates
                    let exists = frm.doc.passenger_entries.some(pe => pe.passenger === values.passenger);
                    if (exists) {
                        frappe.msgprint('Passenger already exists!');
                        return;
                    }
                    let new_row = frm.add_child('passenger_entries');
                    new_row.passenger = values.passenger;

                    // Optionally fetch passenger name
                    frappe.db.get_value('Passenger', values.passenger, 'full_name', (r) => {
                        if (r && r.full_name) {
                            new_row.passenger_name = r.full_name;
                        }
                        frm.refresh_field('passenger_entries');
                    });
                },
                __('Add Passenger'),
                __('Add')
                );
            });
        }
    }
});

// Segments table is standard; no additional scripting is required here.
// Adding/removing segments can be managed through the table UI per passenger.
