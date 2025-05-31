frappe.ui.form.on('Trip Booking', {
    refresh: function (frm) {
        // Hide all child tables initially
        const child_tables = [
            'flight_booking_entry',
            'hotel_booking_entry',
            'visa_booking_entry',
            'car_rental_booking_entry'
        ];

        child_tables.forEach(table => {
            frm.set_df_property(table, "hidden", true);
        });

        if (frm.doc.docstatus === 0) {
            frm.add_custom_button('Add Service', () => {
                frappe.prompt(
                    [
                        {
                            fieldname: 'service_type',
                            label: 'Select Service',
                            fieldtype: 'Link',
                            options: 'Service Type',
                            reqd: 1
                        }
                    ],
                    (values) => {
                        const child_table_map = {
                            'Flight GDS': 'flight_booking_entry',
                            'Flight Online Airlines': 'flight_booking_entry',
                            'Hotel Booking': 'hotel_booking_entry',
                            'Visa Application Charges': 'visa_booking_entry',
                            'Car Rental Service': 'car_rental_booking_entry'
                        };

                        const table_fieldname = child_table_map[values.service_type];

                        if (!table_fieldname) {
                            frappe.msgprint('❌ No matching child table for selected service.');
                            return;
                        }

                        // Unhide the relevant child table
                        frm.set_df_property(table_fieldname, "hidden", false);
                        frm.refresh_field(table_fieldname);

                        // Add empty row for this service
                        const row = frm.add_child(table_fieldname, {
                            service_type: values.service_type
                        });
                        frm.refresh_field(table_fieldname);
                        frm.scroll_to_field(table_fieldname);
                    },
                    'Add New Service'
                );
            });
        }
    }
});
