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
            const serviceMap = {
              'Flight GDS': ['flight_section', 'flight_booking_entry'],
              'Flight Online Airlines': ['flight_section', 'flight_booking_entry'],
              'Hotel Booking': ['hotel_section', 'hotel_booking_entry'],
              'Visa Application Charges': ['visa_section', 'visa_booking_entry'],
              'Insurance Service': ['visa_section', 'visa_booking_entry'],
              'Car Rental Service': ['car_rental_section', 'car_rental_booking_entry']
            };

            const selected = serviceMap[values.service_type];
            if (!selected) {
              frappe.msgprint('Service not supported.');
              return;
            }

            const [section, table] = selected;

            // Unhide the fields
            frm.set_df_property(section, 'hidden', 0);
            frm.set_df_property(table, 'hidden', 0);
            frm.refresh_field(table);

            // Avoid duplicate entry based on service_type
            const exists = (frm.doc[table] || []).some(row => row.service_type === values.service_type);
            if (!exists) {
              const row = frm.add_child(table, { service_type: values.service_type });
              frm.refresh_field(table);
              frm.scroll_to_field(table);
            } else {
              frappe.msgprint(`${values.service_type} already added.`);
            }
          },
          'Add New Service'
        );
      });
    }
  }
});
