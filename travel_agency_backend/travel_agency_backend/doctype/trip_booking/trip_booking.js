frappe.ui.form.on('Trip Booking', {
    refresh: function (frm) {
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
                            'Insurance Service': 'insurance_booking_entry',
                            'Car Rental Service': 'car_rental_booking_entry'
                        };

                        const table_fieldname = child_table_map[values.service_type];

                        if (!table_fieldname) {
                            frappe.msgprint('❌ No matching child table for selected service.');
                            return;
                        }

                        const row = frm.add_child(table_fieldname, {
                            service_type: values.service_type
                        });

                        frm.refresh_field(table_fieldname);
                        frm.scroll_to_field(table_fieldname);
                    },
                    'Add New Service'
                );
            }, __('Actions')).addClass('btn-primary'); // highlight the button
        }
    }
  });
